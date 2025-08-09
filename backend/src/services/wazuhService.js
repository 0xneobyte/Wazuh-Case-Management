const axios = require('axios');
const https = require('https');
const logger = require('../utils/logger');
const geoip = require('geoip-lite');

class WazuhService {
  constructor() {
    this.baseURL = process.env.WAZUH_API_URL || 'https://localhost:55000';
    this.username = process.env.WAZUH_USERNAME || 'wazuh-wui';
    this.password = process.env.WAZUH_PASSWORD || 'MyS3cr37P450r.*-';
    this.token = null;
    this.tokenExpiry = null;
    
    // Create axios instance with SSL verification disabled for development
    this.client = axios.create({
      baseURL: this.baseURL,
      httpsAgent: new https.Agent({  
        rejectUnauthorized: false // Only for development/testing
      }),
      timeout: 30000
    });
  }

  /**
   * Authenticate with Wazuh API and get JWT token
   */
  async authenticate() {
    try {
      const response = await this.client.post('/security/user/authenticate', {}, {
        auth: {
          username: this.username,
          password: this.password
        }
      });

      if (response.data && response.data.data && response.data.data.token) {
        this.token = response.data.data.token;
        // Tokens typically expire in 15 minutes, refresh before that
        this.tokenExpiry = Date.now() + (14 * 60 * 1000);
        
        // Set default authorization header
        this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
        
        logger.info('Successfully authenticated with Wazuh API');
        return true;
      } else {
        throw new Error('Invalid authentication response');
      }
    } catch (error) {
      logger.error('Wazuh authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Check if token is valid and refresh if needed
   */
  async ensureAuthenticated() {
    if (!this.token || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
  }

  /**
   * Get all alerts from Wazuh - Since no alerts exist yet, return demo data
   */
  async getAlerts(options = {}) {
    try {
      await this.ensureAuthenticated();
      
      // For now, return demo alert data since we don't have real alerts yet
      const demoAlerts = this.generateDemoAlerts(options.limit || 10);
      
      logger.info(`Generated ${demoAlerts.length} demo alerts for testing`);
      return {
        alerts: demoAlerts,
        total: demoAlerts.length
      };
      
      // TODO: Implement real alert fetching when we have agents generating data
      // const response = await this.client.get('/manager/logs', { params });
      
    } catch (error) {
      logger.error('Failed to fetch alerts from Wazuh:', error.message);
      // Return demo data even if API fails for testing purposes
      const demoAlerts = this.generateDemoAlerts(options.limit || 10);
      return {
        alerts: demoAlerts,
        total: demoAlerts.length
      };
    }
  }

  /**
   * Get alerts since last sync (using timestamp)
   */
  async getNewAlerts(lastSyncTime) {
    try {
      const filters = {};
      
      if (lastSyncTime) {
        filters.timestamp = `>${lastSyncTime.toISOString()}`;
      }

      return await this.getAlerts({
        filters,
        sort: '+timestamp'
      });
    } catch (error) {
      logger.error('Failed to fetch new alerts:', error.message);
      throw error;
    }
  }

  /**
   * Get agent information
   */
  async getAgents() {
    try {
      await this.ensureAuthenticated();
      
      const response = await this.client.get('/agents');
      
      if (response.data && response.data.data) {
        return response.data.data.affected_items || [];
      }
      
      return [];
    } catch (error) {
      logger.error('Failed to fetch agents from Wazuh:', error.message);
      throw error;
    }
  }

  /**
   * Get specific agent by ID
   */
  async getAgent(agentId) {
    try {
      await this.ensureAuthenticated();
      
      const response = await this.client.get(`/agents/${agentId}`);
      
      if (response.data && response.data.data) {
        return response.data.data.affected_items[0] || null;
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to fetch agent ${agentId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get rules information
   */
  async getRules(ruleIds = []) {
    try {
      await this.ensureAuthenticated();
      
      const params = {};
      if (ruleIds.length > 0) {
        params.rule_ids = ruleIds.join(',');
      }
      
      const response = await this.client.get('/rules', { params });
      
      if (response.data && response.data.data) {
        return response.data.data.affected_items || [];
      }
      
      return [];
    } catch (error) {
      logger.error('Failed to fetch rules from Wazuh:', error.message);
      throw error;
    }
  }

  /**
   * Transform Wazuh alert to case format
   */
  transformAlertToCase(alert) {
    try {
      // Extract source IP for geolocation
      const sourceIp = this.extractSourceIP(alert);
      const geoData = sourceIp ? geoip.lookup(sourceIp) : null;
      
      // Determine priority based on rule level
      const priority = this.determinePriority(alert.rule?.level);
      
      // Determine severity
      const severity = this.determineSeverity(alert.rule?.level);
      
      // Extract MITRE ATT&CK data if available
      const mitreData = this.extractMitreData(alert);
      
      return {
        title: alert.rule?.description || 'Security Alert',
        description: this.generateAlertDescription(alert),
        priority,
        severity,
        category: this.categorizeAlert(alert),
        sla: {}, // Initialize SLA object
        wazuhAlert: {
          alertId: alert.id,
          ruleId: alert.rule?.id,
          ruleName: alert.rule?.description,
          agentId: alert.agent?.id,
          agentName: alert.agent?.name,
          sourceIp: sourceIp,
          destinationIp: this.extractDestinationIP(alert),
          location: alert.location,
          fullLog: JSON.stringify(alert, null, 2),
          timestamp: new Date(alert.timestamp)
        },
        mitreAttack: mitreData,
        geoLocation: geoData ? {
          country: geoData.country,
          region: geoData.region,
          city: geoData.city,
          coordinates: {
            lat: geoData.ll[0],
            lng: geoData.ll[1]
          },
          riskLevel: this.assessGeoRisk(geoData, alert)
        } : null,
        timeline: [{
          action: 'Created',
          description: 'Case created from Wazuh alert',
          timestamp: new Date(),
          metadata: {
            source: 'wazuh',
            alertId: alert.id
          }
        }]
      };
    } catch (error) {
      logger.error('Error transforming alert to case:', error);
      throw error;
    }
  }

  /**
   * Extract source IP from alert data
   */
  extractSourceIP(alert) {
    // Try multiple possible fields where IP might be stored
    return alert.data?.srcip || 
           alert.data?.src_ip || 
           alert.srcip || 
           alert.SrcIP ||
           alert.data?.srcip || 
           null;
  }

  /**
   * Extract destination IP from alert data
   */
  extractDestinationIP(alert) {
    return alert.data?.dstip || 
           alert.data?.dst_ip || 
           alert.dstip || 
           alert.DstIP ||
           null;
  }

  /**
   * Determine case priority based on rule level
   */
  determinePriority(ruleLevel) {
    if (!ruleLevel) return 'P3';
    
    if (ruleLevel >= 12) return 'P1'; // Critical
    if (ruleLevel >= 7) return 'P2';  // High
    return 'P3'; // Medium/Low
  }

  /**
   * Determine case severity based on rule level
   */
  determineSeverity(ruleLevel) {
    if (!ruleLevel) return 'Low';
    
    if (ruleLevel >= 12) return 'Critical';
    if (ruleLevel >= 7) return 'High';
    if (ruleLevel >= 4) return 'Medium';
    return 'Low';
  }

  /**
   * Categorize alert based on rule groups or description
   */
  categorizeAlert(alert) {
    const groups = alert.rule?.groups || [];
    const description = (alert.rule?.description || '').toLowerCase();
    
    if (groups.includes('malware') || description.includes('malware') || description.includes('virus')) {
      return 'Malware';
    }
    if (groups.includes('intrusion') || description.includes('intrusion') || description.includes('attack')) {
      return 'Intrusion';
    }
    if (groups.includes('policy') || description.includes('policy') || description.includes('violation')) {
      return 'Policy Violation';
    }
    if (groups.includes('vulnerability') || description.includes('vulnerability') || description.includes('cve')) {
      return 'Vulnerability';
    }
    
    return 'Other';
  }

  /**
   * Extract MITRE ATT&CK data from alert
   */
  extractMitreData(alert) {
    const mitreData = {
      tactics: [],
      techniques: [],
      subTechniques: []
    };

    // Check if alert has MITRE data
    if (alert.rule?.mitre) {
      mitreData.tactics = alert.rule.mitre.tactic || [];
      mitreData.techniques = alert.rule.mitre.id || [];
    }

    return mitreData;
  }

  /**
   * Generate alert description
   */
  generateAlertDescription(alert) {
    let description = alert.rule?.description || 'Security alert detected';
    
    if (alert.agent?.name) {
      description += ` on agent ${alert.agent.name}`;
    }
    
    if (alert.location) {
      description += ` at location ${alert.location}`;
    }
    
    const sourceIp = this.extractSourceIP(alert);
    if (sourceIp) {
      description += ` from IP ${sourceIp}`;
    }
    
    return description;
  }

  /**
   * Assess geographic risk level
   */
  assessGeoRisk(geoData, alert) {
    // This is a simplified risk assessment - you can enhance this logic
    const highRiskCountries = ['CN', 'RU', 'KP', 'IR']; // Example list
    
    if (highRiskCountries.includes(geoData.country)) {
      return 'High';
    }
    
    const ruleLevel = alert.rule?.level || 0;
    if (ruleLevel >= 10) return 'Critical';
    if (ruleLevel >= 7) return 'High';
    if (ruleLevel >= 4) return 'Medium';
    
    return 'Low';
  }

  /**
   * Generate demo alerts for testing
   */
  generateDemoAlerts(count = 10) {
    const demoAlerts = [];
    const currentTime = new Date();
    
    const demoTemplates = [
      {
        rule: { id: '5710', level: 5, description: 'SSH authentication failed' },
        location: 'sshd',
        srcip: '192.168.1.100',
        groups: ['authentication_failed', 'sshd']
      },
      {
        rule: { id: '31100', level: 12, description: 'Multiple failed login attempts from same IP' },
        location: 'auth.log',
        srcip: '10.0.0.50',
        groups: ['authentication_failures', 'multiple_drops']
      },
      {
        rule: { id: '18101', level: 8, description: 'Windows logon failure' },
        location: 'WinEvt-Security',
        srcip: '172.16.0.25',
        groups: ['windows', 'authentication_failed']
      },
      {
        rule: { id: '2902', level: 3, description: 'New user added' },
        location: '/var/log/auth.log',
        srcip: '127.0.0.1',
        groups: ['adduser', 'account_changed']
      },
      {
        rule: { id: '40111', level: 7, description: 'Antivirus signature database is outdated' },
        location: 'antivirus.log',
        groups: ['av', 'pci_dss_11.5']
      }
    ];
    
    for (let i = 0; i < count; i++) {
      const template = demoTemplates[i % demoTemplates.length];
      const alertTime = new Date(currentTime.getTime() - (i * 300000)); // 5 minutes apart
      
      const alert = {
        id: `demo-alert-${Date.now()}-${i}`,
        timestamp: alertTime.toISOString(),
        rule: template.rule,
        agent: {
          id: '000',
          name: 'wazuh.manager',
          ip: '127.0.0.1'
        },
        location: template.location,
        data: {
          srcip: template.srcip,
          dstip: template.dstip || null
        },
        srcip: template.srcip,
        full_log: `Demo alert ${i + 1} - ${template.rule.description}`,
        decoder: { name: 'demo-decoder' },
        groups: template.groups
      };
      
      demoAlerts.push(alert);
    }
    
    return demoAlerts;
  }

  /**
   * Test connection to Wazuh API
   */
  async testConnection() {
    try {
      await this.authenticate();
      
      // Try to fetch a small number of alerts
      const result = await this.getAlerts({ limit: 1 });
      
      logger.info('Wazuh API connection test successful');
      return {
        success: true,
        message: 'Connected to Wazuh API successfully',
        alertsAvailable: result.total
      };
    } catch (error) {
      logger.error('Wazuh API connection test failed:', error.message);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = new WazuhService();