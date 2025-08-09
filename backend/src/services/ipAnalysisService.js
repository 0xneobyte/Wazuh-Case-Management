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
   * Get threat intelligence from AbuseIPDB using REPORTS endpoint
   */
  async getAbuseData(ip) {
    try {
      // First get basic check data
      const [checkResponse, reportsResponse] = await Promise.all([
        axios.get(`https://api.abuseipdb.com/api/v2/check`, {
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
        }),
        // Get detailed reports (first 25 most recent)
        axios.get(`https://api.abuseipdb.com/api/v2/reports`, {
          params: {
            ipAddress: ip,
            maxAgeInDays: 90,
            page: 1,
            perPage: 25
          },
          headers: {
            'Key': this.abuseIPDB,
            'Accept': 'application/json'
          },
          timeout: 15000
        })
      ]);

      const checkData = checkResponse.data.data;
      const reportsData = reportsResponse.data.data;
      
      // Process reports for enhanced intelligence
      const reports = reportsData.results || [];
      const categoryStats = this.processReportCategories(reports);
      const reporterCountries = this.processReporterCountries(reports);
      const recentReports = reports.slice(0, 10); // Top 10 most recent

      return {
        abuseConfidence: checkData.abuseConfidenceScore || 0,
        usageType: checkData.usageType || 'Unknown',
        isWhitelisted: checkData.isWhitelisted || false,
        countryMatch: checkData.countryMatch || false,
        totalReports: checkData.totalReports || 0,
        numDistinctUsers: checkData.numDistinctUsers || 0,
        lastReportedAt: checkData.lastReportedAt || null,
        domain: checkData.domain || null,
        isTor: checkData.isTor || false,
        // Enhanced data from REPORTS endpoint
        totalPages: reportsData.lastPage || 0,
        recentReports: recentReports,
        categoryBreakdown: categoryStats,
        reporterCountries: reporterCountries
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
        domain: null,
        isTor: false,
        totalPages: 0,
        recentReports: [],
        categoryBreakdown: {},
        reporterCountries: []
      };
    }
  }

  /**
   * Process report categories to get attack type statistics
   */
  processReportCategories(reports) {
    const categoryMap = {
      1: 'DNS Compromise',
      2: 'DNS Poisoning', 
      3: 'Fraud Orders',
      4: 'DDoS Attack',
      5: 'FTP Brute-Force',
      6: 'Ping of Death',
      7: 'Phishing',
      8: 'Fraud VoIP',
      9: 'Open Proxy',
      10: 'Web Spam',
      11: 'Email Spam',
      12: 'Blog Spam',
      13: 'VPN IP',
      14: 'Port Scan',
      15: 'Hacking',
      16: 'SQL Injection',
      17: 'Spoofing',
      18: 'Brute Force',
      19: 'Bad Web Bot',
      20: 'Exploited Host',
      21: 'Web App Attack',
      22: 'SSH',
      23: 'IoT Targeted'
    };

    const categoryStats = {};
    
    reports.forEach(report => {
      report.categories.forEach(categoryId => {
        const categoryName = categoryMap[categoryId] || `Category ${categoryId}`;
        categoryStats[categoryName] = (categoryStats[categoryName] || 0) + 1;
      });
    });

    return categoryStats;
  }

  /**
   * Process reporter countries for geographic distribution
   */
  processReporterCountries(reports) {
    const countryStats = {};
    
    reports.forEach(report => {
      const country = report.reporterCountryName || 'Unknown';
      if (!countryStats[country]) {
        countryStats[country] = {
          name: country,
          code: report.reporterCountryCode || 'XX',
          count: 0
        };
      }
      countryStats[country].count++;
    });

    // Return top 10 countries sorted by report count
    return Object.values(countryStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
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

    // Enhanced total reports factor with category analysis
    if (abuseData.totalReports >= 50) {
      score += 25;
      reasons.push('High volume of abuse reports (50+)');
    } else if (abuseData.totalReports >= 10) {
      score += 15;
      reasons.push('Multiple abuse reports (10+)');
    } else if (abuseData.totalReports >= 5) {
      score += 8;
      reasons.push('Several abuse reports');
    }

    // Category-specific risk factors
    const categoryBreakdown = abuseData.categoryBreakdown || {};
    if (categoryBreakdown['SSH'] || categoryBreakdown['Brute Force']) {
      score += 10;
      reasons.push('SSH/Brute force attack history');
    }
    if (categoryBreakdown['DDoS Attack']) {
      score += 15;
      reasons.push('DDoS attack source');
    }
    if (categoryBreakdown['Hacking'] || categoryBreakdown['Web App Attack']) {
      score += 12;
      reasons.push('Web application attack history');
    }
    if (categoryBreakdown['Phishing']) {
      score += 10;
      reasons.push('Phishing activity detected');
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
      
      // Specific recommendations based on attack categories
      const categoryBreakdown = abuseData.categoryBreakdown || {};
      const topCategories = Object.keys(categoryBreakdown)
        .sort((a, b) => categoryBreakdown[b] - categoryBreakdown[a])
        .slice(0, 3);
        
      if (topCategories.length > 0) {
        recommendations.push(`🎯 Top attack types: ${topCategories.join(', ')}`);
      }
      
      // Recent activity check
      const recentReports = abuseData.recentReports || [];
      if (recentReports.length > 0) {
        const latestReport = recentReports[0];
        const reportDate = new Date(latestReport.reportedAt).toLocaleDateString();
        recommendations.push(`🕐 Latest report: ${reportDate} - ${latestReport.comment?.substring(0, 100)}...`);
      }
      
      // Reporter geographic distribution
      const reporterCountries = abuseData.reporterCountries || [];
      if (reporterCountries.length > 0) {
        const topReporter = reporterCountries[0];
        recommendations.push(`🌍 Most reports from: ${topReporter.name} (${topReporter.count} reports)`);
      }
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
        // Enhanced threat intelligence from REPORTS endpoint
        threatIntelligence: {
          totalPages: abuseData.totalPages,
          categoryBreakdown: abuseData.categoryBreakdown,
          reporterCountries: abuseData.reporterCountries,
          recentReports: abuseData.recentReports
        },
        recommendations: recommendations,
        dataSource: {
          geolocation: 'IPGeolocation.io',
          threatIntel: 'AbuseIPDB (CHECK + REPORTS)'
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