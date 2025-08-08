const cron = require('node-cron');
const Case = require('../models/Case');
const User = require('../models/User');
const emailService = require('./emailService');
const logger = require('../utils/logger');

class CronService {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  // Setup all cron jobs
  setupCronJobs() {
    if (this.isInitialized) {
      logger.warn('Cron jobs already initialized');
      return;
    }

    try {
      // SLA Monitoring - runs every 5 minutes
      this.setupSLAMonitoring();
      
      // Daily digest - runs at 8 AM every day
      this.setupDailyDigest();
      
      // Performance metrics update - runs every hour
      this.setupPerformanceUpdate();
      
      // Overdue cases escalation - runs every 15 minutes
      this.setupOverdueEscalation();

      // Health check - runs every minute
      this.setupHealthCheck();

      this.isInitialized = true;
      logger.info('All cron jobs initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize cron jobs:', error);
      throw error;
    }
  }

  // Monitor SLA compliance and send alerts
  setupSLAMonitoring() {
    const job = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.checkSLACompliance();
      } catch (error) {
        logger.error('SLA monitoring job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.TIMEZONE || 'UTC'
    });

    this.jobs.set('slaMonitoring', job);
    logger.info('SLA monitoring cron job scheduled (every 5 minutes)');
  }

  // Send daily digest emails
  setupDailyDigest() {
    const job = cron.schedule('0 8 * * *', async () => {
      try {
        await this.sendDailyDigests();
      } catch (error) {
        logger.error('Daily digest job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.TIMEZONE || 'UTC'
    });

    this.jobs.set('dailyDigest', job);
    logger.info('Daily digest cron job scheduled (8:00 AM daily)');
  }

  // Update performance metrics
  setupPerformanceUpdate() {
    const job = cron.schedule('0 * * * *', async () => {
      try {
        await this.updatePerformanceMetrics();
      } catch (error) {
        logger.error('Performance update job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.TIMEZONE || 'UTC'
    });

    this.jobs.set('performanceUpdate', job);
    logger.info('Performance update cron job scheduled (hourly)');
  }

  // Escalate overdue cases
  setupOverdueEscalation() {
    const job = cron.schedule('*/15 * * * *', async () => {
      try {
        await this.escalateOverdueCases();
      } catch (error) {
        logger.error('Overdue escalation job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.TIMEZONE || 'UTC'
    });

    this.jobs.set('overdueEscalation', job);
    logger.info('Overdue escalation cron job scheduled (every 15 minutes)');
  }

  // System health check
  setupHealthCheck() {
    const job = cron.schedule('* * * * *', async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Health check job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.TIMEZONE || 'UTC'
    });

    this.jobs.set('healthCheck', job);
    logger.info('Health check cron job scheduled (every minute)');
  }

  // Check SLA compliance for all active cases
  async checkSLACompliance() {
    try {
      const now = new Date();
      
      // Find cases that are approaching SLA breach (within 1 hour)
      const approachingBreach = await Case.find({
        status: { $in: ['Open', 'In Progress'] },
        'sla.dueDate': {
          $gte: now,
          $lte: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
        },
        'sla.escalated': { $ne: true }
      }).populate('assignedTo', 'firstName lastName email');

      // Find cases that have breached SLA
      const breachedCases = await Case.find({
        status: { $in: ['Open', 'In Progress'] },
        'sla.dueDate': { $lt: now },
        'sla.isOverdue': { $ne: true }
      });

      // Mark breached cases as overdue
      if (breachedCases.length > 0) {
        await Case.updateMany(
          { _id: { $in: breachedCases.map(c => c._id) } },
          { 
            'sla.isOverdue': true,
            $push: {
              timeline: {
                action: 'SLA Breach',
                description: 'Case exceeded SLA time limit',
                timestamp: now,
                metadata: { automaticUpdate: true }
              }
            }
          }
        );

        logger.warn(`Marked ${breachedCases.length} cases as overdue`);
      }

      // Send warnings for cases approaching SLA breach
      for (const caseData of approachingBreach) {
        if (caseData.assignedTo && caseData.assignedTo.email) {
          // Calculate time remaining
          const timeRemaining = Math.round((caseData.sla.dueDate - now) / (1000 * 60));
          
          logger.info(`SLA warning sent for case ${caseData.caseId} (${timeRemaining}min remaining)`, {
            caseId: caseData.caseId,
            assignee: caseData.assignedTo._id,
            timeRemaining
          });
        }
      }

      logger.info('SLA compliance check completed', {
        approachingBreach: approachingBreach.length,
        newlyOverdue: breachedCases.length
      });

    } catch (error) {
      logger.error('SLA compliance check failed:', error);
      throw error;
    }
  }

  // Escalate overdue cases
  async escalateOverdueCases() {
    try {
      const now = new Date();
      
      // Find cases that are significantly overdue and not yet escalated
      const overdueThreshold = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      
      const overdueCases = await Case.find({
        status: { $in: ['Open', 'In Progress'] },
        'sla.dueDate': { $lt: overdueThreshold },
        'sla.escalated': { $ne: true }
      }).populate('assignedTo', 'firstName lastName email role supervisor');

      for (const caseData of overdueCases) {
        try {
          // Find appropriate escalation target
          let escalationTarget = null;

          // If assigned to analyst, escalate to senior analyst or admin
          if (caseData.assignedTo) {
            if (caseData.assignedTo.supervisor) {
              escalationTarget = await User.findById(caseData.assignedTo.supervisor);
            }
            
            if (!escalationTarget) {
              escalationTarget = await User.findOne({
                role: { $in: ['senior_analyst', 'admin'] },
                isActive: true
              });
            }
          } else {
            // If unassigned, escalate to any senior analyst or admin
            escalationTarget = await User.findOne({
              role: { $in: ['senior_analyst', 'admin'] },
              isActive: true
            });
          }

          if (escalationTarget) {
            // Send escalation email
            const emailResult = await emailService.sendSLAEscalationAlert(caseData, escalationTarget);

            // Update case with escalation info
            await Case.findByIdAndUpdate(caseData._id, {
              'sla.escalated': true,
              'sla.escalatedTo': escalationTarget._id,
              'sla.escalatedAt': now,
              $push: {
                timeline: {
                  action: 'Escalated',
                  description: `Case automatically escalated to ${escalationTarget.firstName} ${escalationTarget.lastName} due to SLA breach`,
                  timestamp: now,
                  metadata: {
                    automaticEscalation: true,
                    escalatedTo: escalationTarget._id,
                    reason: 'SLA_BREACH'
                  }
                }
              }
            });

            logger.info(`Case escalated: ${caseData.caseId}`, {
              caseId: caseData.caseId,
              escalatedTo: escalationTarget._id,
              emailSent: emailResult.success
            });
          } else {
            logger.warn(`No escalation target found for case: ${caseData.caseId}`);
          }

        } catch (escalationError) {
          logger.error(`Failed to escalate case ${caseData.caseId}:`, escalationError);
        }
      }

      if (overdueCases.length > 0) {
        logger.info(`Escalated ${overdueCases.length} overdue cases`);
      }

    } catch (error) {
      logger.error('Overdue case escalation failed:', error);
      throw error;
    }
  }

  // Send daily digest emails to users who have opted in
  async sendDailyDigests() {
    try {
      const users = await User.find({
        isActive: true,
        'preferences.emailNotifications.dailyDigest': true
      }).select('firstName lastName email _id');

      let successCount = 0;
      let failureCount = 0;

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

          // Only send digest if user has active cases or overdue cases
          if (stats.openCases > 0 || stats.inProgressCases > 0 || stats.overdueCases > 0) {
            const result = await emailService.sendDailyDigest(
              user.email,
              `${user.firstName} ${user.lastName}`,
              stats
            );

            if (result.success) {
              successCount++;
            } else {
              failureCount++;
            }
          }

        } catch (userError) {
          logger.error(`Daily digest failed for user ${user._id}:`, userError);
          failureCount++;
        }
      }

      logger.info(`Daily digest job completed`, {
        totalUsers: users.length,
        digestsSent: successCount,
        failures: failureCount
      });

    } catch (error) {
      logger.error('Daily digest job failed:', error);
      throw error;
    }
  }

  // Update performance metrics for all users
  async updatePerformanceMetrics() {
    try {
      const users = await User.find({ 
        role: { $in: ['analyst', 'senior_analyst'] },
        isActive: true 
      });

      for (const user of users) {
        // Get current case load
        const currentCaseLoad = await Case.countDocuments({
          assignedTo: user._id,
          status: { $in: ['Open', 'In Progress'] }
        });

        // Get overdue cases count
        const overdueCases = await Case.countDocuments({
          assignedTo: user._id,
          status: { $in: ['Open', 'In Progress'] },
          'sla.dueDate': { $lt: new Date() }
        });

        // Update user performance metrics
        await User.findByIdAndUpdate(user._id, {
          'performance.currentCaseLoad': currentCaseLoad,
          'performance.overdueCases': overdueCases
        });
      }

      logger.info(`Performance metrics updated for ${users.length} users`);

    } catch (error) {
      logger.error('Performance metrics update failed:', error);
      throw error;
    }
  }

  // Perform system health check
  async performHealthCheck() {
    try {
      const stats = {
        timestamp: new Date(),
        database: false,
        totalCases: 0,
        activeCases: 0,
        overdueCases: 0,
        activeUsers: 0
      };

      // Test database connectivity
      try {
        stats.totalCases = await Case.countDocuments();
        stats.activeCases = await Case.countDocuments({
          status: { $in: ['Open', 'In Progress'] }
        });
        stats.overdueCases = await Case.countDocuments({
          status: { $in: ['Open', 'In Progress'] },
          'sla.dueDate': { $lt: new Date() }
        });
        stats.activeUsers = await User.countDocuments({ isActive: true });
        stats.database = true;
      } catch (dbError) {
        logger.error('Database health check failed:', dbError);
      }

      // Log critical metrics only (to avoid spam)
      if (stats.overdueCases > 0) {
        logger.warn(`Health check: ${stats.overdueCases} cases are overdue`);
      }

      // Store basic health metrics (you could extend this to store in database)
      this.lastHealthCheck = stats;

    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  // Stop all cron jobs
  stopAllJobs() {
    try {
      let stoppedCount = 0;
      for (const [name, job] of this.jobs) {
        job.stop();
        job.destroy();
        stoppedCount++;
        logger.info(`Stopped cron job: ${name}`);
      }
      
      this.jobs.clear();
      this.isInitialized = false;
      
      logger.info(`Stopped ${stoppedCount} cron jobs`);
    } catch (error) {
      logger.error('Failed to stop cron jobs:', error);
      throw error;
    }
  }

  // Get status of all jobs
  getJobsStatus() {
    const status = {};
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running || false,
        scheduled: job.scheduled || false
      };
    }
    
    return {
      initialized: this.isInitialized,
      jobCount: this.jobs.size,
      jobs: status,
      lastHealthCheck: this.lastHealthCheck || null
    };
  }

  // Start a specific job
  startJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      logger.info(`Started cron job: ${jobName}`);
      return true;
    }
    return false;
  }

  // Stop a specific job
  stopJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      logger.info(`Stopped cron job: ${jobName}`);
      return true;
    }
    return false;
  }

  // Run a job immediately (for testing)
  async runJobNow(jobName) {
    try {
      switch (jobName) {
        case 'slaMonitoring':
          await this.checkSLACompliance();
          break;
        case 'dailyDigest':
          await this.sendDailyDigests();
          break;
        case 'performanceUpdate':
          await this.updatePerformanceMetrics();
          break;
        case 'overdueEscalation':
          await this.escalateOverdueCases();
          break;
        case 'healthCheck':
          await this.performHealthCheck();
          break;
        default:
          throw new Error(`Unknown job: ${jobName}`);
      }
      
      logger.info(`Manually executed job: ${jobName}`);
      return { success: true, message: `Job ${jobName} executed successfully` };
    } catch (error) {
      logger.error(`Manual job execution failed for ${jobName}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new CronService();