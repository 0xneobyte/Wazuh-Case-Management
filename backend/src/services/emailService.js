const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Email configuration from environment variables
      const emailConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      };

      // Check if email is configured
      if (
        !emailConfig.host ||
        !emailConfig.auth.user ||
        !emailConfig.auth.pass
      ) {
        logger.warn(
          "Email service not configured. Email notifications will be disabled."
        );
        return;
      }

      this.transporter = nodemailer.createTransport(emailConfig);
      this.isConfigured = true;

      // Verify connection configuration
      this.transporter.verify((error, success) => {
        if (error) {
          logger.error("Email service configuration error:", error);
          this.isConfigured = false;
        } else {
          logger.info("Email service configured successfully");
        }
      });
    } catch (error) {
      logger.error("Failed to initialize email service:", error);
      this.isConfigured = false;
    }
  }

  async sendEmail(to, subject, htmlContent, textContent = null) {
    if (!this.isConfigured) {
      logger.warn("Email service not configured, skipping email send");
      return { success: false, error: "Email service not configured" };
    }

    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: Array.isArray(to) ? to.join(", ") : to,
        subject,
        html: htmlContent,
        text: textContent || this.stripHtml(htmlContent),
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info("Email sent successfully", {
        to: mailOptions.to,
        subject,
        messageId: info.messageId,
      });

      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error("Failed to send email:", error);
      return { success: false, error: error.message };
    }
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, "");
  }

  generateEmailHeader() {
    return `
      <div style="background-color: #f8f9fa; padding: 20px; font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🛡️ Wazuh Case Management System</h1>
          </div>
          <div style="padding: 30px;">
    `;
  }

  generateEmailFooter() {
    return `
          </div>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">This is an automated message from the Wazuh Case Management System.</p>
            <p style="margin: 5px 0 0 0;">Please do not reply to this email.</p>
          </div>
        </div>
      </div>
    `;
  }

  // Case Assignment Notification
  async sendCaseAssignmentNotification(caseData) {
    if (!caseData.assignedTo || !caseData.assignedTo.email) {
      logger.warn("Cannot send assignment notification: no assignee email");
      return { success: false, error: "No assignee email" };
    }

    const subject = `🚨 New Case Assigned: ${caseData.caseId} [${caseData.priority}]`;

    const priorityColors = {
      P1: "#dc2626", // Red
      P2: "#f59e0b", // Amber
      P3: "#10b981", // Green
    };

    const severityIcons = {
      Critical: "🔴",
      High: "🟠",
      Medium: "🟡",
      Low: "🟢",
    };

    const htmlContent =
      this.generateEmailHeader() +
      `
      <h2 style="color: #1f2937; margin-top: 0;">New Case Assignment</h2>
      
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #374151;">Case Details</h3>
        <p style="margin: 5px 0;"><strong>Case ID:</strong> ${
          caseData.caseId
        }</p>
        <p style="margin: 5px 0;"><strong>Title:</strong> ${caseData.title}</p>
        <p style="margin: 5px 0;"><strong>Priority:</strong> 
          <span style="background-color: ${
            priorityColors[caseData.priority] || "#6b7280"
          }; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
            ${caseData.priority}
          </span>
        </p>
        <p style="margin: 5px 0;"><strong>Severity:</strong> ${
          severityIcons[caseData.severity] || "⚪"
        } ${caseData.severity}</p>
        <p style="margin: 5px 0;"><strong>Category:</strong> ${
          caseData.category
        }</p>
        <p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(
          caseData.sla.dueDate
        ).toLocaleString()}</p>
      </div>

      <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #92400e;">Description</h4>
        <p style="margin: 0; color: #92400e;">${caseData.description}</p>
      </div>

      ${
        caseData.wazuhAlert
          ? `
      <div style="background-color: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #1e40af;">Wazuh Alert Information</h4>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Rule:</strong> ${
          caseData.wazuhAlert.ruleName || "Unknown"
        }</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Agent:</strong> ${
          caseData.wazuhAlert.agentName || "Unknown"
        }</p>
        ${
          caseData.wazuhAlert.sourceIp
            ? `<p style="margin: 5px 0; font-size: 14px;"><strong>Source IP:</strong> ${caseData.wazuhAlert.sourceIp}</p>`
            : ""
        }
        <p style="margin: 5px 0; font-size: 14px;"><strong>Timestamp:</strong> ${new Date(
          caseData.wazuhAlert.timestamp
        ).toLocaleString()}</p>
      </div>
      `
          : ""
      }

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}/cases/${caseData._id}" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          View Case Details
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        Please review this case and take appropriate action within the SLA timeframe.
      </p>
    ` +
      this.generateEmailFooter();

    return await this.sendEmail(
      caseData.assignedTo.email,
      subject,
      htmlContent
    );
  }

  // Case Status Update Notification
  async sendCaseStatusUpdateNotification(caseData, previousStatus, updatedBy) {
    const recipients = [];

    // Notify assignee
    if (caseData.assignedTo && caseData.assignedTo.email) {
      recipients.push(caseData.assignedTo.email);
    }

    // Notify creator if different from updater
    if (
      caseData.assignedBy &&
      caseData.assignedBy.email &&
      caseData.assignedBy._id.toString() !== updatedBy._id.toString()
    ) {
      recipients.push(caseData.assignedBy.email);
    }

    if (recipients.length === 0) {
      return { success: false, error: "No recipients for status update" };
    }

    const subject = `📋 Case Status Updated: ${caseData.caseId} - ${previousStatus} → ${caseData.status}`;

    const statusColors = {
      Open: "#6b7280",
      "In Progress": "#2563eb",
      Resolved: "#059669",
      Closed: "#374151",
    };

    const htmlContent =
      this.generateEmailHeader() +
      `
      <h2 style="color: #1f2937; margin-top: 0;">Case Status Update</h2>
      
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #374151;">Case Information</h3>
        <p style="margin: 5px 0;"><strong>Case ID:</strong> ${
          caseData.caseId
        }</p>
        <p style="margin: 5px 0;"><strong>Title:</strong> ${caseData.title}</p>
        <p style="margin: 5px 0;"><strong>Previous Status:</strong> 
          <span style="background-color: ${
            statusColors[previousStatus] || "#6b7280"
          }; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
            ${previousStatus}
          </span>
        </p>
        <p style="margin: 5px 0;"><strong>New Status:</strong> 
          <span style="background-color: ${
            statusColors[caseData.status] || "#6b7280"
          }; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
            ${caseData.status}
          </span>
        </p>
        <p style="margin: 5px 0;"><strong>Updated By:</strong> ${
          updatedBy.firstName
        } ${updatedBy.lastName}</p>
        <p style="margin: 5px 0;"><strong>Updated At:</strong> ${new Date().toLocaleString()}</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}/cases/${caseData._id}" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          View Case Details
        </a>
      </div>
    ` +
      this.generateEmailFooter();

    const results = [];
    for (const email of recipients) {
      const result = await this.sendEmail(email, subject, htmlContent);
      results.push({ email, ...result });
    }

    return { success: true, results };
  }

  // Case Closure Notification (to Admin)
  async sendCaseClosureNotification(caseData, resolvedBy) {
    // Find admin users to notify
    const User = require("../models/User");
    const adminUsers = await User.find({
      role: "admin",
      isActive: true,
    }).select("email");

    if (adminUsers.length === 0) {
      return { success: false, error: "No admin users to notify" };
    }

    const adminEmails = adminUsers.map((user) => user.email);
    const subject = `✅ Case Closed: ${caseData.caseId} - ${caseData.title}`;

    const resolutionTime = caseData.resolution?.resolvedAt
      ? Math.round(
          (new Date(caseData.resolution.resolvedAt) -
            new Date(caseData.createdAt)) /
            (1000 * 60 * 60)
        )
      : 0;

    const htmlContent =
      this.generateEmailHeader() +
      `
      <h2 style="color: #1f2937; margin-top: 0;">Case Closed</h2>
      
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #374151;">Case Summary</h3>
        <p style="margin: 5px 0;"><strong>Case ID:</strong> ${
          caseData.caseId
        }</p>
        <p style="margin: 5px 0;"><strong>Title:</strong> ${caseData.title}</p>
        <p style="margin: 5px 0;"><strong>Priority:</strong> ${
          caseData.priority
        }</p>
        <p style="margin: 5px 0;"><strong>Category:</strong> ${
          caseData.category
        }</p>
        <p style="margin: 5px 0;"><strong>Resolved By:</strong> ${
          resolvedBy.firstName
        } ${resolvedBy.lastName}</p>
        <p style="margin: 5px 0;"><strong>Resolution Time:</strong> ${resolutionTime} hours</p>
        <p style="margin: 5px 0;"><strong>Created:</strong> ${new Date(
          caseData.createdAt
        ).toLocaleString()}</p>
        <p style="margin: 5px 0;"><strong>Closed:</strong> ${new Date().toLocaleString()}</p>
      </div>

      ${
        caseData.resolution?.summary
          ? `
      <div style="background-color: #ecfdf5; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #065f46;">Resolution Summary</h4>
        <p style="margin: 0; color: #065f46;">${caseData.resolution.summary}</p>
      </div>
      `
          : ""
      }

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}/cases/${caseData._id}" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          View Case Details
        </a>
      </div>
    ` +
      this.generateEmailFooter();

    const results = [];
    for (const email of adminEmails) {
      const result = await this.sendEmail(email, subject, htmlContent);
      results.push({ email, ...result });
    }

    return { success: true, results };
  }

  // SLA Escalation Alert
  async sendSLAEscalationAlert(caseData, escalatedTo) {
    if (!escalatedTo || !escalatedTo.email) {
      return { success: false, error: "No escalation recipient email" };
    }

    const subject = `🚨 SLA ESCALATION: ${caseData.caseId} - Overdue Case Requires Attention`;

    const hoursOverdue = Math.round(
      (new Date() - new Date(caseData.sla.dueDate)) / (1000 * 60 * 60)
    );

    const htmlContent =
      this.generateEmailHeader() +
      `
      <h2 style="color: #dc2626; margin-top: 0;">⚠️ SLA ESCALATION ALERT</h2>
      
      <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 20px 0;">
        <p style="margin: 0; color: #dc2626; font-weight: bold; font-size: 16px;">
          This case is overdue by ${hoursOverdue} hours and requires immediate attention.
        </p>
      </div>

      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #374151;">Case Details</h3>
        <p style="margin: 5px 0;"><strong>Case ID:</strong> ${
          caseData.caseId
        }</p>
        <p style="margin: 5px 0;"><strong>Title:</strong> ${caseData.title}</p>
        <p style="margin: 5px 0;"><strong>Priority:</strong> 
          <span style="background-color: #dc2626; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">
            ${caseData.priority}
          </span>
        </p>
        <p style="margin: 5px 0;"><strong>Current Status:</strong> ${
          caseData.status
        }</p>
        <p style="margin: 5px 0;"><strong>Assigned To:</strong> ${
          caseData.assignedTo?.firstName || "Unassigned"
        } ${caseData.assignedTo?.lastName || ""}</p>
        <p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(
          caseData.sla.dueDate
        ).toLocaleString()}</p>
        <p style="margin: 5px 0;"><strong>Created:</strong> ${new Date(
          caseData.createdAt
        ).toLocaleString()}</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}/cases/${caseData._id}" 
           style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          REVIEW CASE IMMEDIATELY
        </a>
      </div>

      <p style="color: #dc2626; font-size: 14px; margin-top: 30px; font-weight: bold;">
        This case requires immediate review and action to maintain SLA compliance.
      </p>
    ` +
      this.generateEmailFooter();

    return await this.sendEmail(escalatedTo.email, subject, htmlContent);
  }

  // Daily Digest Email
  async sendDailyDigest(userEmail, userName, stats) {
    const subject = `📊 Daily Case Management Digest - ${new Date().toLocaleDateString()}`;

    const htmlContent =
      this.generateEmailHeader() +
      `
      <h2 style="color: #1f2937; margin-top: 0;">Good morning, ${userName}!</h2>
      <p style="color: #6b7280; margin-bottom: 30px;">Here's your daily case management summary:</p>
      
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #374151;">Your Case Statistics</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div style="text-align: center;">
            <div style="font-size: 28px; font-weight: bold; color: #2563eb;">${
              stats.openCases || 0
            }</div>
            <div style="font-size: 14px; color: #6b7280;">Open Cases</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 28px; font-weight: bold; color: #f59e0b;">${
              stats.inProgressCases || 0
            }</div>
            <div style="font-size: 14px; color: #6b7280;">In Progress</div>
          </div>
        </div>
      </div>

      ${
        stats.overdueCases > 0
          ? `
      <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #dc2626;">⚠️ Attention Required</h4>
        <p style="margin: 0; color: #dc2626;">You have <strong>${stats.overdueCases}</strong> overdue case(s) that need immediate attention.</p>
      </div>
      `
          : ""
      }

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}/dashboard" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          View Dashboard
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        Have a productive day! 🚀
      </p>
    ` +
      this.generateEmailFooter();

    return await this.sendEmail(userEmail, subject, htmlContent);
  }

  // Test email functionality
  async sendTestEmail(toEmail, fromUser) {
    const subject = "✅ Email Service Test - Wazuh Case Management System";

    const htmlContent =
      this.generateEmailHeader() +
      `
      <h2 style="color: #1f2937; margin-top: 0;">Email Service Test</h2>
      <p>This is a test email from the Wazuh Case Management System.</p>
      
      <div style="background-color: #ecfdf5; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #065f46;">✅ Configuration Status</h4>
        <p style="margin: 0; color: #065f46;">Email service is working correctly!</p>
      </div>

      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #374151;">Test Details</h4>
        <p style="margin: 5px 0;"><strong>Sent By:</strong> ${
          fromUser.firstName
        } ${fromUser.lastName}</p>
        <p style="margin: 5px 0;"><strong>Sent To:</strong> ${toEmail}</p>
        <p style="margin: 5px 0;"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        If you receive this email, the notification system is configured properly.
      </p>
    ` +
      this.generateEmailFooter();

    return await this.sendEmail(toEmail, subject, htmlContent);
  }
}

module.exports = new EmailService();
