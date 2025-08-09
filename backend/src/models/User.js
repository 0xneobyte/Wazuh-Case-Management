const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["admin", "senior_analyst", "analyst", "viewer"],
      default: "analyst",
    },
    // Contact information
    phoneNumber: String,
    department: String,
    // User status
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: Date,
    // Performance metrics
    performance: {
      totalCasesAssigned: {
        type: Number,
        default: 0,
      },
      totalCasesResolved: {
        type: Number,
        default: 0,
      },
      avgResolutionTime: {
        type: Number,
        default: 0,
      }, // in minutes
      currentCaseLoad: {
        type: Number,
        default: 0,
      },
      overdueCases: {
        type: Number,
        default: 0,
      },
      // Performance ratings
      rating: {
        type: Number,
        min: 1,
        max: 5,
        default: 3,
      },
      // Time tracking
      monthlyStats: [
        {
          month: Number,
          year: Number,
          casesResolved: Number,
          avgResolutionTime: Number,
          overdueCases: Number,
        },
      ],
    },
    // User preferences
    preferences: {
      emailNotifications: {
        newAssignment: {
          type: Boolean,
          default: true,
        },
        caseUpdate: {
          type: Boolean,
          default: true,
        },
        escalation: {
          type: Boolean,
          default: true,
        },
        dailyDigest: {
          type: Boolean,
          default: false,
        },
      },
      dashboardLayout: {
        type: String,
        enum: ["compact", "detailed", "custom"],
        default: "detailed",
      },
      timezone: {
        type: String,
        default: "UTC",
      },
    },
    // Specializations and skills
    specializations: [
      {
        type: String,
        enum: [
          "Malware Analysis",
          "Network Security",
          "Incident Response",
          "Forensics",
          "Threat Hunting",
          "Compliance",
        ],
      },
    ],
    // Security settings
    security: {
      failedLoginAttempts: {
        type: Number,
        default: 0,
      },
      accountLocked: {
        type: Boolean,
        default: false,
      },
      lockExpires: Date,
      passwordChangedAt: Date,
      twoFactorEnabled: {
        type: Boolean,
        default: false,
      },
      twoFactorSecret: String,
    },
    // Manager/supervisor relationship
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    subordinates: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Avatar/profile
    avatar: String,
    // API access tokens
    apiTokens: [
      {
        token: String,
        name: String,
        permissions: [String],
        createdAt: {
          type: Date,
          default: Date.now,
        },
        lastUsed: Date,
        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.password;
        if (ret.security && ret.security.twoFactorSecret) {
          delete ret.security.twoFactorSecret;
        }
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ role: 1, isActive: 1 });

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for current workload status
userSchema.virtual("workloadStatus").get(function () {
  const load = this.performance.currentCaseLoad;
  if (load === 0) return "Available";
  if (load <= 5) return "Light";
  if (load <= 10) return "Moderate";
  if (load <= 15) return "Heavy";
  return "Overloaded";
});

// Pre-save middleware to hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.security.passwordChangedAt = new Date();
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if password was changed after JWT was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.security.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.security.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Method to generate API token
userSchema.methods.generateApiToken = function (tokenName, permissions = []) {
  const token = require("crypto").randomBytes(32).toString("hex");
  this.apiTokens.push({
    token: require("crypto").createHash("sha256").update(token).digest("hex"),
    name: tokenName,
    permissions,
  });
  return token;
};

// Method to update performance metrics
userSchema.methods.updatePerformance = function (
  caseResolved = false,
  resolutionTime = null
) {
  if (caseResolved) {
    this.performance.totalCasesResolved += 1;

    if (resolutionTime) {
      const totalTime =
        this.performance.avgResolutionTime *
        (this.performance.totalCasesResolved - 1);
      this.performance.avgResolutionTime =
        (totalTime + resolutionTime) / this.performance.totalCasesResolved;
    }
  }

  // Update current month stats
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let monthlyRecord = this.performance.monthlyStats.find(
    (stat) => stat.month === currentMonth && stat.year === currentYear
  );

  if (!monthlyRecord) {
    monthlyRecord = {
      month: currentMonth,
      year: currentYear,
      casesResolved: 0,
      avgResolutionTime: 0,
      overdueCases: 0,
    };
    this.performance.monthlyStats.push(monthlyRecord);
  }

  if (caseResolved) {
    monthlyRecord.casesResolved += 1;
    if (resolutionTime) {
      const totalTime =
        monthlyRecord.avgResolutionTime * (monthlyRecord.casesResolved - 1);
      monthlyRecord.avgResolutionTime =
        (totalTime + resolutionTime) / monthlyRecord.casesResolved;
    }
  }
};

module.exports = mongoose.model("User", userSchema);
