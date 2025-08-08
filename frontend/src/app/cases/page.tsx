'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { casesAPI, handleAPIError } from '@/services/api';
import { 
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

interface Case {
  _id: string;
  caseId: string;
  title: string;
  description: string;
  priority: 'P1' | 'P2' | 'P3';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
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
    'Open': ExclamationTriangleIcon,
    'In Progress': ClockIcon,
    'Resolved': CheckCircleIcon,
    'Closed': XCircleIcon
  };
  const Icon = icons[status as keyof typeof icons] || ExclamationTriangleIcon;
  return <Icon className="h-4 w-4" />;
};

export default function CasesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<CasesResponse['pagination'] | null>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: '',
    search: '',
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (user) {
      loadCases();
    }
  }, [user, isLoading, router, currentPage, filters]);

  const loadCases = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        page: currentPage,
        limit: 20,
        sort: '-createdAt',
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
        throw new Error(response.error?.message || 'Failed to load cases');
      }

    } catch (error) {
      console.error('Cases loading error:', error);
      const apiError = handleAPIError(error);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      priority: '',
      category: '',
      search: '',
    });
    setCurrentPage(1);
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      'P1': 'bg-red-100 text-red-800',
      'P2': 'bg-yellow-100 text-yellow-800',
      'P3': 'bg-green-100 text-green-800'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'Open': 'bg-red-100 text-red-800',
      'In Progress': 'bg-blue-100 text-blue-800',
      'Resolved': 'bg-green-100 text-green-800',
      'Closed': 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isOverdue = (dueDate: string, status: string) => {
    return new Date(dueDate) < new Date() && !['Resolved', 'Closed'].includes(status);
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Cases</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage and track security cases
            </p>
          </div>
          {user?.role !== 'viewer' && (
            <div className="mt-4 sm:mt-0">
              <button
                onClick={() => router.push('/cases/create')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                Create Case
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p>Error: {error}</p>
            <button 
              onClick={loadCases}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filters</span>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search cases..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-full"
                />
              </div>

              {/* Status Filter */}
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>

              {/* Priority Filter */}
              <select
                value={filters.priority}
                onChange={(e) => handleFilterChange('priority', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Priorities</option>
                <option value="P1">P1 - Critical</option>
                <option value="P2">P2 - High</option>
                <option value="P3">P3 - Medium</option>
              </select>

              {/* Category Filter */}
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Categories</option>
                <option value="Malware">Malware</option>
                <option value="Intrusion">Intrusion</option>
                <option value="Policy Violation">Policy Violation</option>
                <option value="Vulnerability">Vulnerability</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="mt-3 flex justify-end">
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear filters
              </button>
            </div>
          </div>
        </div>

        {/* Cases List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {cases.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {cases.map((case_) => (
                <li key={case_._id}>
                  <div 
                    className="px-4 py-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/cases/${case_._id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <StatusIcon status={case_.status} />
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {case_.title}
                          </p>
                          {isOverdue(case_.sla.dueDate, case_.status) && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              OVERDUE
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {case_.caseId} • {case_.assignedTo ? 
                            `Assigned to ${case_.assignedTo.firstName} ${case_.assignedTo.lastName}` : 
                            'Unassigned'
                          }
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Created {formatDate(case_.createdAt)} • Due {formatDate(case_.sla.dueDate)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(case_.priority)}`}>
                          {case_.priority}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(case_.status)}`}>
                          {case_.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {case_.category}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12">
              <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No cases found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {Object.values(filters).some(v => v) ? 
                  'Try adjusting your filters or search terms.' :
                  'Get started by creating a new case.'
                }
              </p>
              {user?.role !== 'viewer' && !Object.values(filters).some(v => v) && (
                <div className="mt-6">
                  <button
                    onClick={() => router.push('/cases/create')}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                    Create your first case
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, pagination.totalCount)} of{' '}
              {pagination.totalCount} cases
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={!pagination.hasPrevPage}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm">
                Page {currentPage} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={!pagination.hasNextPage}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}