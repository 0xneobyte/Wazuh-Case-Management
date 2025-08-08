const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Case = require('../models/Case');
const { protect, authorize } = require('../middleware/auth');
const wazuhService = require('../services/wazuhService');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @desc    Test Wazuh API connection
// @route   GET /api/wazuh/test
// @access  Private (Admin, Senior Analyst)
router.get('/test', authorize('admin', 'senior_analyst'), async (req, res, next) => {
  try {
    const testResult = await wazuhService.testConnection();
    
    logger.info('Wazuh connection test performed', {
      userId: req.user._id,
      success: testResult.success
    });

    res.status(testResult.success ? 200 : 500).json({
      success: testResult.success,
      data: testResult
    });
  } catch (error) {
    logger.error('Wazuh connection test failed:', error);
    next(error);
  }
});

// @desc    Get Wazuh alerts with filtering
// @route   GET /api/wazuh/alerts
// @access  Private (Admin, Senior Analyst)
router.get('/alerts', authorize('admin', 'senior_analyst'), [
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  query('ruleLevel').optional().isInt({ min: 1, max: 15 }).withMessage('Rule level must be between 1 and 15'),
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

    const options = {
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0,
      sort: req.query.sort || '-timestamp'
    };

    // Add filters
    const filters = {};
    if (req.query.ruleLevel) filters['rule.level'] = `>=${req.query.ruleLevel}`;
    if (req.query.agentId) filters['agent.id'] = req.query.agentId;
    if (req.query.ruleId) filters['rule.id'] = req.query.ruleId;
    if (req.query.startDate) filters.timestamp = `>=${req.query.startDate}`;

    options.filters = filters;

    const result = await wazuhService.getAlerts(options);

    logger.info('Wazuh alerts retrieved', {
      userId: req.user._id,
      count: result.alerts.length,
      filters: filters
    });

    res.status(200).json({
      success: true,
      data: {
        alerts: result.alerts,
        total: result.total,
        limit: options.limit,
        offset: options.offset
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve Wazuh alerts:', error);
    next(error);
  }
});

// @desc    Get new alerts since last sync
// @route   GET /api/wazuh/alerts/new
// @access  Private (Admin, Senior Analyst)
router.get('/alerts/new', authorize('admin', 'senior_analyst'), [
  query('lastSync').optional().isISO8601().withMessage('LastSync must be a valid ISO date'),
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

    const lastSyncTime = req.query.lastSync ? new Date(req.query.lastSync) : null;
    const result = await wazuhService.getNewAlerts(lastSyncTime);

    logger.info('New Wazuh alerts retrieved', {
      userId: req.user._id,
      count: result.alerts.length,
      lastSync: lastSyncTime
    });

    res.status(200).json({
      success: true,
      data: {
        alerts: result.alerts,
        total: result.total,
        lastSyncTime: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve new Wazuh alerts:', error);
    next(error);
  }
});

// @desc    Create case from Wazuh alert
// @route   POST /api/wazuh/alerts/:alertId/create-case
// @access  Private (Admin, Senior Analyst)
router.post('/alerts/:alertId/create-case', authorize('admin', 'senior_analyst'), [
  body('assignedTo').optional().isMongoId().withMessage('Invalid assignedTo user ID'),
  body('priority').optional().isIn(['P1', 'P2', 'P3']).withMessage('Priority must be P1, P2, or P3'),
  body('additionalNotes').optional().trim(),
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

    const alertId = req.params.alertId;

    // Check if case already exists for this alert
    const existingCase = await Case.findOne({ 'wazuhAlert.alertId': alertId });
    if (existingCase) {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Case already exists for this alert',
          caseId: existingCase.caseId
        }
      });
    }

    // Get the specific alert from Wazuh
    const alertsResult = await wazuhService.getAlerts({ 
      filters: { id: alertId }, 
      limit: 1 
    });

    if (!alertsResult.alerts || alertsResult.alerts.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Alert not found in Wazuh' }
      });
    }

    const wazuhAlert = alertsResult.alerts[0];

    // Transform alert to case format
    let caseData = wazuhService.transformAlertToCase(wazuhAlert);

    // Override with user-provided data
    if (req.body.assignedTo) {
      caseData.assignedTo = req.body.assignedTo;
      caseData.assignedBy = req.user._id;
      caseData.assignedAt = new Date();
      
      // Add assignment to timeline
      caseData.timeline.push({
        action: 'Assigned',
        description: 'Case assigned to analyst during creation',
        userId: req.user._id,
        timestamp: new Date(),
        metadata: { assignedTo: req.body.assignedTo }
      });
    }

    if (req.body.priority) {
      caseData.priority = req.body.priority;
    }

    if (req.body.additionalNotes) {
      caseData.timeline.push({
        action: 'Comment Added',
        description: 'Additional notes added during case creation',
        userId: req.user._id,
        timestamp: new Date()
      });
      
      caseData.comments = [{
        userId: req.user._id,
        content: req.body.additionalNotes,
        timestamp: new Date(),
        isInternal: true
      }];
    }

    // Add creation info
    caseData.timeline[0].description = `Case created from Wazuh alert ${alertId} by ${req.user.firstName} ${req.user.lastName}`;

    // Create the case
    const newCase = await Case.create(caseData);

    // Populate the case for response
    const populatedCase = await Case.findById(newCase._id)
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email');

    // Send notification if assigned
    if (req.body.assignedTo) {
      try {
        await emailService.sendCaseAssignmentNotification(populatedCase);
      } catch (emailError) {
        logger.error('Failed to send assignment notification:', emailError);
      }
    }

    logger.info('Case created from Wazuh alert', {
      caseId: newCase.caseId,
      alertId: alertId,
      createdBy: req.user._id,
      assignedTo: req.body.assignedTo
    });

    res.status(201).json({
      success: true,
      data: populatedCase
    });
  } catch (error) {
    logger.error('Failed to create case from Wazuh alert:', error);
    next(error);
  }
});

