const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { message: 'Not authorized to access this route' }
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { message: 'No user found with this token' }
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          error: { message: 'User account is deactivated' }
        });
      }

      // Check if user changed password after token was issued
      if (user.changedPasswordAfter(decoded.iat)) {
        return res.status(401).json({
          success: false,
          error: { message: 'User recently changed password. Please log in again' }
        });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: { message: 'Not authorized to access this route' }
      });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Server error during authentication' }
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { 
          message: `User role ${req.user.role} is not authorized to access this route`
        }
      });
    }
    next();
  };
};

// Check if user owns the resource or is admin/senior analyst
const checkResourceOwnership = (resourceUserField = 'assignedTo') => {
  return (req, res, next) => {
    // Admin and senior analysts can access all resources
    if (['admin', 'senior_analyst'].includes(req.user.role)) {
      return next();
    }

    // For other roles, check ownership in the resource
    // This middleware should be used after the resource is loaded
    if (req.case && req.case[resourceUserField]) {
      if (req.case[resourceUserField].toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          error: { message: 'Not authorized to access this resource' }
        });
      }
    }

    next();
  };
};

// Rate limiting for sensitive operations
const sensitiveOperationLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const key = req.ip + req.user?.id;
    const now = Date.now();
    const userAttempts = attempts.get(key) || [];

    // Remove old attempts
    const recentAttempts = userAttempts.filter(
      attempt => now - attempt < windowMs
    );

    if (recentAttempts.length >= maxAttempts) {
      return res.status(429).json({
        success: false,
        error: { message: 'Too many attempts. Please try again later.' }
      });
    }

    recentAttempts.push(now);
    attempts.set(key, recentAttempts);
    next();
  };
};

module.exports = {
  protect,
  authorize,
  checkResourceOwnership,
  sensitiveOperationLimit
};