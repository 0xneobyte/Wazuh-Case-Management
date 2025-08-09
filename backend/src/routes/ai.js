const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const Case = require('../models/Case');
const aiService = require('../services/aiService');
const geminiService = require('../services/geminiService');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @desc    Get AI-powered remediation suggestions for a case
// @route   POST /api/ai/case/:caseId/remediation
// @access  Private
router.post('/case/:caseId/remediation', [
  param('caseId').isMongoId().withMessage('Invalid case ID'),
  body('context').optional().isString().withMessage('Context must be a string'),
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

    const caseData = await Case.findById(req.params.caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: { message: 'Case not found' }
      });
    }

    // Check if user can access this case
    if (req.user.role === 'analyst' && 
        caseData.assignedTo && 
        caseData.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not authorized to access this case' }
      });
    }

    const additionalContext = req.body.context || '';
    
    const suggestions = await aiService.getRemediationSuggestions(
      caseData,
      additionalContext,
      req.user
    );

    // Update case with AI suggestions if successful
    if (suggestions.success) {
      await Case.findByIdAndUpdate(req.params.caseId, {
        'aiAssistant.remediationSuggestions': suggestions.suggestions,
        'aiAssistant.lastUpdated': new Date(),
        $push: {
          timeline: {
            action: 'AI Analysis',
            description: 'AI remediation suggestions generated',
            userId: req.user._id,
            timestamp: new Date(),
            metadata: {
              aiService: 'remediation',
              suggestionsCount: suggestions.suggestions?.length || 0
            }
          }
        }
      });
    }

    logger.info('AI remediation suggestions requested', {
      caseId: caseData.caseId,
      userId: req.user._id,
      success: suggestions.success,
      suggestionsCount: suggestions.suggestions?.length || 0
    });

    res.status(suggestions.success ? 200 : 500).json({
      success: suggestions.success,
      data: suggestions,
      message: suggestions.success ? 
        'Remediation suggestions generated successfully' : 
        'Failed to generate suggestions'
    });

  } catch (error) {
    logger.error('AI remediation request failed:', error);
    next(error);
  }
});

// @desc    Get MITRE ATT&CK mapping and compliance checks
// @route   POST /api/ai/case/:caseId/mitre-analysis
// @access  Private
router.post('/case/:caseId/mitre-analysis', [
  param('caseId').isMongoId().withMessage('Invalid case ID'),
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

    const caseData = await Case.findById(req.params.caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: { message: 'Case not found' }
      });
    }

    // Check if user can access this case
    if (req.user.role === 'analyst' && 
        caseData.assignedTo && 
        caseData.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not authorized to access this case' }
      });
    }

    const analysis = await aiService.getMitreAnalysis(caseData, req.user);

    // Update case with MITRE analysis if successful
    if (analysis.success) {
      const updateData = {
        'aiAssistant.lastUpdated': new Date(),
        $push: {
          timeline: {
            action: 'AI Analysis',
            description: 'MITRE ATT&CK analysis performed',
            userId: req.user._id,
            timestamp: new Date(),
            metadata: {
              aiService: 'mitre-analysis',
              tacticsCount: analysis.mitreMapping?.tactics?.length || 0,
              techniquesCount: analysis.mitreMapping?.techniques?.length || 0
            }
          }
        }
      };

      // Update MITRE mapping if provided
      if (analysis.mitreMapping) {
        updateData.mitreAttack = analysis.mitreMapping;
      }

      // Update compliance checks if provided
      if (analysis.complianceChecks) {
        updateData['aiAssistant.complianceChecks'] = analysis.complianceChecks;
      }

      await Case.findByIdAndUpdate(req.params.caseId, updateData);
    }

    logger.info('AI MITRE analysis requested', {
      caseId: caseData.caseId,
      userId: req.user._id,
      success: analysis.success
    });

    res.status(analysis.success ? 200 : 500).json({
      success: analysis.success,
      data: analysis,
      message: analysis.success ? 
        'MITRE analysis completed successfully' : 
        'Failed to perform MITRE analysis'
    });

  } catch (error) {
    logger.error('AI MITRE analysis request failed:', error);
    next(error);
  }
});

