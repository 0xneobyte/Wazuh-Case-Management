const mongoose = require('mongoose');
const logger = require('../utils/logger');
const Case = require('../models/Case');
const User = require('../models/User');
const emailService = require('./emailService');

// Demo Alert Schema (we'll create a collection for demo alerts)
const demoAlertSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  source: { type: String, required: true },
  severity: { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], required: true },
  category: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  sourceIP: { type: String, required: true },
  targetIP: { type: String },
  rule: {
    id: { type: String, required: true },
    name: { type: String, required: true }
  },
  tags: [{ type: String }],
  status: { type: String, enum: ['new', 'investigating', 'resolved'], default: 'new' },
  rawData: { type: Object } // For storing additional demo data
}, {
  collection: 'demo_alerts',
  timestamps: true
});

const DemoAlert = mongoose.model('DemoAlert', demoAlertSchema);

class DemoSiemService {
  /**
   * Generate demo alerts with realistic security scenarios
   */
  async generateDemoAlerts() {
    const demoScenarios = [
      // Brute Force Attacks
      {
        source: 'SSH Monitor',
        severity: 'High',
        category: 'Authentication',
        title: 'SSH Brute Force Attack Detected',
        description: 'Multiple failed SSH authentication attempts from suspicious IP address',
        sourceIP: '192.168.1.100',
        targetIP: '10.0.0.5',
        rule: { id: 'SSH-001', name: 'SSH Brute Force Detection' },
        tags: ['ssh', 'brute-force', 'authentication', 'linux'],
        rawData: {
          failedAttempts: 47,
          usernames: ['root', 'admin', 'user', 'test'],
          protocol: 'SSH-2.0',
          port: 22
        }
      },
      // Malware Detection
      {
        source: 'Endpoint Security',
        severity: 'Critical',
        category: 'Malware',
        title: 'Trojan.Win32.Agent Detected',
        description: 'Malicious executable detected and quarantined on endpoint',
        sourceIP: '10.0.0.15',
        rule: { id: 'MAL-002', name: 'Malware Signature Detection' },
        tags: ['malware', 'trojan', 'windows', 'quarantined'],
        rawData: {
          fileName: 'update_manager.exe',
          filePath: 'C:\\Users\\john\\Downloads\\update_manager.exe',
          fileHash: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
          virusName: 'Trojan.Win32.Agent.xyz',
          action: 'quarantined'
        }
      },
      // Network Intrusion
      {
        source: 'Network IDS',
        severity: 'High',
        category: 'Network Security',
        title: 'Port Scan Activity Detected',
        description: 'Systematic port scanning activity detected from external source',
        sourceIP: '203.0.113.45',
        targetIP: '10.0.0.0/24',
        rule: { id: 'NET-003', name: 'Port Scan Detection' },
        tags: ['port-scan', 'reconnaissance', 'external', 'network'],
        rawData: {
          portsScanned: 1024,
          scanType: 'TCP SYN Scan',
          duration: '00:15:32',
          openPorts: [22, 80, 443, 3389],
          scanPattern: 'sequential'
        }
      },
      // Phishing Attempt
      {
        source: 'Email Security',
        severity: 'Medium',
        category: 'Email Security',
        title: 'Phishing Email Blocked',
        description: 'Suspicious email with phishing indicators blocked before delivery',
        sourceIP: '198.51.100.78',
        rule: { id: 'EMAIL-004', name: 'Phishing Detection' },
        tags: ['phishing', 'email', 'blocked', 'social-engineering'],
        rawData: {
          sender: 'security@bank-update.com',
          subject: 'Urgent: Verify Your Account Information',
          recipient: 'john.doe@company.com',
          attachments: ['account_verification.zip'],
          phishingScore: 87,
          blockedReason: 'suspicious_domain'
        }
      },
      // Data Exfiltration
      {
        source: 'DLP System',
        severity: 'Critical',
        category: 'Data Loss Prevention',
        title: 'Sensitive Data Exfiltration Attempt',
        description: 'Large volume of sensitive data being uploaded to external cloud service',
        sourceIP: '10.0.0.25',
        targetIP: '157.240.241.35',
        rule: { id: 'DLP-005', name: 'Data Exfiltration Detection' },
        tags: ['data-loss', 'exfiltration', 'cloud-upload', 'sensitive-data'],
        rawData: {
          dataVolume: '2.3 GB',
          fileTypes: ['pdf', 'docx', 'xlsx'],
          sensitivePatterns: ['SSN', 'Credit Card', 'Personal Info'],
          destination: 'dropbox.com',
          action: 'blocked'
        }
      },
      // Privilege Escalation
      {
        source: 'Windows Event Log',
        severity: 'High',
        category: 'Privilege Escalation',
        title: 'Suspicious Privilege Escalation',
        description: 'User account gained administrative privileges through unusual method',
        sourceIP: '10.0.0.12',
        rule: { id: 'PRIV-006', name: 'Privilege Escalation Detection' },
        tags: ['privilege-escalation', 'windows', 'admin-rights', 'suspicious'],
        rawData: {
          username: 'marketing_user',
          previousRole: 'Standard User',
          newRole: 'Local Administrator',
          method: 'UAC Bypass',
          processName: 'powershell.exe'
        }
      },
      // Web Application Attack
      {
        source: 'Web Application Firewall',
        severity: 'Medium',
        category: 'Web Security',
        title: 'SQL Injection Attempt Blocked',
        description: 'Malicious SQL injection payload detected in web request',
        sourceIP: '203.0.113.67',
        targetIP: '10.0.0.30',
        rule: { id: 'WEB-007', name: 'SQL Injection Detection' },
        tags: ['sql-injection', 'web-attack', 'blocked', 'database'],
        rawData: {
          url: '/api/users/search',
          method: 'POST',
          payload: "'; DROP TABLE users; --",
          userAgent: 'Mozilla/5.0 (compatible; Sqlmap/1.0)',
          blocked: true,
          riskScore: 95
        }
      },
      // Insider Threat
      {
        source: 'User Behavior Analytics',
        severity: 'Medium',
        category: 'Insider Threat',
        title: 'Abnormal User Activity Pattern',
        description: 'Employee accessing files outside normal working hours and role',
        sourceIP: '10.0.0.18',
        rule: { id: 'UBA-008', name: 'Anomalous User Behavior' },
        tags: ['insider-threat', 'anomalous-behavior', 'after-hours', 'data-access'],
        rawData: {
          username: 'jane.smith',
          department: 'Marketing',
          normalHours: '09:00-17:00',
          accessTime: '23:45',
          filesAccessed: ['financial_reports.xlsx', 'employee_salaries.pdf'],
          anomalyScore: 78
        }
      },
      // Denial of Service
      {
        source: 'Network Monitor',
        severity: 'High',
        category: 'Network Security',
        title: 'Distributed Denial of Service Attack',
        description: 'High volume of traffic from multiple sources overwhelming server',
        sourceIP: 'Multiple',
        targetIP: '10.0.0.1',
        rule: { id: 'DOS-009', name: 'DDoS Attack Detection' },
        tags: ['ddos', 'network', 'traffic-spike', 'availability'],
        rawData: {
          requestsPerSecond: 15000,
          normalBaseline: 150,
          sourceCount: 47,
          attackDuration: '00:08:23',
          targetService: 'Web Server',
          mitigationActive: true
        }
      },
      // Ransomware Activity
      {
        source: 'File Integrity Monitor',
        severity: 'Critical',
        category: 'Ransomware',
        title: 'Ransomware Encryption Activity',
        description: 'Rapid file encryption patterns consistent with ransomware attack',
        sourceIP: '10.0.0.22',
        rule: { id: 'RAN-010', name: 'Ransomware Detection' },
        tags: ['ransomware', 'file-encryption', 'malware', 'critical'],
        rawData: {
          filesEncrypted: 1247,
          encryptionRate: '23 files/second',
          fileExtensions: ['.docx', '.pdf', '.jpg', '.xlsx'],
          ransomwareFamily: 'Locky',
          recoveryPossible: false,
          isolationStatus: 'quarantined'
        }
      }
    ];

    const alerts = [];
    const now = new Date();

    for (let i = 0; i < demoScenarios.length; i++) {
      const scenario = demoScenarios[i];
      
      // Create alerts with varying timestamps (last 7 days)
      const alertTime = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      
      const alert = new DemoAlert({
        ...scenario,
        timestamp: alertTime,
        status: Math.random() > 0.7 ? 'new' : (Math.random() > 0.5 ? 'investigating' : 'resolved')
      });

      alerts.push(alert);
    }

    return alerts;
  }

