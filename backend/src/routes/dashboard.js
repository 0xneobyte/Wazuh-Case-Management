const express = require("express");
const { query, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Case = require("../models/Case");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");
const logger = require("../utils/logger");

const router = express.Router();

// All routes require authentication
router.use(protect);

// @desc    Get dashboard overview stats
// @route   GET /api/dashboard/overview
// @access  Private
router.get("/overview", async (req, res, next) => {
  try {
    // Add defensive check for req.user
    if (!req.user) {
      logger.error("req.user is undefined in dashboard overview route");
      return res.status(401).json({
        success: false,
        error: { message: "User not authenticated" },
      });
    }

    let matchQuery = {};

    // Role-based filtering
    if (req.user.role === "analyst") {
      matchQuery.assignedTo = req.user._id;
    }

    const [caseStats, priorityStats, statusTrends, recentActivity] =
      await Promise.all([
        // Overall case statistics
        Case.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: null,
              totalCases: { $sum: 1 },
              openCases: {
                $sum: { $cond: [{ $eq: ["$status", "Open"] }, 1, 0] },
              },
              inProgressCases: {
                $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] },
              },
              resolvedCases: {
                $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] },
              },
              closedCases: {
                $sum: { $cond: [{ $eq: ["$status", "Closed"] }, 1, 0] },
              },
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
              avgResolutionTime: {
                $avg: {
                  $cond: [
                    { $in: ["$status", ["Resolved", "Closed"]] },
                    { $subtract: ["$resolution.resolvedAt", "$createdAt"] },
                    null,
                  ],
                },
              },
            },
          },
        ]),

        // Priority distribution
        Case.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: "$priority",
              count: { $sum: 1 },
              openCount: {
                $sum: { $cond: [{ $ne: ["$status", "Closed"] }, 1, 0] },
              },
            },
          },
        ]),

        // Status trends over time (last 30 days)
        Case.aggregate([
          {
            $match: {
              ...matchQuery,
              createdAt: {
                $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                status: "$status",
              },
              count: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: "$_id.date",
              statuses: {
                $push: {
                  status: "$_id.status",
                  count: "$count",
                },
              },
              totalCount: { $sum: "$count" },
            },
          },
          { $sort: { _id: 1 } },
        ]),

        // Recent case activity
        Case.find(matchQuery)
          .sort({ updatedAt: -1 })
          .limit(10)
          .populate("assignedTo", "firstName lastName")
          .select(
            "caseId title status priority updatedAt createdAt assignedTo"
          ),
      ]);

    const overview =
      caseStats.length > 0
        ? caseStats[0]
        : {
            totalCases: 0,
            openCases: 0,
            inProgressCases: 0,
            resolvedCases: 0,
            closedCases: 0,
            overdueCases: 0,
            avgResolutionTime: 0,
          };

    // Convert avgResolutionTime from milliseconds to hours
    if (overview.avgResolutionTime) {
      overview.avgResolutionTime =
        Math.round(overview.avgResolutionTime / (1000 * 60 * 60 * 100)) / 100;
    }

    // Format priority stats
    const priorities = priorityStats.reduce((acc, item) => {
      acc[item._id] = {
        total: item.count,
        open: item.openCount,
      };
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        overview,
        priorities,
        statusTrends,
        recentActivity,
      },
    });
  } catch (error) {
    logger.error("Dashboard overview error:", error);
    next(error);
  }
});

