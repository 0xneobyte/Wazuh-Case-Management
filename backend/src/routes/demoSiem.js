const express = require('express');
const { protect } = require('../middleware/auth');
const demoSiemService = require('../services/demoSiemService');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @desc    Get demo alerts
// @route   GET /api/siem/demo/alerts
// @access  Private (Admin/Senior Analyst only)
router.get('/alerts', async (req, res, next) => {
  try {
    if (!['admin', 'senior_analyst'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. Admin or Senior Analyst role required.' }
      });
    }

    const alerts = await demoSiemService.getDemoAlerts();

    res.status(200).json({
      success: true,
      data: alerts
    });

  } catch (error) {
    logger.error('Demo SIEM alerts fetch error:', error);
    next(error);
  }
});

// @desc    Get demo SIEM stats
// @route   GET /api/siem/demo/stats
// @access  Private (Admin/Senior Analyst only)
router.get('/stats', async (req, res, next) => {
  try {
    if (!['admin', 'senior_analyst'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. Admin or Senior Analyst role required.' }
      });
    }

    const stats = await demoSiemService.getDemoStats();

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Demo SIEM stats fetch error:', error);
    next(error);
  }
});

// @desc    Sync demo alerts (generate/refresh demo data)
// @route   POST /api/siem/demo/sync
// @access  Private (Admin/Senior Analyst only)
router.post('/sync', async (req, res, next) => {
  try {
    if (!['admin', 'senior_analyst'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. Admin or Senior Analyst role required.' }
      });
    }

    logger.info(`Demo SIEM sync requested by user ${req.user.email}`);

    const result = await demoSiemService.syncDemoAlerts();

    res.status(200).json({
      success: true,
      data: result,
      message: `Successfully synced ${result.alertsCreated} demo alerts`
    });

  } catch (error) {
    logger.error('Demo SIEM sync error:', error);
    next(error);
  }
});

// @desc    Create case from demo alert
// @route   POST /api/siem/demo/create-case
// @access  Private (Admin/Senior Analyst only)
router.post('/create-case', async (req, res, next) => {
  try {
    if (!['admin', 'senior_analyst'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied. Admin or Senior Analyst role required.' }
      });
    }

    const { alertId } = req.body;

    if (!alertId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Alert ID is required' }
      });
    }

    logger.info(`Creating case from demo alert ${alertId} by user ${req.user.email}`);

    const result = await demoSiemService.createCaseFromAlert(alertId, req.user._id);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Case created successfully from demo alert'
    });

  } catch (error) {
    logger.error('Demo SIEM case creation error:', error);
    next(error);
  }
});

module.exports = router;