// @desc    Generate executive summary for a case
// @route   POST /api/ai/case/:caseId/executive-summary
// @access  Private (Admin, Senior Analyst)
router.post('/case/:caseId/executive-summary', authorize('admin', 'senior_analyst'), [
  param('caseId').isMongoId().withMessage('Invalid case ID'),
  body('includeRecommendations').optional().isBoolean(),
  body('audienceLevel').optional().isIn(['executive', 'technical', 'mixed']).withMessage('Invalid audience level'),
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
      .populate('assignedTo', 'firstName lastName')
      .populate('resolution.resolvedBy', 'firstName lastName');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: { message: 'Case not found' }
      });
    }

    const options = {
      includeRecommendations: req.body.includeRecommendations !== false,
      audienceLevel: req.body.audienceLevel || 'executive'
    };

    const summary = await aiService.generateExecutiveSummary(
      caseData,
      options,
      req.user
    );

    // Update case with executive summary if successful
    if (summary.success) {
      await Case.findByIdAndUpdate(req.params.caseId, {
        'aiAssistant.executiveSummary': summary.summary,
        'aiAssistant.lastUpdated': new Date(),
        $push: {
          timeline: {
            action: 'AI Analysis',
            description: 'Executive summary generated',
            userId: req.user._id,
            timestamp: new Date(),
            metadata: {
              aiService: 'executive-summary',
              audienceLevel: options.audienceLevel,
              includeRecommendations: options.includeRecommendations
            }
          }
        }
      });
    }

    logger.info('AI executive summary requested', {
      caseId: caseData.caseId,
      userId: req.user._id,
      success: summary.success,
      audienceLevel: options.audienceLevel
    });

    res.status(summary.success ? 200 : 500).json({
      success: summary.success,
      data: summary,
      message: summary.success ? 
        'Executive summary generated successfully' : 
        'Failed to generate executive summary'
    });

  } catch (error) {
    logger.error('AI executive summary request failed:', error);
    next(error);
  }
});

// @desc    Get AI-powered case risk assessment
// @route   POST /api/ai/case/:caseId/risk-assessment
// @access  Private
router.post('/case/:caseId/risk-assessment', [
  param('caseId').isMongoId().withMessage('Invalid case ID'),
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

    const caseData = await Case.findById(req.params.caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: { message: 'Case not found' }
      });
    }

    // Check if user can access this case
    if (req.user.role === 'analyst' && 
        caseData.assignedTo && 
        caseData.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not authorized to access this case' }
      });
    }

    const riskAssessment = await aiService.assessCaseRisk(caseData, req.user);

    // Add risk assessment to case timeline
    if (riskAssessment.success) {
      await Case.findByIdAndUpdate(req.params.caseId, {
        $push: {
          timeline: {
            action: 'AI Analysis',
            description: `Risk assessment: ${riskAssessment.riskLevel} risk level identified`,
            userId: req.user._id,
            timestamp: new Date(),
            metadata: {
              aiService: 'risk-assessment',
              riskLevel: riskAssessment.riskLevel,
              riskScore: riskAssessment.riskScore
            }
          }
        }
      });
    }

    logger.info('AI risk assessment requested', {
      caseId: caseData.caseId,
      userId: req.user._id,
      success: riskAssessment.success,
      riskLevel: riskAssessment.riskLevel
    });

    res.status(riskAssessment.success ? 200 : 500).json({
      success: riskAssessment.success,
      data: riskAssessment,
      message: riskAssessment.success ? 
        'Risk assessment completed successfully' : 
        'Failed to assess case risk'
    });

  } catch (error) {
    logger.error('AI risk assessment request failed:', error);
    next(error);
  }
});

