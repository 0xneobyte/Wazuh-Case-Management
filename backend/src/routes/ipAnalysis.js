const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const ipAnalysisService = require('../services/ipAnalysisService');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @desc    Analyze IP address
// @route   POST /api/ip-analysis/analyze
// @access  Private
router.post('/analyze', [
  body('ip')
    .trim()
    .notEmpty()
    .withMessage('IP address is required')
    .matches(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/)
    .withMessage('Invalid IP address format')
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

    const { ip } = req.body;

    logger.info(`IP analysis requested by user ${req.user.email} for IP: ${ip}`);

    const analysis = await ipAnalysisService.analyzeIP(ip);

    res.status(200).json({
      success: true,
      data: analysis
    });

  } catch (error) {
    logger.error('IP analysis error:', error);
    next(error);
  }
});

// @desc    Get IP analysis history (if we want to store them)
// @route   GET /api/ip-analysis/history
// @access  Private
router.get('/history', async (req, res, next) => {
  try {
    // For now, return empty array - we can implement history storage later
    res.status(200).json({
      success: true,
      data: [],
      message: 'IP analysis history not yet implemented'
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Test IP analysis service connection
// @route   GET /api/ip-analysis/test
// @access  Private (Admin only)
router.get('/test', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Admin access required' }
      });
    }

    // Test with a known IP (Google's DNS)
    const testIP = '8.8.8.8';
    const analysis = await ipAnalysisService.analyzeIP(testIP);

    res.status(200).json({
      success: true,
      message: 'IP analysis service test successful',
      data: analysis
    });

  } catch (error) {
    logger.error('IP analysis service test failed:', error);
    next(error);
  }
});

module.exports = router;