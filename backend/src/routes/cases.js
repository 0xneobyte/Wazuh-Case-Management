const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const Case = require("../models/Case");
const User = require("../models/User");
const {
  protect,
  authorize,
  checkResourceOwnership,
} = require("../middleware/auth");
const logger = require("../utils/logger");
const emailService = require("../services/emailService");

const router = express.Router();

// All routes require authentication
router.use(protect);

// Middleware to load case by ID
const loadCase = async (req, res, next) => {
  try {
    const caseData = await Case.findById(req.params.id)
      .populate("assignedTo", "firstName lastName email role")
      .populate("assignedBy", "firstName lastName email")
      .populate("timeline.userId", "firstName lastName email")
      .populate("comments.userId", "firstName lastName email")
      .populate("resolution.resolvedBy", "firstName lastName email");

    if (!caseData) {
      return res.status(404).json({
        success: false,
        error: { message: "Case not found" },
      });
    }

    req.case = caseData;
    next();
  } catch (error) {
    next(error);
  }
};

// @desc    Get all cases with filtering and pagination
// @route   GET /api/cases
// @access  Private
router.get(
  "/",
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("status")
      .optional()
      .isIn(["Open", "In Progress", "Resolved", "Closed"]),
    query("priority").optional().isIn(["P1", "P2", "P3"]),
    query("assignedTo")
      .optional()
      .isMongoId()
      .withMessage("Invalid assignedTo ID"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            message: "Validation errors",
            details: errors.array(),
          },
        });
      }

      // Build query
      const query = {};

      // Role-based filtering
      if (req.user.role === "analyst") {
        query.assignedTo = req.user._id;
      }

      // Apply filters
      if (req.query.status) query.status = req.query.status;
      if (req.query.priority) query.priority = req.query.priority;
      if (
        req.query.assignedTo &&
        ["admin", "senior_analyst"].includes(req.user.role)
      ) {
        query.assignedTo = req.query.assignedTo;
      }
      if (req.query.category) query.category = req.query.category;
      if (req.query.severity) query.severity = req.query.severity;

      // Search functionality
      if (req.query.search) {
        query.$or = [
          { title: { $regex: req.query.search, $options: "i" } },
          { description: { $regex: req.query.search, $options: "i" } },
          { caseId: { $regex: req.query.search, $options: "i" } },
        ];
      }

      // Date range filtering
      if (req.query.startDate || req.query.endDate) {
        query.createdAt = {};
        if (req.query.startDate)
          query.createdAt.$gte = new Date(req.query.startDate);
        if (req.query.endDate)
          query.createdAt.$lte = new Date(req.query.endDate);
      }

      // Pagination
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      // Sorting
      let sort = {};
      if (req.query.sort) {
        const sortField = req.query.sort.startsWith("-")
          ? req.query.sort.substring(1)
          : req.query.sort;
        const sortOrder = req.query.sort.startsWith("-") ? -1 : 1;
        sort[sortField] = sortOrder;
      } else {
        sort = { createdAt: -1 }; // Default: newest first
      }

      const [cases, totalCount] = await Promise.all([
        Case.find(query)
          .populate("assignedTo", "firstName lastName email role")
          .populate("assignedBy", "firstName lastName email")
          .sort(sort)
          .skip(skip)
          .limit(limit),
        Case.countDocuments(query),
      ]);

      const pagination = {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
      };

      res.status(200).json({
        success: true,
        data: cases,
        pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get single case
// @route   GET /api/cases/:id
// @access  Private
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid case ID")],
  loadCase,
  checkResourceOwnership(),
  async (req, res) => {
    res.status(200).json({
      success: true,
      data: req.case,
    });
  }
);

// @desc    Create new case
// @route   POST /api/cases
// @access  Private (Admin, Senior Analyst)
router.post(
  "/",
  authorize("admin", "senior_analyst"),
  [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("description")
      .trim()
      .notEmpty()
      .withMessage("Description is required"),
    body("priority")
      .isIn(["P1", "P2", "P3"])
      .withMessage("Priority must be P1, P2, or P3"),
    body("severity")
      .isIn(["Critical", "High", "Medium", "Low"])
      .withMessage("Invalid severity"),
    body("category")
      .isIn([
        "Malware",
        "Intrusion",
        "Policy Violation",
        "Vulnerability",
        "Other",
      ])
      .withMessage("Invalid category"),
    body("assignedTo")
      .optional()
      .isMongoId()
      .withMessage("Invalid assignedTo ID"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            message: "Validation errors",
            details: errors.array(),
          },
        });
      }

      const caseData = {
        ...req.body,
        assignedBy: req.user._id,
        timeline: [
          {
            action: "Created",
            description: `Case created by ${req.user.firstName} ${req.user.lastName}`,
            userId: req.user._id,
            timestamp: new Date(),
          },
        ],
      };

      // If assigned to someone, add assignment to timeline
      if (req.body.assignedTo) {
        caseData.assignedAt = new Date();
        caseData.timeline.push({
          action: "Assigned",
          description: "Case assigned to analyst",
          userId: req.user._id,
          timestamp: new Date(),
          metadata: { assignedTo: req.body.assignedTo },
        });

        // Update user's current case load
        await User.findByIdAndUpdate(req.body.assignedTo, {
          $inc: {
            "performance.currentCaseLoad": 1,
            "performance.totalCasesAssigned": 1,
          },
        });
      }

      const newCase = await Case.create(caseData);

      const populatedCase = await Case.findById(newCase._id)
        .populate("assignedTo", "firstName lastName email")
        .populate("assignedBy", "firstName lastName email");

      // Send notification email if case is assigned
      if (req.body.assignedTo) {
        try {
          await emailService.sendCaseAssignmentNotification(populatedCase);
        } catch (emailError) {
          logger.error("Failed to send assignment notification:", emailError);
        }
      }

      logger.info(`New case created: ${newCase.caseId}`, {
        caseId: newCase.caseId,
        createdBy: req.user._id,
        assignedTo: req.body.assignedTo,
      });

      res.status(201).json({
        success: true,
        data: populatedCase,
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Update case
// @route   PUT /api/cases/:id
// @access  Private
router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid case ID"),
    body("title")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Title cannot be empty"),
    body("description")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Description cannot be empty"),
    body("priority")
      .optional()
      .isIn(["P1", "P2", "P3"])
      .withMessage("Priority must be P1, P2, or P3"),
    body("severity")
      .optional()
      .isIn(["Critical", "High", "Medium", "Low"])
      .withMessage("Invalid severity"),
    body("status")
      .optional()
      .isIn(["Open", "In Progress", "Resolved", "Closed"])
      .withMessage("Invalid status"),
  ],
  loadCase,
  checkResourceOwnership(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            message: "Validation errors",
            details: errors.array(),
          },
        });
      }

      const caseData = req.case;
      const updateData = { ...req.body };
      const timelineEntries = [];

      // Track changes for timeline
      if (req.body.status && req.body.status !== caseData.status) {
        timelineEntries.push({
          action: "Status Changed",
          description: `Status changed from ${caseData.status} to ${req.body.status}`,
          userId: req.user._id,
          timestamp: new Date(),
          metadata: {
            previousStatus: caseData.status,
            newStatus: req.body.status,
          },
        });

        // If case is being resolved or closed
        if (
          ["Resolved", "Closed"].includes(req.body.status) &&
          !["Resolved", "Closed"].includes(caseData.status)
        ) {
          updateData.resolution = {
            ...updateData.resolution,
            resolvedBy: req.user._id,
            resolvedAt: new Date(),
          };

          // Update analyst performance
          if (caseData.assignedTo) {
            const resolutionTime = Math.floor(
              (new Date() - caseData.createdAt) / (1000 * 60)
            );
            await User.findById(caseData.assignedTo).then((user) => {
              if (user) {
                user.updatePerformance(true, resolutionTime);
                user.performance.currentCaseLoad = Math.max(
                  0,
                  user.performance.currentCaseLoad - 1
                );
                user.save({ validateBeforeSave: false });
              }
            });
          }
        }
      }

      if (req.body.priority && req.body.priority !== caseData.priority) {
        timelineEntries.push({
          action: "Priority Changed",
          description: `Priority changed from ${caseData.priority} to ${req.body.priority}`,
          userId: req.user._id,
          timestamp: new Date(),
          metadata: {
            previousPriority: caseData.priority,
            newPriority: req.body.priority,
          },
        });
      }

      // Add timeline entries
      if (timelineEntries.length > 0) {
        updateData.$push = { timeline: { $each: timelineEntries } };
      }

      const updatedCase = await Case.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      )
        .populate("assignedTo", "firstName lastName email")
        .populate("assignedBy", "firstName lastName email")
        .populate("resolution.resolvedBy", "firstName lastName email");

      logger.info(`Case updated: ${updatedCase.caseId}`, {
        caseId: updatedCase.caseId,
        updatedBy: req.user._id,
        changes: Object.keys(req.body),
      });

      res.status(200).json({
        success: true,
        data: updatedCase,
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Assign case to user
// @route   PUT /api/cases/:id/assign
// @access  Private (Admin, Senior Analyst)
router.put(
  "/:id/assign",
  authorize("admin", "senior_analyst"),
  [
    param("id").isMongoId().withMessage("Invalid case ID"),
    body("assignedTo").isMongoId().withMessage("Invalid user ID"),
  ],
  loadCase,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            message: "Validation errors",
            details: errors.array(),
          },
        });
      }

      const { assignedTo } = req.body;
      const caseData = req.case;

      // Check if user exists and is active
      const assignee = await User.findOne({ _id: assignedTo, isActive: true });
      if (!assignee) {
        return res.status(400).json({
          success: false,
          error: { message: "User not found or inactive" },
        });
      }

      // Update case load for previous assignee
      if (
        caseData.assignedTo &&
        caseData.assignedTo.toString() !== assignedTo
      ) {
        await User.findByIdAndUpdate(caseData.assignedTo, {
          $inc: { "performance.currentCaseLoad": -1 },
        });
      }

      // Update case load for new assignee
      if (
        !caseData.assignedTo ||
        caseData.assignedTo.toString() !== assignedTo
      ) {
        await User.findByIdAndUpdate(assignedTo, {
          $inc: {
            "performance.currentCaseLoad": 1,
            "performance.totalCasesAssigned": 1,
          },
        });
      }

      const updatedCase = await Case.findByIdAndUpdate(
        req.params.id,
        {
          assignedTo,
          assignedBy: req.user._id,
          assignedAt: new Date(),
          $push: {
            timeline: {
              action: "Assigned",
              description: `Case assigned to ${assignee.firstName} ${assignee.lastName}`,
              userId: req.user._id,
              timestamp: new Date(),
              metadata: { assignedTo },
            },
          },
        },
        { new: true, runValidators: true }
      )
        .populate("assignedTo", "firstName lastName email")
        .populate("assignedBy", "firstName lastName email");

      // Send notification email
      try {
        await emailService.sendCaseAssignmentNotification(updatedCase);
      } catch (emailError) {
        logger.error("Failed to send assignment notification:", emailError);
      }

      logger.info(`Case assigned: ${updatedCase.caseId}`, {
        caseId: updatedCase.caseId,
        assignedBy: req.user._id,
        assignedTo,
      });

      res.status(200).json({
        success: true,
        data: updatedCase,
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Add comment to case
// @route   POST /api/cases/:id/comments
// @access  Private
router.post(
  "/:id/comments",
  [
    param("id").isMongoId().withMessage("Invalid case ID"),
    body("content")
      .trim()
      .notEmpty()
      .withMessage("Comment content is required"),
    body("isInternal")
      .optional()
      .isBoolean()
      .withMessage("isInternal must be boolean"),
  ],
  loadCase,
  checkResourceOwnership(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            message: "Validation errors",
            details: errors.array(),
          },
        });
      }

      const comment = {
        userId: req.user._id,
        content: req.body.content,
        isInternal: req.body.isInternal || false,
        timestamp: new Date(),
      };

      const updatedCase = await Case.findByIdAndUpdate(
        req.params.id,
        {
          $push: {
            comments: comment,
            timeline: {
              action: "Comment Added",
              description: "New comment added to case",
              userId: req.user._id,
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      )
        .populate("comments.userId", "firstName lastName email")
        .populate("timeline.userId", "firstName lastName email");

      logger.info(`Comment added to case: ${updatedCase.caseId}`, {
        caseId: updatedCase.caseId,
        commentBy: req.user._id,
        isInternal: comment.isInternal,
      });

      res.status(201).json({
        success: true,
        data: updatedCase,
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Delete case
// @route   DELETE /api/cases/:id
// @access  Private (Admin only)
router.delete(
  "/:id",
  authorize("admin"),
  [param("id").isMongoId().withMessage("Invalid case ID")],
  loadCase,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            message: "Validation errors",
            details: errors.array(),
          },
        });
      }

      const caseData = req.case;

      // Update assignee's case load
      if (caseData.assignedTo) {
        await User.findByIdAndUpdate(caseData.assignedTo, {
          $inc: { "performance.currentCaseLoad": -1 },
        });
      }

      await Case.findByIdAndDelete(req.params.id);

      logger.info(`Case deleted: ${caseData.caseId}`, {
        caseId: caseData.caseId,
        deletedBy: req.user._id,
      });

      res.status(200).json({
        success: true,
        message: "Case deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get case statistics
// @route   GET /api/cases/stats/overview
// @access  Private
router.get("/stats/overview", async (req, res, next) => {
  try {
    let matchQuery = {};

    // Role-based filtering
    if (req.user.role === "analyst") {
      matchQuery.assignedTo = req.user._id;
    }

    const stats = await Case.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalCases: { $sum: 1 },
          openCases: { $sum: { $cond: [{ $eq: ["$status", "Open"] }, 1, 0] } },
          inProgressCases: {
            $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] },
          },
          resolvedCases: {
            $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] },
          },
          closedCases: {
            $sum: { $cond: [{ $eq: ["$status", "Closed"] }, 1, 0] },
          },
          p1Cases: { $sum: { $cond: [{ $eq: ["$priority", "P1"] }, 1, 0] } },
          p2Cases: { $sum: { $cond: [{ $eq: ["$priority", "P2"] }, 1, 0] } },
          p3Cases: { $sum: { $cond: [{ $eq: ["$priority", "P3"] }, 1, 0] } },
          overdueCases: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ["$sla.dueDate", new Date()] },
                    { $not: { $in: ["$status", ["Resolved", "Closed"]] } },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const result =
      stats.length > 0
        ? stats[0]
        : {
            totalCases: 0,
            openCases: 0,
            inProgressCases: 0,
            resolvedCases: 0,
            closedCases: 0,
            p1Cases: 0,
            p2Cases: 0,
            p3Cases: 0,
            overdueCases: 0,
          };

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get geographic threat data
// @route   GET /api/cases/geo/threats
// @access  Private
router.get(
  "/geo/threats",
  [
    query("severity")
      .optional()
      .isIn(["critical", "high", "medium", "low", "all"]),
    query("category").optional(),
    query("timeRange").optional().isIn(["7d", "30d", "90d", "1y"]),
    query("minThreats").optional().isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            message: "Validation errors",
            details: errors.array(),
          },
        });
      }

      const {
        severity,
        category,
        timeRange = "30d",
        minThreats = 1,
      } = req.query;

      const periodDays = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365,
      };

      const startDate = new Date(
        Date.now() - periodDays[timeRange] * 24 * 60 * 60 * 1000
      );

      let matchQuery = { createdAt: { $gte: startDate } };

      if (severity && severity !== "all") {
        matchQuery.severity =
          severity.charAt(0).toUpperCase() + severity.slice(1);
      }

      if (category && category !== "all") {
        matchQuery.category = category;
      }

      // Role-based filtering
      if (req.user.role === "analyst") {
        matchQuery.assignedTo = req.user._id;
      }

      const geoData = await Case.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: {
              country: "$geoLocation.country",
              city: "$geoLocation.city",
              latitude: "$geoLocation.coordinates.lat",
              longitude: "$geoLocation.coordinates.lng",
            },
            threatCount: { $sum: 1 },
            severity: { $push: "$severity" },
            categories: { $addToSet: "$category" },
            sourceIPs: { $addToSet: "$wazuhAlert.sourceIp" },
            lastSeen: { $max: "$createdAt" },
          },
        },
        {
          $match: { threatCount: { $gte: parseInt(minThreats) } },
        },
        {
          $project: {
            _id: { $concat: ["$_id.country", "-", "$_id.city"] },
            latitude: "$_id.latitude",
            longitude: "$_id.longitude",
            country: "$_id.country",
            city: "$_id.city",
            threatCount: 1,
            severity: { $arrayElemAt: ["$severity", 0] },
            categories: 1,
            sourceIPs: {
              $filter: { input: "$sourceIPs", cond: { $ne: ["$$this", null] } },
            },
            lastSeen: 1,
          },
        },
        { $sort: { threatCount: -1 } },
      ]);

      res.status(200).json({
        success: true,
        data: geoData,
      });
    } catch (error) {
      logger.error("Geo threats error:", error);
      next(error);
    }
  }
);

