const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const emailService = require('../services/emailService');
const User = require('../models/User');
const Case = require('../models/Case');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @desc    Test email service configuration
// @route   POST /api/notifications/test-email
// @access  Private (Admin only)
router.post('/test-email', authorize('admin'), [
  body('email').isEmail().withMessage('Valid email is required'),
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

    const result = await emailService.sendTestEmail(req.body.email, req.user);

    logger.info('Test email sent', {
      sentBy: req.user._id,
      sentTo: req.body.email,
      success: result.success
    });

    res.status(result.success ? 200 : 500).json({
      success: result.success,
      message: result.success ? 'Test email sent successfully' : 'Failed to send test email',
      data: result
    });
  } catch (error) {
    logger.error('Test email failed:', error);
    next(error);
  }
});

// @desc    Send case assignment notification manually
// @route   POST /api/notifications/case/:caseId/assignment
// @access  Private (Admin, Senior Analyst)
router.post('/case/:caseId/assignment', authorize('admin', 'senior_analyst'), async (req, res, next) => {
  try {
    const caseData = await Case.findById(req.params.caseId)
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: { message: 'Case not found' }
      });
    }

    if (!caseData.assignedTo) {
      return res.status(400).json({
        success: false,
        error: { message: 'Case is not assigned to anyone' }
      });
    }

    const result = await emailService.sendCaseAssignmentNotification(caseData);

    logger.info('Manual case assignment notification sent', {
      caseId: caseData.caseId,
      sentBy: req.user._id,
      sentTo: caseData.assignedTo._id,
      success: result.success
    });

    res.status(result.success ? 200 : 500).json({
      success: result.success,
      message: result.success ? 'Assignment notification sent' : 'Failed to send notification',
      data: result
    });
  } catch (error) {
    logger.error('Manual assignment notification failed:', error);
    next(error);
  }
});

// @desc    Send case closure notification manually
// @route   POST /api/notifications/case/:caseId/closure
// @access  Private (Admin, Senior Analyst)
router.post('/case/:caseId/closure', authorize('admin', 'senior_analyst'), async (req, res, next) => {
  try {
    const caseData = await Case.findById(req.params.caseId)
      .populate('resolution.resolvedBy', 'firstName lastName email');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: { message: 'Case not found' }
      });
    }

    if (!['Resolved', 'Closed'].includes(caseData.status)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Case is not resolved or closed' }
      });
    }

    const resolvedBy = caseData.resolution?.resolvedBy || req.user;
    const result = await emailService.sendCaseClosureNotification(caseData, resolvedBy);

    logger.info('Manual case closure notification sent', {
      caseId: caseData.caseId,
      sentBy: req.user._id,
      success: result.success
    });

    res.status(result.success ? 200 : 500).json({
      success: result.success,
      message: result.success ? 'Closure notification sent' : 'Failed to send notification',
      data: result
    });
  } catch (error) {
    logger.error('Manual closure notification failed:', error);
    next(error);
  }
});

// @desc    Send SLA escalation alert manually
// @route   POST /api/notifications/case/:caseId/escalation
// @access  Private (Admin, Senior Analyst)
router.post('/case/:caseId/escalation', authorize('admin', 'senior_analyst'), [
  body('escalatedTo').isMongoId().withMessage('Valid escalatedTo user ID is required'),
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

    const caseData = await Case.findById(req.params.caseId)
      .populate('assignedTo', 'firstName lastName email');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: { message: 'Case not found' }
      });
    }

    const escalatedTo = await User.findById(req.body.escalatedTo)
      .select('firstName lastName email role');

    if (!escalatedTo) {
      return res.status(404).json({
        success: false,
        error: { message: 'Escalation recipient not found' }
      });
    }

    const result = await emailService.sendSLAEscalationAlert(caseData, escalatedTo);

    // Update case escalation status
    if (result.success) {
      await Case.findByIdAndUpdate(req.params.caseId, {
        'sla.escalated': true,
        'sla.escalatedTo': escalatedTo._id,
        'sla.escalatedAt': new Date(),
        $push: {
          timeline: {
            action: 'Escalated',
            description: `Case escalated to ${escalatedTo.firstName} ${escalatedTo.lastName} due to SLA breach`,
            userId: req.user._id,
            timestamp: new Date(),
            metadata: {
              escalatedTo: escalatedTo._id,
              reason: 'SLA_BREACH'
            }
          }
        }
      });
    }

    logger.info('Manual SLA escalation notification sent', {
      caseId: caseData.caseId,
      escalatedBy: req.user._id,
      escalatedTo: escalatedTo._id,
      success: result.success
    });

    res.status(result.success ? 200 : 500).json({
      success: result.success,
      message: result.success ? 'Escalation alert sent' : 'Failed to send escalation alert',
      data: result
    });
  } catch (error) {
    logger.error('Manual escalation notification failed:', error);
    next(error);
  }
});

