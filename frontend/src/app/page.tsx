"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import DashboardLayout from "../components/layout/DashboardLayout";
import { dashboardAPI, casesAPI, handleAPIError } from "@/services/api";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
  Users,
  Activity,
  Plus,
  Sparkles,
  BarChart3,
  MapPin,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface DashboardStats {
  totalCases: number;
  openCases: number;
  inProgressCases: number;
  resolvedCases: number;
  closedCases: number;
  overdueCases: number;
}

interface RecentCase {
  _id: string;
  caseId: string;
  title: string;
  priority: string;
  status: string;
  assignedTo?: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(
    null
  );
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    } else if (user) {
      loadDashboardData();
    }
  }, [user, isLoading, router]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load dashboard overview and recent cases in parallel
      const [overviewResponse, casesResponse] = await Promise.all([
        dashboardAPI.getOverview(),
        casesAPI.getCases({ page: 1, limit: 5, sort: "-createdAt" }),
      ]);

      if (overviewResponse.success) {
        setDashboardData(overviewResponse.data.overview);
      }

      if (casesResponse.success) {
        setRecentCases(casesResponse.data);
      }
    } catch (error) {
      console.error("Dashboard data loading error:", error);
      const apiError = handleAPIError(error);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  // Create stats array from real data
  const stats = [
    {
      title: "Open Cases",
      value: dashboardData?.openCases || 0,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      change: 0,
    },
    {
      title: "In Progress",
      value: dashboardData?.inProgressCases || 0,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      change: 0,
    },
    {
      title: "Resolved",
      value: dashboardData?.resolvedCases || 0,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      change: 0,
    },
    {
      title: "Overdue Cases",
      value: dashboardData?.overdueCases || 0,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      change: 0,
    },
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "p1":
        return "bg-red-100 text-red-800 border-red-200";
      case "p2":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "p3":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "open":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "in progress":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "resolved":
        return "bg-green-100 text-green-800 border-green-200";
      case "closed":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "overdue":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const quickActions = [
    {
      title: "Create Case",
      description: "Manually create a new security case",
      icon: Plus,
      href: "/cases/create",
      show: user?.role !== "viewer",
    },
    {
      title: "AI Assistant",
      description: "Get remediation guidance and recommendations",
      icon: Sparkles,
      href: "/ai-assistant",
      show: true,
    },
    {
      title: "View Analytics",
      description: "Analyze performance and trends",
      icon: BarChart3,
      href: "/analytics",
      show: true,
    },
    {
      title: "Geo Tracker",
      description: "Visualize threat origins and locations",
      icon: MapPin,
      href: "/geo",
      show: true,
    },
  ].filter((action) => action.show);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your security cases today.
          </p>
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
              <p>Error loading dashboard data: {error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadDashboardData}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Cases */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Cases</CardTitle>
                    <CardDescription>
                      Latest security cases and their status
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/cases")}
                  >
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {recentCases.length > 0 ? (
                    recentCases.map((case_, index) => (
                      <div
                        key={case_._id}
                        className="p-6 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/cases/${case_._id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3">
                              <h4 className="text-sm font-medium truncate">
                                {case_.title}
                              </h4>
                              <Badge variant="outline" className="text-xs">
                                {case_.caseId}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {case_.assignedTo
                                ? `Assigned to ${case_.assignedTo.firstName} ${case_.assignedTo.lastName}`
                                : "Unassigned"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Created {formatDate(case_.createdAt)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end space-y-2">
                            <Badge
                              className={`text-xs ${getPriorityColor(
                                case_.priority
                              )}`}
                            >
                              {case_.priority}
                            </Badge>
                            <Badge
                              className={`text-xs ${getStatusColor(
                                case_.status
                              )}`}
                            >
                              {case_.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center">
                      <div className="mx-auto h-12 w-12 text-muted-foreground/50">
                        <Activity className="h-full w-full" />
                      </div>
                      <h3 className="mt-2 text-sm font-medium text-muted-foreground">
                        No recent cases
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Cases will appear here once created
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and shortcuts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full justify-start h-auto p-4"
                    onClick={() => router.push(action.href)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <action.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium">{action.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {action.description}
                        </div>
                      </div>
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Performance Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
                <CardDescription>Your case resolution metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Case Resolution Rate</span>
                    <span className="font-medium">85%</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Average Response Time</span>
                    <span className="font-medium">2.3h</span>
                  </div>
                  <Progress value={70} className="h-2" />
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>SLA Compliance</span>
                    <span className="font-medium">92%</span>
                  </div>
                  <Progress value={92} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