// @desc    Sync new alerts and auto-create cases for high-priority alerts
// @route   POST /api/wazuh/sync
// @access  Private (Admin, Senior Analyst)
router.post('/sync', authorize('admin', 'senior_analyst'), [
  body('lastSyncTime').optional().isISO8601().withMessage('LastSyncTime must be a valid ISO date'),
  body('autoCreateCases').optional().isBoolean().withMessage('autoCreateCases must be boolean'),
  body('minRuleLevel').optional().isInt({ min: 1, max: 15 }).withMessage('minRuleLevel must be between 1 and 15'),
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

    const lastSyncTime = req.body.lastSyncTime ? new Date(req.body.lastSyncTime) : null;
    const autoCreateCases = req.body.autoCreateCases !== false; // Default true
    const minRuleLevel = req.body.minRuleLevel || 7; // Default to high severity

    const result = await wazuhService.getNewAlerts(lastSyncTime);
    const newAlerts = result.alerts || [];

    const syncResults = {
      totalNewAlerts: newAlerts.length,
      casesCreated: 0,
      casesSkipped: 0,
      errors: []
    };

    if (autoCreateCases && newAlerts.length > 0) {
      // Filter alerts that meet criteria for auto-case creation
      const highPriorityAlerts = newAlerts.filter(alert => 
        alert.rule && alert.rule.level >= minRuleLevel
      );

      for (const alert of highPriorityAlerts) {
        try {
          // Check if case already exists
          const existingCase = await Case.findOne({ 'wazuhAlert.alertId': alert.id });
          if (existingCase) {
            syncResults.casesSkipped++;
            continue;
          }

          // Transform and create case
          const caseData = wazuhService.transformAlertToCase(alert);
          caseData.timeline[0].description = `Case auto-created from Wazuh alert ${alert.id} during sync`;

          const newCase = await Case.create(caseData);
          syncResults.casesCreated++;

          logger.info('Auto-created case from Wazuh alert', {
            caseId: newCase.caseId,
            alertId: alert.id,
            syncBy: req.user._id
          });

        } catch (error) {
          syncResults.errors.push({
            alertId: alert.id,
            error: error.message
          });
          logger.error(`Failed to create case for alert ${alert.id}:`, error);
        }
      }
    }

    logger.info('Wazuh sync completed', {
      userId: req.user._id,
      ...syncResults
    });

    res.status(200).json({
      success: true,
      data: {
        ...syncResults,
        lastSyncTime: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Wazuh sync failed:', error);
    next(error);
  }
});

// @desc    Get Wazuh agents
// @route   GET /api/wazuh/agents
// @access  Private (Admin, Senior Analyst)
router.get('/agents', authorize('admin', 'senior_analyst'), async (req, res, next) => {
  try {
    const agents = await wazuhService.getAgents();

    logger.info('Wazuh agents retrieved', {
      userId: req.user._id,
      count: agents.length
    });

    res.status(200).json({
      success: true,
      data: agents
    });
  } catch (error) {
    logger.error('Failed to retrieve Wazuh agents:', error);
    next(error);
  }
});

// @desc    Get specific Wazuh agent
// @route   GET /api/wazuh/agents/:agentId
// @access  Private (Admin, Senior Analyst)
router.get('/agents/:agentId', authorize('admin', 'senior_analyst'), async (req, res, next) => {
  try {
    const agent = await wazuhService.getAgent(req.params.agentId);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: { message: 'Agent not found' }
      });
    }

    logger.info('Wazuh agent retrieved', {
      userId: req.user._id,
      agentId: req.params.agentId
    });

    res.status(200).json({
      success: true,
      data: agent
    });
  } catch (error) {
    logger.error('Failed to retrieve Wazuh agent:', error);
    next(error);
  }
});