// @desc    Send daily digest to users
// @route   POST /api/notifications/daily-digest
// @access  Private (Admin only)
router.post('/daily-digest', authorize('admin'), [
  body('userIds').optional().isArray().withMessage('userIds must be an array'),
  body('userIds.*').optional().isMongoId().withMessage('Each userIds must be a valid MongoDB ID'),
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

    // Get users who have daily digest enabled
    let userQuery = {
      isActive: true,
      'preferences.emailNotifications.dailyDigest': true
    };

    // If specific users are requested
    if (req.body.userIds && req.body.userIds.length > 0) {
      userQuery._id = { $in: req.body.userIds };
      delete userQuery['preferences.emailNotifications.dailyDigest'];
    }

    const users = await User.find(userQuery)
      .select('firstName lastName email _id');

    const results = [];

    for (const user of users) {
      try {
        // Get user's case statistics
        const userStats = await Case.aggregate([
          { $match: { assignedTo: user._id } },
          {
            $group: {
              _id: null,
              openCases: { $sum: { $cond: [{ $eq: ['$status', 'Open'] }, 1, 0] } },
              inProgressCases: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
              overdueCases: { 
                $sum: { 
                  $cond: [
                    { $and: [
                      { $lt: ['$sla.dueDate', new Date()] },
                      { $not: { $in: ['$status', ['Resolved', 'Closed']] } }
                    ]},
                    1, 
                    0
                  ] 
                } 
              }
            }
          }
        ]);

        const stats = userStats.length > 0 ? userStats[0] : {
          openCases: 0, inProgressCases: 0, overdueCases: 0
        };

        const result = await emailService.sendDailyDigest(
          user.email,
          `${user.firstName} ${user.lastName}`,
          stats
        );

        results.push({
          userId: user._id,
          email: user.email,
          success: result.success,
          error: result.error || null
        });

        logger.info('Daily digest sent', {
          userId: user._id,
          email: user.email,
          success: result.success
        });

      } catch (userError) {
        results.push({
          userId: user._id,
          email: user.email,
          success: false,
          error: userError.message
        });

        logger.error(`Daily digest failed for user ${user._id}:`, userError);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.status(200).json({
      success: true,
      message: `Daily digest sent to ${successCount} users (${failureCount} failures)`,
      data: {
        totalUsers: users.length,
        successCount,
        failureCount,
        results
      }
    });

  } catch (error) {
    logger.error('Daily digest batch send failed:', error);
    next(error);
  }
});

// @desc    Get notification statistics
// @route   GET /api/notifications/stats
// @access  Private (Admin, Senior Analyst)
router.get('/stats', authorize('admin', 'senior_analyst'), [
  query('period').optional().isIn(['24h', '7d', '30d']).withMessage('Invalid period'),
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

    const period = req.query.period || '24h';
    const hoursMap = { '24h': 24, '7d': 168, '30d': 720 };
    const startTime = new Date(Date.now() - hoursMap[period] * 60 * 60 * 1000);

    // Count cases created (which trigger assignment notifications)
    const casesCreated = await Case.countDocuments({
      createdAt: { $gte: startTime },
      assignedTo: { $exists: true, $ne: null }
    });

    // Count status changes (which trigger update notifications)
    const statusChanges = await Case.countDocuments({
      'timeline.timestamp': { $gte: startTime },
      'timeline.action': 'Status Changed'
    });

    // Count escalations
    const escalations = await Case.countDocuments({
      'sla.escalatedAt': { $gte: startTime }
    });

    // Count cases closed (which trigger closure notifications)
    const casesClosed = await Case.countDocuments({
      status: { $in: ['Resolved', 'Closed'] },
      'resolution.resolvedAt': { $gte: startTime }
    });

    // Count overdue cases (potential escalation candidates)
    const overdueCases = await Case.countDocuments({
      'sla.dueDate': { $lt: new Date() },
      status: { $not: { $in: ['Resolved', 'Closed'] } }
    });

    const stats = {
      period,
      estimatedNotifications: {
        assignments: casesCreated,
        statusUpdates: statusChanges,
        escalations: escalations,
        closures: casesClosed,
        total: casesCreated + statusChanges + escalations + casesClosed
      },
      currentStatus: {
        overdueCases,
        emailServiceConfigured: emailService.isConfigured
      }
    };

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Failed to get notification stats:', error);
    next(error);
  }
});

// @desc    Update user notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
router.put('/preferences', [
  body('newAssignment').optional().isBoolean(),
  body('caseUpdate').optional().isBoolean(),
  body('escalation').optional().isBoolean(),
  body('dailyDigest').optional().isBoolean(),
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

    const updates = {};
    const allowedFields = ['newAssignment', 'caseUpdate', 'escalation', 'dailyDigest'];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[`preferences.emailNotifications.${field}`] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No valid preferences provided' }
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('preferences.emailNotifications');

    logger.info('User notification preferences updated', {
      userId: req.user._id,
      updates: Object.keys(updates)
    });

    res.status(200).json({
      success: true,
      data: user.preferences.emailNotifications
    });

  } catch (error) {
    logger.error('Failed to update notification preferences:', error);
    next(error);
  }
});

// @desc    Get current user notification preferences
// @route   GET /api/notifications/preferences
// @access  Private
router.get('/preferences', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('preferences.emailNotifications');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
    }

    res.status(200).json({
      success: true,
      data: user.preferences.emailNotifications
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;