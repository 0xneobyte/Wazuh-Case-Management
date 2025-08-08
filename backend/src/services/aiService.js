const { OpenAI } = require('openai');
const logger = require('../utils/logger');
const Case = require('../models/Case');

class AIService {
  constructor() {
    this.openai = null;
    this.isConfigured = false;
    this.initializeOpenAI();
  }

  initializeOpenAI() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        logger.warn('OpenAI API key not configured. AI features will be disabled.');
        return;
      }

      this.openai = new OpenAI({
        apiKey: apiKey,
      });

      this.isConfigured = true;
      logger.info('AI service (OpenAI) configured successfully');

    } catch (error) {
      logger.error('Failed to initialize AI service:', error);
      this.isConfigured = false;
    }
  }

  async makeOpenAIRequest(messages, options = {}) {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'AI service not configured'
      };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.3,
        ...options
      });

      return {
        success: true,
        response: response.choices[0].message.content,
        usage: response.usage
      };

    } catch (error) {
      logger.error('OpenAI API request failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate remediation suggestions based on case details
  async getRemediationSuggestions(caseData, additionalContext = '', user) {
    try {
      const caseContext = this.buildCaseContext(caseData);
      
      const messages = [
        {
          role: 'system',
          content: `You are a cybersecurity expert assistant helping analysts with incident response. 
          Provide practical, actionable remediation steps based on the case details. 
          Focus on immediate containment, investigation, and recovery actions.
          Format your response as a JSON array of remediation steps, each with 'step', 'priority', and 'description' fields.
          Priority should be 'Critical', 'High', 'Medium', or 'Low'.`
        },
        {
          role: 'user',
          content: `Please provide remediation suggestions for this security case:

${caseContext}

${additionalContext ? `Additional Context: ${additionalContext}` : ''}

Please provide specific, actionable steps that a security analyst can follow.`
        }
      ];

      const result = await this.makeOpenAIRequest(messages, {
        maxTokens: 1500,
        temperature: 0.2
      });

      if (!result.success) {
        return result;
      }

      try {
        const suggestions = JSON.parse(result.response);
        return {
          success: true,
          suggestions: Array.isArray(suggestions) ? suggestions : [],
          usage: result.usage
        };
      } catch (parseError) {
        // If JSON parsing fails, return as text
        return {
          success: true,
          suggestions: [{ 
            step: 'Review AI Suggestions', 
            priority: 'Medium',
            description: result.response 
          }],
          usage: result.usage
        };
      }

    } catch (error) {
      logger.error('Failed to generate remediation suggestions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Analyze case and map to MITRE ATT&CK framework
  async getMitreAnalysis(caseData, user) {
    try {
      const caseContext = this.buildCaseContext(caseData);

      const messages = [
        {
          role: 'system',
          content: `You are a MITRE ATT&CK framework expert. Analyze security incidents and map them to MITRE ATT&CK tactics and techniques.
          Provide your response as JSON with the following structure:
          {
            "mitreMapping": {
              "tactics": ["tactic1", "tactic2"],
              "techniques": ["T1234", "T5678"],
              "subTechniques": ["T1234.001", "T5678.002"]
            },
            "complianceChecks": [
              {
                "framework": "MITRE ATT&CK",
                "requirements": ["requirement1", "requirement2"],
                "status": "compliant" | "non-compliant" | "partial"
              }
            ],
            "analysis": "Detailed analysis explanation"
          }`
        },
        {
          role: 'user',
          content: `Analyze this security case and map it to MITRE ATT&CK framework:

${caseContext}

Please provide the MITRE ATT&CK mapping and compliance analysis.`
        }
      ];

      const result = await this.makeOpenAIRequest(messages, {
        maxTokens: 1500,
        temperature: 0.1
      });

      if (!result.success) {
        return result;
      }

      try {
        const analysis = JSON.parse(result.response);
        return {
          success: true,
          mitreMapping: analysis.mitreMapping,
          complianceChecks: analysis.complianceChecks,
          analysis: analysis.analysis,
          usage: result.usage
        };
      } catch (parseError) {
        return {
          success: true,
          analysis: result.response,
          usage: result.usage
        };
      }

    } catch (error) {
      logger.error('Failed to perform MITRE analysis:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate executive summary for non-technical stakeholders
  async generateExecutiveSummary(caseData, options = {}, user) {
    try {
      const caseContext = this.buildCaseContext(caseData);
      const audienceLevel = options.audienceLevel || 'executive';
      const includeRecommendations = options.includeRecommendations !== false;

      const audienceGuidance = {
        executive: 'non-technical executives focused on business impact',
        technical: 'technical stakeholders who understand security concepts',
        mixed: 'mixed audience of both technical and non-technical stakeholders'
      };

      const messages = [
        {
          role: 'system',
          content: `You are an expert security analyst creating executive summaries. 
          Create clear, concise summaries for ${audienceGuidance[audienceLevel]}.
          Focus on business impact, risk level, and current status.
          Avoid technical jargon for executive audiences.
          Structure your response with: Executive Summary, Impact Assessment, Current Status, and ${includeRecommendations ? 'Recommendations' : 'Next Steps'}.`
        },
        {
          role: 'user',
          content: `Create an executive summary for this security case:

${caseContext}

Audience: ${audienceLevel}
Include recommendations: ${includeRecommendations}

Please provide a clear, ${audienceLevel === 'executive' ? 'business-focused' : 'technical'} summary.`
        }
      ];

      const result = await this.makeOpenAIRequest(messages, {
        maxTokens: 2000,
        temperature: 0.3
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        summary: result.response,
        generatedFor: audienceLevel,
        includesRecommendations: includeRecommendations,
        usage: result.usage
      };

    } catch (error) {
      logger.error('Failed to generate executive summary:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Assess risk level of a case
  async assessCaseRisk(caseData, user) {
    try {
      const caseContext = this.buildCaseContext(caseData);

      const messages = [
        {
          role: 'system',
          content: `You are a cybersecurity risk analyst. Assess the risk level of security incidents.
          Consider factors like: attack sophistication, potential impact, affected systems, data sensitivity, and threat indicators.
          Provide response as JSON:
          {
            "riskLevel": "Critical" | "High" | "Medium" | "Low",
            "riskScore": 1-10,
            "riskFactors": ["factor1", "factor2"],
            "businessImpact": "description",
            "recommendations": ["rec1", "rec2"]
          }`
        },
        {
          role: 'user',
          content: `Assess the risk level for this security case:

${caseContext}

Provide a comprehensive risk assessment with justification.`
        }
      ];

      const result = await this.makeOpenAIRequest(messages, {
        maxTokens: 1000,
        temperature: 0.2
      });

      if (!result.success) {
        return result;
      }

      try {
        const assessment = JSON.parse(result.response);
        return {
          success: true,
          riskLevel: assessment.riskLevel,
          riskScore: assessment.riskScore,
          riskFactors: assessment.riskFactors || [],
          businessImpact: assessment.businessImpact,
          recommendations: assessment.recommendations || [],
          usage: result.usage
        };
      } catch (parseError) {
        return {
          success: true,
          analysis: result.response,
          usage: result.usage
        };
      }

    } catch (error) {
      logger.error('Failed to assess case risk:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Suggest case categorization
  async suggestCategorization(caseData, user) {
    try {
      const caseContext = this.buildCaseContext(caseData);
      const availableCategories = ['Malware', 'Intrusion', 'Policy Violation', 'Vulnerability', 'Other'];

      const messages = [
        {
          role: 'system',
          content: `You are a security incident classifier. Analyze cases and suggest the most appropriate category.
          Available categories: ${availableCategories.join(', ')}
          
          Provide response as JSON:
          {
            "suggestedCategory": "category_name",
            "confidence": 0.0-1.0,
            "reasoning": "explanation",
            "alternativeCategories": ["alt1", "alt2"]
          }`
        },
        {
          role: 'user',
          content: `Analyze this security case and suggest the most appropriate category:

${caseContext}

Current category: ${caseData.category}

Please suggest the best category with reasoning.`
        }
      ];

      const result = await this.makeOpenAIRequest(messages, {
        maxTokens: 800,
        temperature: 0.1
      });

      if (!result.success) {
        return result;
      }

      try {
        const categorization = JSON.parse(result.response);
        return {
          success: true,
          suggestedCategory: categorization.suggestedCategory,
          confidence: categorization.confidence,
          reasoning: categorization.reasoning,
          alternativeCategories: categorization.alternativeCategories || [],
          currentCategory: caseData.category,
          usage: result.usage
        };
      } catch (parseError) {
        return {
          success: true,
          analysis: result.response,
          usage: result.usage
        };
      }

    } catch (error) {
      logger.error('Failed to suggest categorization:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Find similar cases using AI analysis
  async findSimilarCases(caseData, limit = 5, user) {
    try {
      // First, find similar cases using basic criteria
      const query = {
        _id: { $ne: caseData._id },
        $or: [
          { category: caseData.category },
          { severity: caseData.severity },
          { priority: caseData.priority }
        ]
      };

      // Add Wazuh-specific matching
      if (caseData.wazuhAlert?.ruleId) {
        query.$or.push({ 'wazuhAlert.ruleId': caseData.wazuhAlert.ruleId });
      }

      if (caseData.wazuhAlert?.sourceIp) {
        query.$or.push({ 'wazuhAlert.sourceIp': caseData.wazuhAlert.sourceIp });
      }

      const similarCases = await Case.find(query)
        .populate('assignedTo', 'firstName lastName')
        .populate('resolution.resolvedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(limit * 2) // Get more cases for AI filtering
        .select('caseId title description category severity priority status resolution createdAt wazuhAlert');

      if (similarCases.length === 0) {
        return {
          success: true,
          cases: [],
          analysis: 'No similar cases found in the database.'
        };
      }

      // Use AI to analyze and rank similarity
      const currentCaseContext = this.buildCaseContext(caseData);
      const casesContext = similarCases.map(c => 
        `Case ${c.caseId}: ${c.title} (${c.category}, ${c.severity})`
      ).join('\n');

      const messages = [
        {
          role: 'system',
          content: `You are analyzing case similarities for incident response. 
          Rank the provided cases by similarity to the current case.
          Consider: attack vectors, indicators, impact, and resolution patterns.
          
          Provide response as JSON:
          {
            "rankedCases": [
              {
                "caseId": "CASE-ID",
                "similarityScore": 0.0-1.0,
                "similarityReasons": ["reason1", "reason2"]
              }
            ],
            "analysis": "Overall similarity analysis"
          }`
        },
        {
          role: 'user',
          content: `Current Case:
${currentCaseContext}

Similar Cases to Rank:
${casesContext}

Please rank these cases by similarity and provide analysis.`
        }
      ];

      const result = await this.makeOpenAIRequest(messages, {
        maxTokens: 1500,
        temperature: 0.2
      });

      if (!result.success) {
        // Fallback: return cases without AI ranking
        return {
          success: true,
          cases: similarCases.slice(0, limit),
          analysis: 'Similar cases found using basic matching criteria.',
          aiRanking: false
        };
      }

      try {
        const aiAnalysis = JSON.parse(result.response);
        
        // Match AI rankings with actual cases
        const rankedCases = aiAnalysis.rankedCases
          .map(ranked => {
            const caseData = similarCases.find(c => c.caseId === ranked.caseId);
            return caseData ? {
              ...caseData.toObject(),
              similarityScore: ranked.similarityScore,
              similarityReasons: ranked.similarityReasons
            } : null;
          })
          .filter(Boolean)
          .slice(0, limit);

        return {
          success: true,
          cases: rankedCases,
          analysis: aiAnalysis.analysis,
          aiRanking: true,
          usage: result.usage
        };

      } catch (parseError) {
        return {
          success: true,
          cases: similarCases.slice(0, limit),
          analysis: result.response,
          aiRanking: false,
          usage: result.usage
        };
      }

    } catch (error) {
      logger.error('Failed to find similar cases:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Test AI service connection
  async testConnection() {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'AI service not configured'
      };
    }

    try {
      const messages = [
        {
          role: 'system',
          content: 'You are a test assistant. Respond with "OK" if you receive this message.'
        },
        {
          role: 'user',
          content: 'Test connection'
        }
      ];

      const result = await this.makeOpenAIRequest(messages, {
        maxTokens: 10,
        temperature: 0
      });

      return {
        success: result.success,
        message: result.success ? 'AI service connection successful' : result.error,
        response: result.response,
        usage: result.usage
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get AI service status
  async getServiceStatus() {
    return {
      configured: this.isConfigured,
      provider: 'OpenAI',
      model: 'gpt-3.5-turbo',
      features: {
        remediationSuggestions: this.isConfigured,
        mitreAnalysis: this.isConfigured,
        executiveSummary: this.isConfigured,
        riskAssessment: this.isConfigured,
        categorization: this.isConfigured,
        similarCases: this.isConfigured
      }
    };
  }

  // Build case context for AI prompts
  buildCaseContext(caseData) {
    let context = `Case ID: ${caseData.caseId}
Title: ${caseData.title}
Description: ${caseData.description}
Priority: ${caseData.priority}
Severity: ${caseData.severity}
Category: ${caseData.category}
Status: ${caseData.status}
Created: ${caseData.createdAt}`;

    // Add Wazuh alert information if available
    if (caseData.wazuhAlert) {
      context += `

Wazuh Alert Information:
- Rule: ${caseData.wazuhAlert.ruleName || 'Unknown'}
- Rule ID: ${caseData.wazuhAlert.ruleId || 'Unknown'}
- Agent: ${caseData.wazuhAlert.agentName || 'Unknown'} (${caseData.wazuhAlert.agentId || 'Unknown'})
- Source IP: ${caseData.wazuhAlert.sourceIp || 'Unknown'}
- Location: ${caseData.wazuhAlert.location || 'Unknown'}
- Timestamp: ${caseData.wazuhAlert.timestamp || 'Unknown'}`;
    }

    // Add geolocation if available
    if (caseData.geoLocation) {
      context += `

Geographic Information:
- Country: ${caseData.geoLocation.country || 'Unknown'}
- Region: ${caseData.geoLocation.region || 'Unknown'}
- City: ${caseData.geoLocation.city || 'Unknown'}
- Risk Level: ${caseData.geoLocation.riskLevel || 'Unknown'}`;
    }

    // Add MITRE ATT&CK information if available
    if (caseData.mitreAttack && (caseData.mitreAttack.tactics?.length > 0 || caseData.mitreAttack.techniques?.length > 0)) {
      context += `

MITRE ATT&CK Mapping:
- Tactics: ${caseData.mitreAttack.tactics?.join(', ') || 'None'}
- Techniques: ${caseData.mitreAttack.techniques?.join(', ') || 'None'}`;
    }

    // Add recent comments if available
    if (caseData.comments && caseData.comments.length > 0) {
      const recentComments = caseData.comments
        .slice(-3) // Get last 3 comments
        .map(comment => `- ${comment.content}`)
        .join('\n');
      
      context += `

Recent Comments:
${recentComments}`;
    }

    return context;
  }
}

module.exports = new AIService();