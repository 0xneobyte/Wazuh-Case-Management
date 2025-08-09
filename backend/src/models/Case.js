const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
  caseId: {
    type: String,
    unique: true,
    // Format: CASE-YYYY-MM-DD-XXXXX
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['P1', 'P2', 'P3'],
    required: true,
    default: 'P3'
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
    default: 'Open'
  },
  severity: {
    type: String,
    enum: ['Critical', 'High', 'Medium', 'Low'],
    required: true
  },
  category: {
    type: String,
    enum: ['Malware', 'Intrusion', 'Policy Violation', 'Vulnerability', 'Other'],
    required: true
  },
  // Wazuh alert details
  wazuhAlert: {
    alertId: String,
    ruleId: String,
    ruleName: String,
    agentId: String,
    agentName: String,
    sourceIp: String,
    destinationIp: String,
    location: String,
    fullLog: String,
    timestamp: Date
  },
  // MITRE ATT&CK mapping
  mitreAttack: {
    tactics: [String],
    techniques: [String],
    subTechniques: [String]
  },
  // Assignment details
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedAt: Date,
  // SLA tracking
  sla: {
    dueDate: Date,
    responseTime: Number, // minutes
    resolutionTime: Number, // minutes
    isOverdue: {
      type: Boolean,
      default: false
    },
    escalated: {
      type: Boolean,
      default: false
    },
    escalatedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    escalatedAt: Date
  },
  // Geo-location data
  geoLocation: {
    country: String,
    region: String,
    city: String,
    coordinates: {
      lat: Number,
      lng: Number
    },
    riskLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical']
    }
  },
  // Case timeline
  timeline: [{
    action: {
      type: String,
      enum: ['Created', 'Assigned', 'Status Changed', 'Priority Changed', 'Comment Added', 'Escalated', 'Resolved', 'Closed']
    },
    description: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed
  }],
  // Comments and notes
  comments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    isInternal: {
      type: Boolean,
      default: false
    }
  }],
  // AI assistant interactions
  aiAssistant: {
    remediationSuggestions: [String],
    complianceChecks: [{
      framework: String, // MITRE ATT&CK, NIST, etc.
      requirements: [String],
      status: String
    }],
    executiveSummary: String,
    lastUpdated: Date
  },
  // Attachments and evidence
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Resolution details
  resolution: {
    summary: String,
    actions: [String],
    rootCause: String,
    lessons: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date
  },
  // Metadata
  tags: [String],
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
caseSchema.index({ caseId: 1 });
caseSchema.index({ status: 1, priority: 1 });
caseSchema.index({ assignedTo: 1, status: 1 });
caseSchema.index({ 'wazuhAlert.sourceIp': 1 });
caseSchema.index({ createdAt: -1 });
caseSchema.index({ 'sla.dueDate': 1, status: 1 });

// Virtual for case age
caseSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for time to resolution
caseSchema.virtual('timeToResolution').get(function() {
  if (this.resolution?.resolvedAt) {
    return Math.floor((this.resolution.resolvedAt - this.createdAt) / (1000 * 60));
  }
  return null;
});

// Pre-save middleware to generate case ID
caseSchema.pre('save', async function(next) {
  if (!this.caseId) {
    const date = new Date().toISOString().split('T')[0];
    // Get current count of cases created today
    const count = await this.constructor.countDocuments({
      caseId: { $regex: `^CASE-${date}-` }
    });
    
    // Generate sequential number with timestamp to ensure uniqueness
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.caseId = `CASE-${date}-${String(count + 1).padStart(3, '0')}-${randomSuffix}`;
  }
  next();
});

// Pre-save middleware to update SLA due date
caseSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('priority')) {
    const slaHours = {
      'P1': 1,    // 1 hour for critical
      'P2': 4,    // 4 hours for high
      'P3': 24    // 24 hours for medium
    };
    
    const hours = slaHours[this.priority] || 24;
    this.sla.dueDate = new Date(Date.now() + hours * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('Case', caseSchema);