// @desc    Get Wazuh rules
// @route   GET /api/wazuh/rules
// @access  Private (Admin, Senior Analyst)
router.get('/rules', authorize('admin', 'senior_analyst'), [
  query('ruleIds').optional().isString().withMessage('ruleIds must be a comma-separated string'),
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

    const ruleIds = req.query.ruleIds ? req.query.ruleIds.split(',') : [];
    const rules = await wazuhService.getRules(ruleIds);

    logger.info('Wazuh rules retrieved', {
      userId: req.user._id,
      count: rules.length,
      filtered: ruleIds.length > 0
    });

    res.status(200).json({
      success: true,
      data: rules
    });
  } catch (error) {
    logger.error('Failed to retrieve Wazuh rules:', error);
    next(error);
  }
});

// @desc    Get Wazuh integration statistics
// @route   GET /api/wazuh/stats
// @access  Private (Admin, Senior Analyst)
router.get('/stats', authorize('admin', 'senior_analyst'), async (req, res, next) => {
  try {
    // Get stats from local cases created from Wazuh alerts
    const wazuhStats = await Case.aggregate([
      { $match: { 'wazuhAlert.alertId': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: null,
          totalCasesFromWazuh: { $sum: 1 },
          casesByPriority: {
            $push: {
              priority: '$priority',
              ruleLevel: '$wazuhAlert.ruleId'
            }
          },
          casesByAgent: {
            $push: {
              agentId: '$wazuhAlert.agentId',
              agentName: '$wazuhAlert.agentName'
            }
          },
          avgCaseAge: {
            $avg: {
              $divide: [
                { $subtract: [new Date(), '$createdAt'] },
                1000 * 60 * 60 * 24 // Convert to days
              ]
            }
          }
        }
      }
    ]);

    const stats = wazuhStats.length > 0 ? wazuhStats[0] : {
      totalCasesFromWazuh: 0,
      casesByPriority: [],
      casesByAgent: [],
      avgCaseAge: 0
    };

    // Process priority distribution
    const priorityDistribution = stats.casesByPriority.reduce((acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + 1;
      return acc;
    }, {});

    // Process agent distribution
    const agentDistribution = stats.casesByAgent.reduce((acc, item) => {
      if (item.agentId) {
        const key = `${item.agentName || 'Unknown'} (${item.agentId})`;
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        totalCasesFromWazuh: stats.totalCasesFromWazuh,
        avgCaseAge: Math.round(stats.avgCaseAge * 100) / 100,
        priorityDistribution,
        agentDistribution: Object.entries(agentDistribution)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10) // Top 10 agents
          .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
          }, {})
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve Wazuh integration stats:', error);
    next(error);
  }
});

module.exports = router;