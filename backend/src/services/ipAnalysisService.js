const axios = require('axios');
const logger = require('../utils/logger');

class IPAnalysisService {
  constructor() {
    this.ipGeoAPI = process.env.IPGEOLOCATION_API_KEY || 'demo-key';
    this.abuseIPDB = process.env.ABUSEIPDB_API_KEY || 'demo-key';
  }

  /**
   * Validate IP address format
   */
  validateIP(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Get geolocation data from IPGeolocation.io
   */
  async getGeolocationData(ip) {
    try {
      const response = await axios.get(`https://api.ipgeolocation.io/ipgeo`, {
        params: {
          apiKey: this.ipGeoAPI,
          ip: ip
        },
        timeout: 10000
      });

      const data = response.data;
      
      return {
        country: data.country_name || 'Unknown',
        countryCode: data.country_code2 || 'XX',
        region: data.state_prov || 'Unknown',
        city: data.city || 'Unknown',
        zipCode: data.zipcode || null,
        coordinates: {
          lat: parseFloat(data.latitude) || 0,
          lng: parseFloat(data.longitude) || 0
        },
        timezone: data.time_zone?.name || 'Unknown',
        isp: data.isp || 'Unknown',
        organization: data.organization || 'Unknown',
        asn: data.asn || null,
        connectionType: data.connection_type || 'Unknown',
        // Threat data will come from AbuseIPDB instead
        isVPN: false,
        isTor: false,
        isProxy: false,
        isAnonymous: false,
        threatTypes: []
      };
    } catch (error) {
      logger.error('IPGeolocation API error:', error.message);
      throw new Error('Failed to fetch geolocation data');
    }
  }

  /**
   * Get threat intelligence from AbuseIPDB
   */
  async getAbuseData(ip) {
    try {
      const response = await axios.get(`https://api.abuseipdb.com/api/v2/check`, {
        params: {
          ipAddress: ip,
          maxAgeInDays: 90,
          verbose: ''
        },
        headers: {
          'Key': this.abuseIPDB,
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const data = response.data.data;
      
      return {
        abuseConfidence: data.abuseConfidenceScore || 0,
        usageType: data.usageType || 'Unknown',
        isWhitelisted: data.isWhitelisted || false,
        countryMatch: data.countryMatch || false,
        totalReports: data.totalReports || 0,
        numDistinctUsers: data.numDistinctUsers || 0,
        lastReportedAt: data.lastReportedAt || null,
        domain: data.domain || null,
        isTor: data.isTor || false
      };
    } catch (error) {
      logger.error('AbuseIPDB API error:', error.message);
      // Return default safe values if API fails
      return {
        abuseConfidence: 0,
        usageType: 'Unknown',
        isWhitelisted: false,
        countryMatch: true,
        totalReports: 0,
        numDistinctUsers: 0,
        lastReportedAt: null,
        domain: null
      };
    }
  }

  /**
   * Calculate overall risk score and level
   */
  calculateRiskScore(geoData, abuseData) {
    let score = 0;
    let reasons = [];

    // Abuse confidence factor (0-100)
    if (abuseData.abuseConfidence >= 75) {
      score += 40;
      reasons.push('High abuse confidence score');
    } else if (abuseData.abuseConfidence >= 25) {
      score += 20;
      reasons.push('Moderate abuse reports');
    } else if (abuseData.abuseConfidence >= 5) {
      score += 10;
      reasons.push('Some abuse reports');
    }

    // Tor detection from AbuseIPDB
    if (abuseData.isTor) {
      score += 30;
      reasons.push('Tor network usage');
    }
    
    // Note: VPN/Proxy detection not available with current API plans
    // Could be enhanced with additional threat intelligence sources

    // High-risk countries (example list)
    const highRiskCountries = ['CN', 'RU', 'KP', 'IR'];
    if (highRiskCountries.includes(geoData.countryCode)) {
      score += 15;
      reasons.push('High-risk geographical location');
    }

    // Total reports factor
    if (abuseData.totalReports >= 10) {
      score += 15;
      reasons.push('Multiple abuse reports');
    } else if (abuseData.totalReports >= 5) {
      score += 8;
      reasons.push('Several abuse reports');
    }

    // Determine risk level
    let riskLevel = 'Low';
    let riskColor = 'green';
    
    if (score >= 70) {
      riskLevel = 'Critical';
      riskColor = 'red';
    } else if (score >= 50) {
      riskLevel = 'High';
      riskColor = 'orange';
    } else if (score >= 25) {
      riskLevel = 'Medium';
      riskColor = 'yellow';
    }

    return {
      score: Math.min(score, 100), // Cap at 100
      level: riskLevel,
      color: riskColor,
      reasons: reasons
    };
  }

  /**
   * Generate analyst recommendations
   */
  generateRecommendations(riskScore, geoData, abuseData) {
    const recommendations = [];

    if (riskScore.score >= 70) {
      recommendations.push('🚨 IMMEDIATE ACTION: Consider blocking this IP address');
      recommendations.push('📝 Create a high-priority security case');
      recommendations.push('🔍 Investigate all recent connections from this IP');
    } else if (riskScore.score >= 50) {
      recommendations.push('⚠️ HIGH RISK: Monitor this IP closely');
      recommendations.push('📋 Consider creating a security case');
      recommendations.push('🔍 Review logs for suspicious activity');
    } else if (riskScore.score >= 25) {
      recommendations.push('⚡ MEDIUM RISK: Enhanced monitoring recommended');
      recommendations.push('📊 Review connection patterns');
      recommendations.push('⏰ Set up alerts for future activity');
    } else {
      recommendations.push('✅ LOW RISK: Standard monitoring sufficient');
      recommendations.push('📈 Continue normal logging');
    }

    // Specific recommendations based on data
    if (abuseData.isTor) {
      recommendations.push('🌐 Tor usage detected - consider policy enforcement');
    }
    if (abuseData.totalReports > 0) {
      recommendations.push(`📊 Has ${abuseData.totalReports} abuse reports - investigate history`);
    }

    return recommendations;
  }

  /**
   * Analyze IP address - main method
   */
  async analyzeIP(ip) {
    try {
      if (!this.validateIP(ip)) {
        throw new Error('Invalid IP address format');
      }

      logger.info(`Analyzing IP: ${ip}`);

      // Fetch data from both APIs in parallel
      const [geoData, abuseData] = await Promise.all([
        this.getGeolocationData(ip),
        this.getAbuseData(ip)
      ]);

      // Calculate risk score
      const riskScore = this.calculateRiskScore(geoData, abuseData);

      // Generate recommendations
      const recommendations = this.generateRecommendations(riskScore, geoData, abuseData);

      const analysis = {
        ip: ip,
        timestamp: new Date().toISOString(),
        geolocation: {
          country: geoData.country,
          countryCode: geoData.countryCode,
          region: geoData.region,
          city: geoData.city,
          zipCode: geoData.zipCode,
          coordinates: geoData.coordinates,
          timezone: geoData.timezone
        },
        network: {
          isp: geoData.isp,
          organization: geoData.organization,
          asn: geoData.asn,
          connectionType: geoData.connectionType,
          usageType: abuseData.usageType,
          domain: abuseData.domain
        },
        security: {
          riskScore: riskScore.score,
          riskLevel: riskScore.level,
          riskColor: riskScore.color,
          riskReasons: riskScore.reasons,
          abuseConfidence: abuseData.abuseConfidence,
          totalReports: abuseData.totalReports,
          lastReported: abuseData.lastReportedAt,
          isVPN: false, // Not available with current APIs
          isTor: abuseData.isTor,
          isProxy: false, // Not available with current APIs  
          isAnonymous: false, // Not available with current APIs
          isWhitelisted: abuseData.isWhitelisted,
          threatTypes: geoData.threatTypes
        },
        recommendations: recommendations,
        dataSource: {
          geolocation: 'IPGeolocation.io',
          threatIntel: 'AbuseIPDB'
        }
      };

      logger.info(`IP analysis completed for ${ip}:`, {
        riskLevel: riskScore.level,
        riskScore: riskScore.score,
        country: geoData.country,
        abuseConfidence: abuseData.abuseConfidence
      });

      return analysis;

    } catch (error) {
      logger.error(`IP analysis failed for ${ip}:`, error);
      throw error;
    }
  }
}

module.exports = new IPAnalysisService();