// @desc    Get AI suggestions for case categorization
// @route   POST /api/ai/case/:caseId/categorize
// @access  Private (Admin, Senior Analyst)
router.post('/case/:caseId/categorize', authorize('admin', 'senior_analyst'), [
  param('caseId').isMongoId().withMessage('Invalid case ID'),
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

    const caseData = await Case.findById(req.params.caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: { message: 'Case not found' }
      });
    }

    const categorization = await aiService.suggestCategorization(caseData, req.user);

    logger.info('AI categorization requested', {
      caseId: caseData.caseId,
      userId: req.user._id,
      success: categorization.success,
      currentCategory: caseData.category,
      suggestedCategory: categorization.suggestedCategory
    });

    res.status(categorization.success ? 200 : 500).json({
      success: categorization.success,
      data: categorization,
      message: categorization.success ? 
        'Categorization suggestions generated successfully' : 
        'Failed to generate categorization suggestions'
    });

  } catch (error) {
    logger.error('AI categorization request failed:', error);
    next(error);
  }
});

// @desc    Get AI-powered similar cases analysis
// @route   GET /api/ai/case/:caseId/similar-cases
// @access  Private
router.get('/case/:caseId/similar-cases', [
  param('caseId').isMongoId().withMessage('Invalid case ID'),
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20'),
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

    const caseData = await Case.findById(req.params.caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: { message: 'Case not found' }
      });
    }

    // Check if user can access this case
    if (req.user.role === 'analyst' && 
        caseData.assignedTo && 
        caseData.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not authorized to access this case' }
      });
    }

    const limit = parseInt(req.query.limit) || 5;
    const similarCases = await aiService.findSimilarCases(caseData, limit, req.user);

    logger.info('AI similar cases analysis requested', {
      caseId: caseData.caseId,
      userId: req.user._id,
      success: similarCases.success,
      similarCasesCount: similarCases.cases?.length || 0
    });

    res.status(similarCases.success ? 200 : 500).json({
      success: similarCases.success,
      data: similarCases,
      message: similarCases.success ? 
        'Similar cases analysis completed successfully' : 
        'Failed to find similar cases'
    });

  } catch (error) {
    logger.error('AI similar cases analysis failed:', error);
    next(error);
  }
});

// @desc    Get AI service status and configuration
// @route   GET /api/ai/status
// @access  Private (Admin, Senior Analyst)
router.get('/status', authorize('admin', 'senior_analyst'), async (req, res, next) => {
  try {
    const status = await aiService.getServiceStatus();

    logger.info('AI service status requested', {
      userId: req.user._id,
      configured: status.configured
    });

    res.status(200).json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('AI service status request failed:', error);
    next(error);
  }
});

// @desc    Test AI service connectivity
// @route   POST /api/ai/test
// @access  Private (Admin only)
router.post('/test', authorize('admin'), async (req, res, next) => {
  try {
    const testResult = await aiService.testConnection();

    logger.info('AI service connection test performed', {
      userId: req.user._id,
      success: testResult.success
    });

    res.status(testResult.success ? 200 : 500).json({
      success: testResult.success,
      data: testResult,
      message: testResult.success ? 
        'AI service connection successful' : 
        'AI service connection failed'
    });

  } catch (error) {
    logger.error('AI service connection test failed:', error);
    next(error);
  }
});

