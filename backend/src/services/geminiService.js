const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    
    if (!this.apiKey) {
      logger.warn('Gemini API key not configured. AI assistant features will be disabled.');
      this.genAI = null;
      this.model = null;
      return;
    }
    
    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
      logger.info('Gemini AI service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Gemini AI service:', error);
      this.genAI = null;
      this.model = null;
    }
  }

  /**
   * Check if Gemini service is available
   */
  isAvailable() {
    return this.model !== null;
  }

  /**
   * Generate remediation suggestions for a security case
   */
  async generateRemediationSuggestions(caseData) {
    if (!this.isAvailable()) {
      throw new Error('Gemini AI service is not available');
    }

    try {
      const prompt = this.buildRemediationPrompt(caseData);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      logger.info(`Generated remediation suggestions for case ${caseData.caseId}`);
      
      return {
        suggestions: this.parseRemediationResponse(text),
        rawResponse: text,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error(`Failed to generate remediation suggestions for case ${caseData.caseId}:`, error);
      throw new Error('Failed to generate AI remediation suggestions');
    }
  }

  /**
   * Generate an executive summary for a case
   */
  async generateExecutiveSummary(caseData) {
    if (!this.isAvailable()) {
      throw new Error('Gemini AI service is not available');
    }

    try {
      const prompt = this.buildExecutiveSummaryPrompt(caseData);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      logger.info(`Generated executive summary for case ${caseData.caseId}`);
      
      return {
        summary: text,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error(`Failed to generate executive summary for case ${caseData.caseId}:`, error);
      throw new Error('Failed to generate AI executive summary');
    }
  }

  /**
   * Generate compliance analysis for a case
   */
  async generateComplianceAnalysis(caseData) {
    if (!this.isAvailable()) {
      throw new Error('Gemini AI service is not available');
    }

    try {
      const prompt = this.buildCompliancePrompt(caseData);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      logger.info(`Generated compliance analysis for case ${caseData.caseId}`);
      
      return {
        analysis: this.parseComplianceResponse(text),
        rawResponse: text,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error(`Failed to generate compliance analysis for case ${caseData.caseId}:`, error);
      throw new Error('Failed to generate AI compliance analysis');
    }
  }

  /**
   * Generate a comprehensive PDF report for a case
   */
  async generatePDFReportData(caseData) {
    if (!this.isAvailable()) {
      throw new Error('Gemini AI service is not available');
    }

    try {
      const [remediation, summary, compliance] = await Promise.all([
        this.generateRemediationSuggestions(caseData),
        this.generateExecutiveSummary(caseData),
        this.generateComplianceAnalysis(caseData)
      ]);

      return {
        case: caseData,
        remediation,
        executiveSummary: summary,
        compliance,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error(`Failed to generate PDF report data for case ${caseData.caseId}:`, error);
      throw new Error('Failed to generate AI report data');
    }
  }

  /**
   * Build remediation suggestions prompt
   */
  buildRemediationPrompt(caseData) {
    return `You are a cybersecurity expert AI assistant analyzing a security incident case. Please provide detailed remediation suggestions.

**Case Information:**
- Case ID: ${caseData.caseId}
- Title: ${caseData.title}
- Description: ${caseData.description}
- Severity: ${caseData.severity}
- Priority: ${caseData.priority}
- Category: ${caseData.category}
- Status: ${caseData.status}

**Technical Details:**
${caseData.wazuhAlert ? `
- Source IP: ${caseData.wazuhAlert.sourceIp || 'N/A'}
- Destination IP: ${caseData.wazuhAlert.destinationIp || 'N/A'}
- Rule ID: ${caseData.wazuhAlert.ruleId || 'N/A'}
- Rule Name: ${caseData.wazuhAlert.ruleName || 'N/A'}
- Agent: ${caseData.wazuhAlert.agentName || 'N/A'}
- Location: ${caseData.wazuhAlert.location || 'N/A'}
` : ''}

**Timeline:**
${caseData.timeline ? caseData.timeline.map(t => `- ${t.action}: ${t.description} (${new Date(t.timestamp).toLocaleString()})`).join('\n') : 'No timeline available'}

Please provide:

1. **IMMEDIATE ACTIONS** (critical steps to take right now):
   - List 3-5 urgent containment steps
   - Include specific commands or procedures where applicable

2. **SHORT-TERM REMEDIATION** (within 24-48 hours):
   - Detailed investigation steps
   - Evidence collection procedures
   - System hardening measures

3. **LONG-TERM PREVENTION** (ongoing security improvements):
   - Policy recommendations
   - Monitoring enhancements
   - Training suggestions

4. **RISK ASSESSMENT**:
   - Current threat level
   - Potential business impact
   - Likelihood of reoccurrence

Format your response with clear headings and bullet points. Be specific and actionable.`;
  }

  /**
   * Build executive summary prompt
   */
  buildExecutiveSummaryPrompt(caseData) {
    return `You are writing an executive summary for a security incident case for senior leadership. Keep it concise but comprehensive.

**Case Information:**
- Case ID: ${caseData.caseId}
- Title: ${caseData.title}
- Description: ${caseData.description}
- Severity: ${caseData.severity}
- Priority: ${caseData.priority}
- Category: ${caseData.category}
- Status: ${caseData.status}
- Created: ${new Date(caseData.createdAt).toLocaleString()}
- Assigned to: ${caseData.assignedTo ? 'Security Analyst' : 'Unassigned'}

**Technical Context:**
${caseData.wazuhAlert ? `
- Affected Systems: ${caseData.wazuhAlert.agentName || 'Unknown'}
- Source of Alert: ${caseData.wazuhAlert.location || 'N/A'}
- Detection Rule: ${caseData.wazuhAlert.ruleName || 'N/A'}
` : ''}

Write a professional executive summary (2-3 paragraphs) that includes:

1. **What happened**: Brief description of the security incident
2. **Impact and Risk**: Potential business impact and risk level
3. **Current Status**: What's been done and next steps
4. **Timeline**: Key dates and expected resolution

Use business language appropriate for C-level executives. Focus on business impact rather than technical details.`;
  }

  /**
   * Build compliance analysis prompt
   */
  buildCompliancePrompt(caseData) {
    return `Analyze this security incident case for compliance implications across major frameworks.

**Case Information:**
- Case ID: ${caseData.caseId}
- Title: ${caseData.title}
- Description: ${caseData.description}
- Severity: ${caseData.severity}
- Category: ${caseData.category}

**Analysis Required:**
Please analyze compliance implications for these frameworks:

1. **NIST Cybersecurity Framework**:
   - Which functions are relevant (Identify, Protect, Detect, Respond, Recover)
   - Specific controls that apply
   - Compliance status

2. **MITRE ATT&CK Framework**:
   - Relevant tactics and techniques
   - Attack vectors involved
   - Recommended mitigations

3. **ISO 27001**:
   - Applicable controls from Annex A
   - Information security management implications
   - Process improvement recommendations

4. **Regulatory Compliance** (if applicable):
   - GDPR implications (if data involved)
   - SOX considerations (if financial systems)
   - HIPAA requirements (if healthcare data)
   - Industry-specific requirements

Format as:
- Framework Name
  - Status: Compliant/Non-Compliant/Under Review
  - Requirements: List specific requirements
  - Recommendations: Actions needed for compliance

Be specific and cite actual control numbers where possible.`;
  }

  /**
   * Parse remediation response into structured format
   */
  parseRemediationResponse(text) {
    const sections = text.split(/(?=#{1,2}\s|\*\*[A-Z\s]+\*\*|\d+\.\s*\*\*[A-Z\s]+\*\*)/);
    
    const suggestions = [];
    let currentCategory = 'General';
    
    sections.forEach(section => {
      if (section.trim()) {
        const lines = section.split('\n').filter(line => line.trim());
        const firstLine = lines[0];
        
        // Check if this is a category header
        if (firstLine.includes('IMMEDIATE') || firstLine.includes('ACTIONS')) {
          currentCategory = 'Immediate Actions';
        } else if (firstLine.includes('SHORT-TERM') || firstLine.includes('REMEDIATION')) {
          currentCategory = 'Short-term Remediation';
        } else if (firstLine.includes('LONG-TERM') || firstLine.includes('PREVENTION')) {
          currentCategory = 'Long-term Prevention';
        } else if (firstLine.includes('RISK') || firstLine.includes('ASSESSMENT')) {
          currentCategory = 'Risk Assessment';
        }
        
        // Extract bullet points
        const bulletPoints = lines
          .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
          .map(line => line.replace(/^[-•]\s*/, '').trim())
          .filter(point => point.length > 0);
        
        if (bulletPoints.length > 0) {
          suggestions.push({
            category: currentCategory,
            items: bulletPoints
          });
        }
      }
    });
    
    return suggestions;
  }

  /**
   * Parse compliance response into structured format
   */
  parseComplianceResponse(text) {
    const frameworks = [];
    const sections = text.split(/(?=\d+\.\s*\*\*|#{1,3}\s|\*\*[A-Z][^*]+\*\*)/);
    
    sections.forEach(section => {
      if (section.trim()) {
        const lines = section.split('\n').filter(line => line.trim());
        const firstLine = lines[0];
        
        let frameworkName = 'Unknown';
        if (firstLine.includes('NIST')) frameworkName = 'NIST Cybersecurity Framework';
        else if (firstLine.includes('MITRE')) frameworkName = 'MITRE ATT&CK';
        else if (firstLine.includes('ISO')) frameworkName = 'ISO 27001';
        else if (firstLine.includes('Regulatory')) frameworkName = 'Regulatory Compliance';
        
        const requirements = [];
        const recommendations = [];
        let status = 'Under Review';
        
        lines.forEach(line => {
          if (line.includes('Status:')) {
            const statusMatch = line.match(/Status:\s*([\w\s/-]+)/);
            if (statusMatch) status = statusMatch[1].trim();
          } else if (line.trim().startsWith('-') && line.includes('Requirements:') === false) {
            const item = line.replace(/^[-•]\s*/, '').trim();
            if (line.includes('Recommend') || line.includes('Action')) {
              recommendations.push(item);
            } else {
              requirements.push(item);
            }
          }
        });
        
        if (frameworkName !== 'Unknown' && (requirements.length > 0 || recommendations.length > 0)) {
          frameworks.push({
            framework: frameworkName,
            status,
            requirements,
            recommendations
          });
        }
      }
    });
    
    return frameworks;
  }
}

module.exports = new GeminiService();