// @desc    Get geographic statistics
// @route   GET /api/cases/geo/stats
// @access  Private
router.get(
  "/geo/stats",
  [
    query("severity")
      .optional()
      .isIn(["critical", "high", "medium", "low", "all"]),
    query("category").optional(),
    query("timeRange").optional().isIn(["7d", "30d", "90d", "1y"]),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            message: "Validation errors",
            details: errors.array(),
          },
        });
      }

      const { severity, category, timeRange = "30d" } = req.query;

      const periodDays = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365,
      };

      const startDate = new Date(
        Date.now() - periodDays[timeRange] * 24 * 60 * 60 * 1000
      );

      let matchQuery = {
        createdAt: { $gte: startDate },
        "geoLocation.country": { $exists: true, $ne: null },
      };

      if (severity && severity !== "all") {
        matchQuery.severity =
          severity.charAt(0).toUpperCase() + severity.slice(1);
      }

      if (category && category !== "all") {
        matchQuery.category = category;
      }

      // Role-based filtering
      if (req.user.role === "analyst") {
        matchQuery.assignedTo = req.user._id;
      }

      const [overallStats, countryStats, cityStats] = await Promise.all([
        // Overall stats
        Case.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: null,
              totalThreats: { $sum: 1 },
              countries: { $addToSet: "$geoLocation.country" },
              cities: {
                $addToSet: {
                  $concat: ["$geoLocation.city", ", ", "$geoLocation.country"],
                },
              },
              criticalThreats: {
                $sum: { $cond: [{ $eq: ["$severity", "Critical"] }, 1, 0] },
              },
              highThreats: {
                $sum: { $cond: [{ $eq: ["$severity", "High"] }, 1, 0] },
              },
              mediumThreats: {
                $sum: { $cond: [{ $eq: ["$severity", "Medium"] }, 1, 0] },
              },
              lowThreats: {
                $sum: { $cond: [{ $eq: ["$severity", "Low"] }, 1, 0] },
              },
            },
          },
        ]),

        // Top countries
        Case.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: "$geoLocation.country",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),

        // Top cities
        Case.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: {
                city: "$geoLocation.city",
                country: "$geoLocation.country",
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
      ]);

      const stats = overallStats[0] || {
        totalThreats: 0,
        countries: [],
        cities: [],
        criticalThreats: 0,
        highThreats: 0,
        mediumThreats: 0,
        lowThreats: 0,
      };

      const topCountries = countryStats.map((country) => ({
        country: country._id,
        count: country.count,
        percentage: (country.count / stats.totalThreats) * 100 || 0,
      }));

      const topCities = cityStats.map((city) => ({
        city: city._id.city,
        country: city._id.country,
        count: city.count,
      }));

      res.status(200).json({
        success: true,
        data: {
          totalThreats: stats.totalThreats,
          countries: stats.countries.length,
          cities: stats.cities.length,
          criticalThreats: stats.criticalThreats,
          highThreats: stats.highThreats,
          mediumThreats: stats.mediumThreats,
          lowThreats: stats.lowThreats,
          topCountries,
          topCities,
        },
      });
    } catch (error) {
      logger.error("Geo stats error:", error);
      next(error);
    }
  }
);

module.exports = router;