// @desc    Get analyst performance metrics
// @route   GET /api/dashboard/performance
// @access  Private (Admin, Senior Analyst)
router.get(
  "/performance",
  authorize("admin", "senior_analyst"),
  [
    query("period")
      .optional()
      .isIn(["7d", "30d", "90d", "1y"])
      .withMessage("Invalid period"),
    query("userId").optional().isMongoId().withMessage("Invalid user ID"),
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

      const period = req.query.period || "30d";
      const periodDays = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365,
      };

      const startDate = new Date(
        Date.now() - periodDays[period] * 24 * 60 * 60 * 1000
      );

      let userMatch = {
        role: { $in: ["analyst", "senior_analyst"] },
        isActive: true,
      };
      if (req.query.userId) {
        userMatch._id = new mongoose.Types.ObjectId(req.query.userId);
      }

      const performanceData = await User.aggregate([
        { $match: userMatch },
        {
          $lookup: {
            from: "cases",
            let: { userId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$assignedTo", "$$userId"] },
                  createdAt: { $gte: startDate },
                },
              },
            ],
            as: "assignedCases",
          },
        },
        {
          $lookup: {
            from: "cases",
            let: { userId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$resolution.resolvedBy", "$$userId"] },
                  "resolution.resolvedAt": { $gte: startDate },
                },
              },
            ],
            as: "resolvedCases",
          },
        },
        {
          $project: {
            firstName: 1,
            lastName: 1,
            email: 1,
            role: 1,
            currentCaseLoad: "$performance.currentCaseLoad",
            totalAssigned: { $size: "$assignedCases" },
            totalResolved: { $size: "$resolvedCases" },
            overdueCases: {
              $size: {
                $filter: {
                  input: "$assignedCases",
                  cond: {
                    $and: [
                      { $lt: ["$$this.sla.dueDate", new Date()] },
                      {
                        $not: {
                          $in: ["$$this.status", ["Resolved", "Closed"]],
                        },
                      },
                    ],
                  },
                },
              },
            },
            avgResolutionTime: {
              $avg: {
                $map: {
                  input: "$resolvedCases",
                  as: "case",
                  in: {
                    $divide: [
                      {
                        $subtract: [
                          "$$case.resolution.resolvedAt",
                          "$$case.createdAt",
                        ],
                      },
                      1000 * 60 * 60, // Convert to hours
                    ],
                  },
                },
              },
            },
            workloadDistribution: {
              $arrayToObject: {
                $map: {
                  input: ["P1", "P2", "P3"],
                  as: "priority",
                  in: {
                    k: "$$priority",
                    v: {
                      $size: {
                        $filter: {
                          input: "$assignedCases",
                          cond: { $eq: ["$$this.priority", "$$priority"] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        { $sort: { totalResolved: -1 } },
      ]);

      res.status(200).json({
        success: true,
        data: {
          period,
          analysts: performanceData,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get case trends and analytics
// @route   GET /api/dashboard/trends
// @access  Private
router.get(
  "/trends",
  [
    query("period")
      .optional()
      .isIn(["7d", "30d", "90d", "1y"])
      .withMessage("Invalid period"),
    query("groupBy")
      .optional()
      .isIn(["day", "week", "month"])
      .withMessage("Invalid groupBy"),
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

      const period = req.query.period || "30d";
      const groupBy = req.query.groupBy || "day";

      const periodDays = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365,
      };

      const startDate = new Date(
        Date.now() - periodDays[period] * 24 * 60 * 60 * 1000
      );

      let matchQuery = { createdAt: { $gte: startDate } };
      if (req.user.role === "analyst") {
        matchQuery.assignedTo = req.user._id;
      }

      // Date format for grouping
      const dateFormats = {
        day: "%Y-%m-%d",
        week: "%Y-%U",
        month: "%Y-%m",
      };

      const [
        caseCreationTrends,
        caseResolutionTrends,
        categoryTrends,
        severityTrends,
      ] = await Promise.all([
        // Case creation trends
        Case.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: dateFormats[groupBy],
                  date: "$createdAt",
                },
              },
              created: { $sum: 1 },
              byPriority: {
                $push: {
                  priority: "$priority",
                  severity: "$severity",
                },
              },
            },
          },
          { $sort: { _id: 1 } },
        ]),

        // Case resolution trends
        Case.aggregate([
          {
            $match: {
              ...matchQuery,
              "resolution.resolvedAt": { $gte: startDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: dateFormats[groupBy],
                  date: "$resolution.resolvedAt",
                },
              },
              resolved: { $sum: 1 },
              avgResolutionTime: {
                $avg: {
                  $divide: [
                    { $subtract: ["$resolution.resolvedAt", "$createdAt"] },
                    1000 * 60 * 60, // Convert to hours
                  ],
                },
              },
            },
          },
          { $sort: { _id: 1 } },
        ]),

        // Category distribution trends
        Case.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: "$category",
              count: { $sum: 1 },
              avgResolutionTime: {
                $avg: {
                  $cond: [
                    { $in: ["$status", ["Resolved", "Closed"]] },
                    {
                      $divide: [
                        { $subtract: ["$resolution.resolvedAt", "$createdAt"] },
                        1000 * 60 * 60,
                      ],
                    },
                    null,
                  ],
                },
              },
            },
          },
          { $sort: { count: -1 } },
        ]),

        // Severity trends
        Case.aggregate([
          { $match: matchQuery },
          {
            $group: {
              _id: "$severity",
              count: { $sum: 1 },
              openCount: {
                $sum: {
                  $cond: [{ $in: ["$status", ["Open", "In Progress"]] }, 1, 0],
                },
              },
              resolvedCount: {
                $sum: {
                  $cond: [{ $in: ["$status", ["Resolved", "Closed"]] }, 1, 0],
                },
              },
            },
          },
        ]),
      ]);

      res.status(200).json({
        success: true,
        data: {
          period,
          groupBy,
          caseCreationTrends,
          caseResolutionTrends,
          categoryTrends,
          severityTrends,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get SLA compliance metrics
// @route   GET /api/dashboard/sla
// @access  Private
router.get(
  "/sla",
  [
    query("period")
      .optional()
      .isIn(["7d", "30d", "90d", "1y"])
      .withMessage("Invalid period"),
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

      const period = req.query.period || "30d";
      const periodDays = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365,
      };

      const startDate = new Date(
        Date.now() - periodDays[period] * 24 * 60 * 60 * 1000
      );

      let matchQuery = { createdAt: { $gte: startDate } };
      if (req.user.role === "analyst") {
        matchQuery.assignedTo = req.user._id;
      }

      const slaMetrics = await Case.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: "$priority",
            totalCases: { $sum: 1 },
            onTimeCases: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $in: ["$status", ["Open", "In Progress"]] },
                      {
                        $and: [
                          { $in: ["$status", ["Resolved", "Closed"]] },
                          { $lte: ["$resolution.resolvedAt", "$sla.dueDate"] },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            overdueCases: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: [new Date(), "$sla.dueDate"] },
                      { $not: { $in: ["$status", ["Resolved", "Closed"]] } },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            breachedCases: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ["$status", ["Resolved", "Closed"]] },
                      { $gt: ["$resolution.resolvedAt", "$sla.dueDate"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            avgResponseTime: {
              $avg: {
                $cond: [
                  { $ne: ["$assignedAt", null] },
                  {
                    $divide: [
                      { $subtract: ["$assignedAt", "$createdAt"] },
                      1000 * 60,
                    ],
                  },
                  null,
                ],
              },
            },
          },
        },
        {
          $project: {
            priority: "$_id",
            totalCases: 1,
            onTimeCases: 1,
            overdueCases: 1,
            breachedCases: 1,
            complianceRate: {
              $multiply: [
                {
                  $divide: [
                    { $subtract: ["$totalCases", "$breachedCases"] },
                    "$totalCases",
                  ],
                },
                100,
              ],
            },
            avgResponseTime: { $round: ["$avgResponseTime", 2] },
          },
        },
        { $sort: { priority: 1 } },
      ]);

      // Overall SLA summary
      const overallSLA = await Case.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalCases: { $sum: 1 },
            compliantCases: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $not: { $in: ["$status", ["Resolved", "Closed"]] } },
                      {
                        $and: [
                          { $in: ["$status", ["Resolved", "Closed"]] },
                          { $lte: ["$resolution.resolvedAt", "$sla.dueDate"] },
                        ],
                      },
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

      const summary =
        overallSLA.length > 0
          ? {
              totalCases: overallSLA[0].totalCases,
              compliantCases: overallSLA[0].compliantCases,
              complianceRate: (
                (overallSLA[0].compliantCases / overallSLA[0].totalCases) *
                100
              ).toFixed(2),
            }
          : { totalCases: 0, compliantCases: 0, complianceRate: 0 };

      res.status(200).json({
        success: true,
        data: {
          period,
          summary,
          byPriority: slaMetrics,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// @desc    Get workload distribution
// @route   GET /api/dashboard/workload
// @access  Private (Admin, Senior Analyst)
router.get(
  "/workload",
  authorize("admin", "senior_analyst"),
  async (req, res, next) => {
    try {
      const workloadData = await User.aggregate([
        {
          $match: {
            isActive: true,
            role: { $in: ["analyst", "senior_analyst"] },
          },
        },
        {
          $lookup: {
            from: "cases",
            let: { userId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$assignedTo", "$$userId"] },
                  status: { $in: ["Open", "In Progress"] },
                },
              },
            ],
            as: "activeCases",
          },
        },
        {
          $project: {
            firstName: 1,
            lastName: 1,
            email: 1,
            role: 1,
            department: 1,
            currentCaseLoad: "$performance.currentCaseLoad",
            activeCases: { $size: "$activeCases" },
            workloadStatus: 1,
            performance: {
              totalCasesResolved: "$performance.totalCasesResolved",
              avgResolutionTime: "$performance.avgResolutionTime",
              rating: "$performance.rating",
            },
            caseDistribution: {
              $arrayToObject: {
                $map: {
                  input: ["P1", "P2", "P3"],
                  as: "priority",
                  in: {
                    k: "$$priority",
                    v: {
                      $size: {
                        $filter: {
                          input: "$activeCases",
                          cond: { $eq: ["$$this.priority", "$$priority"] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        { $sort: { currentCaseLoad: -1 } },
      ]);

      res.status(200).json({
        success: true,
        data: workloadData,
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