// @desc    Get AI usage statistics
// @route   GET /api/ai/stats
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

    const period = req.query.period || '7d';
    const hoursMap = { '24h': 24, '7d': 168, '30d': 720 };
    const startTime = new Date(Date.now() - hoursMap[period] * 60 * 60 * 1000);

    // Count AI-related timeline entries
    const aiUsageStats = await Case.aggregate([
      {
        $match: {
          'timeline.timestamp': { $gte: startTime },
          'timeline.action': 'AI Analysis'
        }
      },
      { $unwind: '$timeline' },
      {
        $match: {
          'timeline.timestamp': { $gte: startTime },
          'timeline.action': 'AI Analysis'
        }
      },
      {
        $group: {
          _id: '$timeline.metadata.aiService',
          count: { $sum: 1 },
          users: { $addToSet: '$timeline.userId' }
        }
      }
    ]);

    // Count cases with AI assistance
    const casesWithAI = await Case.countDocuments({
      'aiAssistant.lastUpdated': { $gte: startTime }
    });

    const stats = {
      period,
      casesWithAIAssistance: casesWithAI,
      serviceUsage: aiUsageStats.reduce((acc, item) => {
        acc[item._id || 'unknown'] = {
          count: item.count,
          uniqueUsers: item.users.length
        };
        return acc;
      }, {}),
      totalAIRequests: aiUsageStats.reduce((sum, item) => sum + item.count, 0)
    };

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Failed to get AI usage stats:', error);
    next(error);
  }
});

// ===== GEMINI AI ROUTES =====

// @desc    Get Gemini-powered remediation suggestions for a case
// @route   POST /api/ai/gemini/case/:caseId/remediation
// @access  Private
router.post('/gemini/case/:caseId/remediation', [
  param('caseId').isMongoId().withMessage('Invalid case ID'),
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

    const caseData = await Case.findById(req.params.caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: { message: 'Case not found' }
      });
    }

    // Check if user can access this case
    if (req.user.role === 'analyst' && 
        caseData.assignedTo && 
        caseData.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not authorized to access this case' }
      });
    }

    if (!geminiService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: { message: 'Gemini AI service is not available. Please configure GEMINI_API_KEY.' }
      });
    }

    const suggestions = await geminiService.generateRemediationSuggestions(caseData);

    // Update case with AI suggestions
    await Case.findByIdAndUpdate(req.params.caseId, {
      'aiAssistant.remediationSuggestions': suggestions.suggestions,
      'aiAssistant.lastUpdated': suggestions.generatedAt,
      $push: {
        timeline: {
          action: 'AI Analysis',
          description: 'Gemini AI remediation suggestions generated',
          userId: req.user._id,
          timestamp: new Date(),
          metadata: {
            aiService: 'gemini-remediation',
            suggestionsCount: suggestions.suggestions?.length || 0
          }
        }
      }
    });

    logger.info('Gemini remediation suggestions requested', {
      caseId: caseData.caseId,
      userId: req.user._id,
      suggestionsCount: suggestions.suggestions?.length || 0
    });

    res.status(200).json({
      success: true,
      data: suggestions,
      message: 'Remediation suggestions generated successfully using Gemini AI'
    });

  } catch (error) {
    logger.error('Gemini remediation request failed:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to generate remediation suggestions' }
    });
  }
});

// @desc    Generate Gemini executive summary for a case
// @route   POST /api/ai/gemini/case/:caseId/executive-summary
// @access  Private (Admin, Senior Analyst)
router.post('/gemini/case/:caseId/executive-summary', authorize('admin', 'senior_analyst'), [
  param('caseId').isMongoId().withMessage('Invalid case ID'),
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
      .populate('assignedTo', 'firstName lastName')
      .populate('resolution.resolvedBy', 'firstName lastName');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: { message: 'Case not found' }
      });
    }

    if (!geminiService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: { message: 'Gemini AI service is not available. Please configure GEMINI_API_KEY.' }
      });
    }

    const summary = await geminiService.generateExecutiveSummary(caseData);

    // Update case with executive summary
    await Case.findByIdAndUpdate(req.params.caseId, {
      'aiAssistant.executiveSummary': summary.summary,
      'aiAssistant.lastUpdated': summary.generatedAt,
      $push: {
        timeline: {
          action: 'AI Analysis',
          description: 'Gemini AI executive summary generated',
          userId: req.user._id,
          timestamp: new Date(),
          metadata: {
            aiService: 'gemini-executive-summary'
          }
        }
      }
    });

    logger.info('Gemini executive summary requested', {
      caseId: caseData.caseId,
      userId: req.user._id
    });

    res.status(200).json({
      success: true,
      data: summary,
      message: 'Executive summary generated successfully using Gemini AI'
    });

  } catch (error) {
    logger.error('Gemini executive summary request failed:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to generate executive summary' }
    });
  }
});

