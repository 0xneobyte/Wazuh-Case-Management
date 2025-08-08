const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Case = require('../models/Case');
const { protect, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @desc    Get all users with filtering and pagination
// @route   GET /api/users
// @access  Private (Admin, Senior Analyst)
router.get('/', authorize('admin', 'senior_analyst'), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('role').optional().isIn(['admin', 'senior_analyst', 'analyst', 'viewer']),
  query('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Validation errors', 
          details: errors.array() 
        }
      });
    }

    // Build query
    const query = {};
    
    if (req.query.role) query.role = req.query.role;
    if (req.query.isActive !== undefined) query.isActive = req.query.isActive === 'true';
    if (req.query.department) query.department = req.query.department;
    
    // Search functionality
    if (req.query.search) {
      query.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { username: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Sorting
    let sort = {};
    if (req.query.sort) {
      const sortField = req.query.sort.startsWith('-') ? req.query.sort.substring(1) : req.query.sort;
      const sortOrder = req.query.sort.startsWith('-') ? -1 : 1;
      sort[sortField] = sortOrder;
    } else {
      sort = { createdAt: -1 };
    }

    const [users, totalCount] = await Promise.all([
      User.find(query)
        .populate('supervisor', 'firstName lastName email role')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    const pagination = {
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1
    };

    res.status(200).json({
      success: true,
      data: users,
      pagination
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin, Senior Analyst, or own profile)
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid user ID')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Validation errors', 
          details: errors.array() 
        }
      });
    }

    // Check if user can access this profile
    if (req.params.id !== req.user.id && !['admin', 'senior_analyst'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not authorized to access this user profile' }
      });
    }

    const user = await User.findById(req.params.id)
      .populate('supervisor', 'firstName lastName email role')
      .populate('subordinates', 'firstName lastName email role');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Create new user
// @route   POST /api/users
// @access  Private (Admin only)
router.post('/', authorize('admin'), [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),
  body('role')
    .isIn(['admin', 'senior_analyst', 'analyst', 'viewer'])
    .withMessage('Invalid role'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Validation errors', 
          details: errors.array() 
        }
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: req.body.email }, { username: req.body.username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: { message: 'User with this email or username already exists' }
      });
    }

    const user = await User.create(req.body);

    logger.info(`New user created by admin: ${user.email}`, {
      userId: user._id,
      createdBy: req.user._id,
      role: user.role
    });

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin, or own profile for limited fields)
router.put('/:id', [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('role').optional().isIn(['admin', 'senior_analyst', 'analyst', 'viewer']).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Validation errors', 
          details: errors.array() 
        }
      });
    }

    const targetUserId = req.params.id;
    const isOwnProfile = targetUserId === req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Check permissions
    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not authorized to update this user' }
      });
    }

    // Non-admins can only update limited fields on their own profile
    const allowedFields = isAdmin 
      ? ['firstName', 'lastName', 'email', 'phoneNumber', 'department', 'role', 'isActive', 'supervisor']
      : ['firstName', 'lastName', 'phoneNumber', 'department'];

    const updateData = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    // Check if email/username already exists (if being updated)
    if (updateData.email) {
      const existingUser = await User.findOne({
        email: updateData.email,
        _id: { $ne: targetUserId }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: { message: 'Email already in use by another user' }
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      targetUserId,
      updateData,
      { new: true, runValidators: true }
    ).populate('supervisor', 'firstName lastName email role');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    logger.info(`User updated: ${user.email}`, {
      userId: user._id,
      updatedBy: req.user._id,
      changes: Object.keys(updateData)
    });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Delete user (soft delete)
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
router.delete('/:id', authorize('admin'), [
  param('id').isMongoId().withMessage('Invalid user ID')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Validation errors', 
          details: errors.array() 
        }
      });
    }

    // Prevent self-deletion
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot delete your own account' }
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    // Soft delete - deactivate instead of removing
    user.isActive = false;
    await user.save();

    // Reassign open cases to admin or another analyst
    const openCases = await Case.find({ 
      assignedTo: req.params.id, 
      status: { $in: ['Open', 'In Progress'] } 
    });

    if (openCases.length > 0) {
      // Find an active admin or senior analyst to reassign cases
      const reassignTo = await User.findOne({ 
        role: { $in: ['admin', 'senior_analyst'] }, 
        isActive: true,
        _id: { $ne: req.params.id }
      });

      if (reassignTo) {
        await Case.updateMany(
          { assignedTo: req.params.id, status: { $in: ['Open', 'In Progress'] } },
          { 
            assignedTo: reassignTo._id,
            assignedBy: req.user._id,
            assignedAt: new Date(),
            $push: {
              timeline: {
                action: 'Assigned',
                description: `Case reassigned due to user deactivation to ${reassignTo.firstName} ${reassignTo.lastName}`,
                userId: req.user._id,
                timestamp: new Date(),
                metadata: { 
                  reason: 'user_deactivation',
                  previousAssignee: req.params.id,
                  newAssignee: reassignTo._id
                }
              }
            }
          }
        );
      }
    }

    logger.info(`User deactivated: ${user.email}`, {
      userId: user._id,
      deactivatedBy: req.user._id,
      reassignedCases: openCases.length
    });

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully',
      data: { reassignedCases: openCases.length }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get user performance metrics
