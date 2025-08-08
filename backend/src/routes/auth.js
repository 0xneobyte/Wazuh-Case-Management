const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, sensitiveOperationLimit } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// Helper function to create and send token response
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);

  const options = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRE || 30) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  // Update last login
  user.lastLogin = new Date();
  user.save({ validateBeforeSave: false });

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        department: user.department,
        isActive: user.isActive,
        lastLogin: user.lastLogin
      }
    });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public (but may need admin approval in production)
router.post('/register', [
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
], async (req, res, next) => {
  try {
    // Check for validation errors
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

    const { username, email, password, firstName, lastName, department, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: { message: 'User with this email or username already exists' }
      });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      department,
      role: role || 'analyst' // Default to analyst role
    });

    logger.info(`New user registered: ${user.email}`, {
      userId: user._id,
      username: user.username,
      role: user.role
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    logger.error('Registration error:', error);
    next(error);
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
], sensitiveOperationLimit(), async (req, res, next) => {
  try {
    // Check for validation errors
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

    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid credentials' }
      });
    }

    // Check if account is locked
    if (user.security.accountLocked && user.security.lockExpires > Date.now()) {
      return res.status(423).json({
        success: false,
        error: { 
          message: 'Account is temporarily locked due to too many failed login attempts',
          lockExpires: user.security.lockExpires
        }
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      // Increment failed login attempts
      user.security.failedLoginAttempts += 1;
      
      // Lock account after 5 failed attempts
      if (user.security.failedLoginAttempts >= 5) {
        user.security.accountLocked = true;
        user.security.lockExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
      }
      
      await user.save({ validateBeforeSave: false });

      return res.status(401).json({
        success: false,
        error: { message: 'Invalid credentials' }
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(423).json({
        success: false,
        error: { message: 'Account is deactivated. Please contact administrator.' }
      });
    }

    // Reset failed login attempts on successful login
    if (user.security.failedLoginAttempts > 0) {
      user.security.failedLoginAttempts = 0;
      user.security.accountLocked = false;
      user.security.lockExpires = undefined;
      await user.save({ validateBeforeSave: false });
    }

    logger.info(`User logged in: ${user.email}`, {
      userId: user._id,
      ip: req.ip
    });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('supervisor', 'firstName lastName email')
      .populate('subordinates', 'firstName lastName email role');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, [
  body('firstName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('First name cannot be empty'),
  body('lastName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Last name cannot be empty'),
  body('phoneNumber')
    .optional()
    .trim(),
  body('department')
    .optional()
    .trim(),
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

    const fieldsToUpdate = ['firstName', 'lastName', 'phoneNumber', 'department'];
    const updateData = {};
    
    fieldsToUpdate.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
router.put('/updatepassword', protect, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
], sensitiveOperationLimit(), async (req, res, next) => {
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

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.comparePassword(req.body.currentPassword))) {
      return res.status(401).json({
        success: false,
        error: { message: 'Current password is incorrect' }
      });
    }

    user.password = req.body.newPassword;
    await user.save();

    logger.info(`Password updated for user: ${user.email}`, {
      userId: user._id
    });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
});

// @desc    Update user preferences
// @route   PUT /api/auth/preferences
// @access  Private
router.put('/preferences', protect, async (req, res, next) => {
  try {
    const { emailNotifications, dashboardLayout, timezone } = req.body;

    const updateData = {};
    if (emailNotifications) updateData['preferences.emailNotifications'] = emailNotifications;
    if (dashboardLayout) updateData['preferences.dashboardLayout'] = dashboardLayout;
    if (timezone) updateData['preferences.timezone'] = timezone;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: user.preferences
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, (req, res) => {
  logger.info(`User logged out: ${req.user.email}`, {
    userId: req.user._id
  });

  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: 'User logged out successfully'
  });
});

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
router.post('/forgotpassword', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
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

    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found with that email' }
      });
    }

    // For security, we'll just log this and return success
    // In production, you'd send an email with reset link
    logger.info(`Password reset requested for: ${user.email}`, {
      userId: user._id,
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'If a user with that email exists, a password reset link has been sent'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;