// @desc    Generate Gemini compliance analysis for a case
// @route   POST /api/ai/gemini/case/:caseId/compliance
// @access  Private (Admin, Senior Analyst)
router.post('/gemini/case/:caseId/compliance', authorize('admin', 'senior_analyst'), [
  param('caseId').isMongoId().withMessage('Invalid case ID'),
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

    const caseData = await Case.findById(req.params.caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: { message: 'Case not found' }
      });
    }

    if (!geminiService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: { message: 'Gemini AI service is not available. Please configure GEMINI_API_KEY.' }
      });
    }

    const compliance = await geminiService.generateComplianceAnalysis(caseData);

    // Update case with compliance analysis
    await Case.findByIdAndUpdate(req.params.caseId, {
      'aiAssistant.complianceChecks': compliance.analysis,
      'aiAssistant.lastUpdated': compliance.generatedAt,
      $push: {
        timeline: {
          action: 'AI Analysis',
          description: 'Gemini AI compliance analysis performed',
          userId: req.user._id,
          timestamp: new Date(),
          metadata: {
            aiService: 'gemini-compliance',
            frameworksCount: compliance.analysis?.length || 0
          }
        }
      }
    });

    logger.info('Gemini compliance analysis requested', {
      caseId: caseData.caseId,
      userId: req.user._id,
      frameworksCount: compliance.analysis?.length || 0
    });

    res.status(200).json({
      success: true,
      data: compliance,
      message: 'Compliance analysis generated successfully using Gemini AI'
    });

  } catch (error) {
    logger.error('Gemini compliance analysis request failed:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to generate compliance analysis' }
    });
  }
});

// @desc    Generate PDF report for a case using Gemini AI
// @route   GET /api/ai/gemini/case/:caseId/pdf-report
// @access  Private
router.get('/gemini/case/:caseId/pdf-report', [
  param('caseId').isMongoId().withMessage('Invalid case ID'),
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
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('resolution.resolvedBy', 'firstName lastName email');

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: { message: 'Case not found' }
      });
    }

    // Check if user can access this case
    if (req.user.role === 'analyst' && 
        caseData.assignedTo && 
        caseData.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not authorized to access this case' }
      });
    }

    if (!geminiService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: { message: 'Gemini AI service is not available. Please configure GEMINI_API_KEY.' }
      });
    }

    // Generate comprehensive report data using Gemini
    const reportData = await geminiService.generatePDFReportData(caseData);

    // Add PDF generation to timeline
    await Case.findByIdAndUpdate(req.params.caseId, {
      $push: {
        timeline: {
          action: 'Report Generated',
          description: 'AI-powered PDF report generated',
          userId: req.user._id,
          timestamp: new Date(),
          metadata: {
            aiService: 'gemini-pdf-report',
            reportType: 'comprehensive'
          }
        }
      }
    });

    logger.info('Gemini PDF report requested', {
      caseId: caseData.caseId,
      userId: req.user._id
    });

    // For now, return JSON data - PDF generation will be handled by frontend
    res.status(200).json({
      success: true,
      data: reportData,
      message: 'PDF report data generated successfully using Gemini AI'
    });

  } catch (error) {
    logger.error('Gemini PDF report request failed:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to generate PDF report data' }
    });
  }
});

// @desc    Check Gemini service status
// @route   GET /api/ai/gemini/status
// @access  Private (Admin, Senior Analyst)
router.get('/gemini/status', authorize('admin', 'senior_analyst'), async (req, res, next) => {
  try {
    const status = {
      available: geminiService.isAvailable(),
      service: 'Google Gemini AI',
      configured: !!process.env.GEMINI_API_KEY,
      model: 'gemini-pro'
    };

    res.status(200).json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Gemini status check failed:', error);
    next(error);
  }
});

module.exports = router;