// @route   GET /api/users/:id/performance
// @access  Private (Admin, Senior Analyst, or own performance)
router.get('/:id/performance', [
  param('id').isMongoId().withMessage('Invalid user ID')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Validation errors', 
          details: errors.array() 
        }
      });
    }

    // Check permissions
    if (req.params.id !== req.user.id && !['admin', 'senior_analyst'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not authorized to access this performance data' }
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    // Get additional performance data
    const [recentCases, casesByStatus] = await Promise.all([
      Case.find({ assignedTo: req.params.id })
        .sort({ updatedAt: -1 })
        .limit(10)
        .select('caseId title status priority createdAt updatedAt'),
      
      Case.aggregate([
        { $match: { assignedTo: user._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgResolutionTime: {
              $avg: {
                $cond: [
                  { $in: ['$status', ['Resolved', 'Closed']] },
                  { $subtract: ['$resolution.resolvedAt', '$createdAt'] },
                  null
                ]
              }
            }
          }
        }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          workloadStatus: user.workloadStatus
        },
        performance: user.performance,
        recentCases,
        casesByStatus: casesByStatus.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            avgResolutionTime: item.avgResolutionTime ? Math.floor(item.avgResolutionTime / (1000 * 60)) : null
          };
          return acc;
        }, {})
      }
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get user statistics (for admins)
// @route   GET /api/users/stats/overview
// @access  Private (Admin, Senior Analyst)
router.get('/stats/overview', authorize('admin', 'senior_analyst'), async (req, res, next) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
          inactiveUsers: { $sum: { $cond: ['$isActive', 0, 1] } },
          adminUsers: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          seniorAnalysts: { $sum: { $cond: [{ $eq: ['$role', 'senior_analyst'] }, 1, 0] } },
          analysts: { $sum: { $cond: [{ $eq: ['$role', 'analyst'] }, 1, 0] } },
          viewers: { $sum: { $cond: [{ $eq: ['$role', 'viewer'] }, 1, 0] } },
          totalCaseLoad: { $sum: '$performance.currentCaseLoad' },
          avgCaseLoad: { $avg: '$performance.currentCaseLoad' }
        }
      }
    ]);

    const result = stats.length > 0 ? stats[0] : {
      totalUsers: 0, activeUsers: 0, inactiveUsers: 0,
      adminUsers: 0, seniorAnalysts: 0, analysts: 0, viewers: 0,
      totalCaseLoad: 0, avgCaseLoad: 0
    };

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get users workload distribution
// @route   GET /api/users/workload
// @access  Private (Admin, Senior Analyst)
router.get('/workload', authorize('admin', 'senior_analyst'), async (req, res, next) => {
  try {
    const users = await User.find({ 
      isActive: true, 
      role: { $in: ['analyst', 'senior_analyst'] } 
    })
    .select('firstName lastName email role performance.currentCaseLoad performance.totalCasesResolved performance.avgResolutionTime')
    .sort({ 'performance.currentCaseLoad': -1 });

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;