  /**
   * Get all demo alerts from database
   */
  async getDemoAlerts() {
    try {
      const alerts = await DemoAlert.find({})
        .sort({ timestamp: -1 })
        .limit(100);
      
      return alerts;
    } catch (error) {
      logger.error('Failed to fetch demo alerts:', error);
      throw new Error('Failed to fetch demo alerts');
    }
  }

  /**
   * Get demo SIEM statistics
   */
  async getDemoStats() {
    try {
      const totalAlerts = await DemoAlert.countDocuments({});
      
      const severityStats = await DemoAlert.aggregate([
        {
          $group: {
            _id: '$severity',
            count: { $sum: 1 }
          }
        }
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const alertsToday = await DemoAlert.countDocuments({
        timestamp: { $gte: today }
      });

      const stats = {
        totalAlerts,
        criticalAlerts: severityStats.find(s => s._id === 'Critical')?.count || 0,
        highAlerts: severityStats.find(s => s._id === 'High')?.count || 0,
        mediumAlerts: severityStats.find(s => s._id === 'Medium')?.count || 0,
        lowAlerts: severityStats.find(s => s._id === 'Low')?.count || 0,
        alertsToday,
        lastSync: new Date().toISOString()
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get demo stats:', error);
      throw new Error('Failed to get demo statistics');
    }
  }

  /**
   * Sync (generate/refresh) demo alerts and auto-create cases for high-severity alerts
   */
  async syncDemoAlerts() {
    try {
      // Clear existing demo alerts
      await DemoAlert.deleteMany({});
      
      // Generate new demo alerts
      const demoAlerts = await this.generateDemoAlerts();
      
      // Insert demo alerts
      const insertedAlerts = await DemoAlert.insertMany(demoAlerts);
      
      logger.info(`Generated ${insertedAlerts.length} demo alerts`);
      
      // Get all analysts for random assignment
      const analysts = await User.find({ 
        role: 'analyst', 
        isActive: true 
      }).select('_id firstName lastName email');
      
      if (analysts.length === 0) {
        logger.warn('No active analysts found for case assignment');
      }
      
      // Auto-create cases for Critical and High severity alerts
      const highSeverityAlerts = insertedAlerts.filter(alert => 
        alert.severity === 'Critical' || alert.severity === 'High'
      );
      
      const createdCases = [];
      const progress = {
        total: highSeverityAlerts.length,
        processed: 0
      };
      
      for (const alert of highSeverityAlerts) {
        try {
          // Randomly assign to an analyst
          const randomAnalyst = analysts.length > 0 ? 
            analysts[Math.floor(Math.random() * analysts.length)] : null;
          
          const caseResult = await this.createCaseFromAlert(alert._id, randomAnalyst?._id);
          createdCases.push({
            caseId: caseResult.caseId,
            alertId: alert._id,
            assignedTo: randomAnalyst,
            severity: alert.severity
          });
          
          // Send email notification if analyst is assigned
          if (randomAnalyst) {
            try {
              await this.sendCaseAssignmentEmail(randomAnalyst, caseResult, alert);
            } catch (emailError) {
              logger.error(`Failed to send email to ${randomAnalyst.email}:`, emailError);
              // Don't let email failures block the process
            }
          }
          
          progress.processed++;
        } catch (caseError) {
          logger.error(`Failed to create case for alert ${alert._id}:`, caseError);
        }
      }
      
      const result = {
        alertsCreated: insertedAlerts.length,
        casesAutoCreated: createdCases.length,
        categories: [...new Set(insertedAlerts.map(a => a.category))],
        severityDistribution: {
          Critical: insertedAlerts.filter(a => a.severity === 'Critical').length,
          High: insertedAlerts.filter(a => a.severity === 'High').length,
          Medium: insertedAlerts.filter(a => a.severity === 'Medium').length,
          Low: insertedAlerts.filter(a => a.severity === 'Low').length
        },
        autoCreatedCases: createdCases
      };
      
      logger.info(`Auto-created ${createdCases.length} cases from high-severity alerts`);
      
      return result;
    } catch (error) {
      logger.error('Failed to sync demo alerts:', error);
      throw new Error('Failed to sync demo alerts');
    }
  }

  /**
   * Create a case from a demo alert
   */
  async createCaseFromAlert(alertId, userId) {
    try {
      const alert = await DemoAlert.findById(alertId);
      if (!alert) {
        throw new Error('Demo alert not found');
      }

      // Generate case ID
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const randomNum = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
      const caseId = `CASE-${dateStr}-${randomNum}`;

      // Create case from alert data - using correct Case model structure
      const caseData = {
        caseId: caseId,
        title: `[DEMO] ${alert.title}`,
        description: `Demo case created from SIEM alert.\n\n${alert.description}\n\nSource IP: ${alert.sourceIP}\nTarget IP: ${alert.targetIP || 'N/A'}\nRule: ${alert.rule.name} (${alert.rule.id})\nCategory: ${alert.category}`,
        priority: this.mapSeverityToPriority(alert.severity),
        status: 'Open', // Using correct enum value
        severity: this.mapSeverityToSeverity(alert.severity),
        category: this.mapCategoryToEnum(alert.category),
        assignedTo: userId,
        assignedAt: new Date(),
        // Store demo alert data in wazuhAlert field for compatibility
        wazuhAlert: {
          alertId: alertId,
          ruleId: alert.rule.id,
          ruleName: alert.rule.name,
          sourceIp: alert.sourceIP,
          destinationIp: alert.targetIP,
          location: alert.source,
          fullLog: JSON.stringify(alert.rawData || {}),
          timestamp: alert.timestamp
        }
      };

      const newCase = new Case(caseData);
      const savedCase = await newCase.save();

      // Update alert status to investigating
      alert.status = 'investigating';
      await alert.save();

      logger.info(`Created case ${savedCase._id} from demo alert ${alertId}`);

      return {
        caseId: savedCase._id,
        caseTitle: savedCase.title,
        alertId: alertId
      };
    } catch (error) {
      logger.error('Failed to create case from demo alert:', error);
      throw new Error('Failed to create case from alert');
    }
  }

  /**
   * Map alert severity to case priority
   */
  mapSeverityToPriority(severity) {
    switch (severity) {
      case 'Critical':
        return 'P1';
      case 'High':
        return 'P2';
      case 'Medium':
      case 'Low':
        return 'P3';
      default:
        return 'P3';
    }
  }

  /**
   * Map alert severity to case severity (using Case model enum)
   */
  mapSeverityToSeverity(severity) {
    switch (severity) {
      case 'Critical':
        return 'Critical';
      case 'High':
        return 'High';
      case 'Medium':
        return 'Medium';
      case 'Low':
        return 'Low';
      default:
        return 'Medium';
    }
  }

  /**
   * Map alert category to case category (using Case model enum)
   */
  mapCategoryToEnum(category) {
    switch (category.toLowerCase()) {
      case 'malware':
      case 'ransomware':
        return 'Malware';
      case 'network security':
      case 'authentication':
      case 'intrusion':
        return 'Intrusion';
      case 'data loss prevention':
      case 'insider threat':
        return 'Policy Violation';
      case 'web security':
      case 'privilege escalation':
        return 'Vulnerability';
      default:
        return 'Other';
    }
  }

  /**
   * Send case assignment email notification
   */
  async sendCaseAssignmentEmail(analyst, caseResult, alert) {
    try {
      // Check if email service is available
      if (!emailService.isConfigured) {
        logger.warn(`Email service not configured. Skipping email notification to ${analyst.email}`);
        return { success: false, error: 'Email service not configured' };
      }

      const emailData = {
        to: analyst.email,
        subject: `🚨 New Security Case Assigned: ${caseResult.caseTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">🛡️ New Security Case Assignment</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">SENTRYA Case Management System</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
              <p>Hello ${analyst.firstName},</p>
              
              <p>A new security case has been automatically assigned to you based on a <strong>${alert.severity}</strong> severity alert.</p>
              
              <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #dc3545; margin: 16px 0;">
                <h3 style="margin: 0 0 12px 0; color: #dc3545;">${alert.title}</h3>
                <p style="margin: 0 0 8px 0; color: #666;"><strong>Description:</strong> ${alert.description}</p>
                <p style="margin: 0 0 8px 0; color: #666;"><strong>Source IP:</strong> ${alert.sourceIP}</p>
                <p style="margin: 0 0 8px 0; color: #666;"><strong>Category:</strong> ${alert.category}</p>
                <p style="margin: 0 0 8px 0; color: #666;"><strong>Rule:</strong> ${alert.rule.name} (${alert.rule.id})</p>
                <p style="margin: 0; color: #666;"><strong>Timestamp:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
              </div>
              
              <div style="background: white; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <h4 style="margin: 0 0 8px 0; color: #333;">📋 Next Steps:</h4>
                <ol style="margin: 0; padding-left: 20px; color: #666;">
                  <li>Review the case details in the SENTRYA dashboard</li>
                  <li>Analyze the security alert and evidence</li>
                  <li>Begin investigation and containment procedures</li>
                  <li>Update case status as you progress</li>
                  <li>Document findings and remediation actions</li>
                </ol>
              </div>
              
              <div style="text-align: center; margin: 20px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/cases/${caseResult.caseId}" 
                   style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  🔍 View Case Details
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 20px; border-top: 1px solid #e9ecef; padding-top: 16px;">
                This is an automated notification from SENTRYA Case Management System.<br>
                If you have any questions, please contact your supervisor or IT support team.
              </p>
            </div>
          </div>
        `
      };

      const result = await emailService.sendEmail(emailData.to, emailData.subject, emailData.html);
      
      if (result.success) {
        logger.info(`Case assignment email sent to ${analyst.email} for case ${caseResult.caseId}`);
      } else {
        logger.warn(`Failed to send case assignment email to ${analyst.email}: ${result.error}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Failed to send case assignment email to ${analyst.email}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new DemoSiemService();