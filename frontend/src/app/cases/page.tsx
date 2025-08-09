"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { casesAPI, handleAPIError } from "@/services/api";
import {
  Plus,
  Filter,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  ArrowRight,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Case {
  _id: string;
  caseId: string;
  title: string;
  description: string;
  priority: "P1" | "P2" | "P3";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  severity: "Critical" | "High" | "Medium" | "Low";
  category: string;
  assignedTo?: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
  sla: {
    dueDate: string;
    isOverdue: boolean;
  };
}

interface CasesResponse {
  data: Case[];
  pagination: {
    page: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

const StatusIcon = ({ status }: { status: string }) => {
  const icons = {
    Open: AlertTriangle,
    "In Progress": Clock,
    Resolved: CheckCircle,
    Closed: XCircle,
  };
  const Icon = icons[status as keyof typeof icons] || AlertTriangle;
  return <Icon className="h-4 w-4" />;
};

export default function CasesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<
    CasesResponse["pagination"] | null
  >(null);

  // Filters
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    category: "",
    search: "",
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    } else if (user) {
      loadCases();
    }
  }, [user, isLoading, router, currentPage, filters]);

  const loadCases = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, unknown> = {
        page: currentPage,
        limit: 20,
        sort: "-createdAt",
      };

      // Add filters
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.category) params.category = filters.category;
      if (filters.search) params.search = filters.search;

      const response = await casesAPI.getCases(params);

      if (response.success) {
        setCases(response.data);
        setPagination(response.pagination);
      } else {
        setError(response.message || "Failed to load cases");
      }
    } catch (error) {
      console.error("Cases loading error:", error);
      const apiError = handleAPIError(error);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      status: "",
      priority: "",
      category: "",
      search: "",
    });
    setCurrentPage(1);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "P1":
        return "bg-red-100 text-red-800 border-red-200";
      case "P2":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "P3":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "In Progress":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Resolved":
        return "bg-green-100 text-green-800 border-green-200";
      case "Closed":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === "Closed" || status === "Resolved") return false;
    return new Date(dueDate) < new Date();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading cases...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Security Cases
            </h1>
            <p className="text-muted-foreground">
              Manage and track security incidents and alerts
            </p>
          </div>
          {user?.role !== "viewer" && (
            <Button onClick={() => router.push("/cases/create")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Case
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search cases..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              {/* Priority Filter */}
              <Select
                value={filters.priority}
                onValueChange={(value) => handleFilterChange("priority", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Priorities</SelectItem>
                  <SelectItem value="P1">P1 - Critical</SelectItem>
                  <SelectItem value="P2">P2 - High</SelectItem>
                  <SelectItem value="P3">P3 - Medium</SelectItem>
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select
                value={filters.category}
                onValueChange={(value) => handleFilterChange("category", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  <SelectItem value="Malware">Malware</SelectItem>
                  <SelectItem value="Phishing">Phishing</SelectItem>
                  <SelectItem value="DDoS">DDoS</SelectItem>
                  <SelectItem value="Data Breach">Data Breach</SelectItem>
                  <SelectItem value="Insider Threat">Insider Threat</SelectItem>
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
            <p>Error loading cases: {error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={loadCases}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Cases Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded"></div>
                    <div className="h-3 bg-muted rounded w-5/6"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : cases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cases.map((case_) => (
              <Card
                key={case_._id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/cases/${case_._id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        {case_.title}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {case_.caseId}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(case_.createdAt)}
                        </span>
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {case_.description}
                  </p>

                  <div className="flex items-center gap-2">
                    <Badge className={getPriorityColor(case_.priority)}>
                      {case_.priority}
                    </Badge>
                    <Badge className={getStatusColor(case_.status)}>
                      <StatusIcon status={case_.status} />
                      <span className="ml-1">{case_.status}</span>
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>
                        {case_.assignedTo
                          ? `${case_.assignedTo.firstName} ${case_.assignedTo.lastName}`
                          : "Unassigned"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span
                        className={cn(
                          isOverdue(case_.sla.dueDate, case_.status) &&
                            "text-destructive font-medium"
                        )}
                      >
                        {formatDate(case_.sla.dueDate)}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {case_.category}
                    </span>
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No cases found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {filters.search ||
                filters.status ||
                filters.priority ||
                filters.category
                  ? "Try adjusting your filters to see more results."
                  : "Get started by creating your first security case."}
              </p>
              {user?.role !== "viewer" && (
                <Button onClick={() => router.push("/cases/create")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Case
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing page {pagination.page} of {pagination.totalPages} (
              {pagination.totalCount} total cases)
            </p>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={!pagination.hasPrevPage}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!pagination.hasNextPage}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
