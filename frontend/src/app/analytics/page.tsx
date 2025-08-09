'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { dashboardAPI, handleAPIError } from '@/services/api';
import { 
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

interface AnalystPerformance {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  performance: {
    totalCasesAssigned: number;
    totalCasesResolved: number;
    avgResolutionTime: number | null;
    currentCaseLoad: number;
    overdueCases: number;
    rating: number | null;
  };
}

interface CaseMetrics {
  totalCases: number;
  openCases: number;
  inProgressCases: number;
  resolvedCases: number;
  closedCases: number;
  overdueCases: number;
  avgResolutionTime: number | null;
  casesByPriority: {
    P1: number;
    P2: number;
    P3: number;
  };
  casesThisMonth: number;
  casesLastMonth: number;
}

interface TimeRange {
  label: string;
  value: string;
}

export default function AnalyticsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [analysts, setAnalysts] = useState<AnalystPerformance[]>([]);
  const [metrics, setMetrics] = useState<CaseMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState('30d');

  const timeRanges: TimeRange[] = [
    { label: 'Last 7 days', value: '7d' },
    { label: 'Last 30 days', value: '30d' },
    { label: 'Last 90 days', value: '90d' },
    { label: 'Last year', value: '1y' }
  ];

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (user) {
      loadAnalyticsData();
    }
  }, [user, isLoading, router, selectedRange]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [performanceResponse, metricsResponse] = await Promise.all([
        dashboardAPI.getAnalystPerformance(),
        dashboardAPI.getCaseMetrics({ period: selectedRange })
      ]);

      if (performanceResponse.success) {
        setAnalysts(performanceResponse.data);
      }

      if (metricsResponse.success) {
        setMetrics(metricsResponse.data);
      }

    } catch (error) {
      console.error('Analytics data loading error:', error);
      const apiError = handleAPIError(error);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (hours: number | null | undefined) => {
    if (hours === null || hours === undefined || isNaN(hours)) {
      return 'N/A';
    }
    if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours.toFixed(0)}h`;
  };

  const getPerformanceColor = (rating: number | null | undefined) => {
    if (!rating) return 'text-gray-500';
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 3.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceLabel = (rating: number | null | undefined) => {
    if (!rating) return 'No Data';
    if (rating >= 4.5) return 'Excellent';
    if (rating >= 3.5) return 'Good';
    if (rating >= 2.5) return 'Average';
    return 'Needs Improvement';
  };

  const calculateCaseChange = () => {
    if (!metrics) return { change: 0, isIncrease: false };
    const change = metrics.casesThisMonth - metrics.casesLastMonth;
    const isIncrease = change > 0;
    return { change: Math.abs(change), isIncrease };
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

  const caseChange = calculateCaseChange();

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ChartBarIcon className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Analytics Dashboard</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Performance metrics and case analytics
                </p>
              </div>
            </div>
            
            <select
              value={selectedRange}
              onChange={(e) => setSelectedRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              {timeRanges.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>
          
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              <p>Error: {error}</p>
              <button 
                onClick={loadAnalyticsData}
                className="mt-2 text-sm underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Key Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="card">
              <div className="card-body">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <ChartBarIcon className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-500">Total Cases</p>
                    <p className="text-2xl font-semibold text-gray-900">{metrics.totalCases}</p>
                    <div className="flex items-center mt-1">
                      {caseChange.isIncrease ? (
                        <ArrowTrendingUpIcon className="h-3 w-3 text-green-500 mr-1" />
                      ) : (
                        <ArrowTrendingDownIcon className="h-3 w-3 text-red-500 mr-1" />
                      )}
                      <span className={`text-xs ${caseChange.isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                        {caseChange.change} vs last month
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-2 rounded-lg bg-yellow-100">
                      <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-500">Open Cases</p>
                    <p className="text-2xl font-semibold text-gray-900">{metrics.openCases}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {metrics.overdueCases} overdue
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-2 rounded-lg bg-green-100">
                      <CheckCircleIcon className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-500">Resolution Rate</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {metrics.totalCases > 0 ? Math.round((metrics.resolvedCases + metrics.closedCases) / metrics.totalCases * 100) : 0}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {metrics.resolvedCases + metrics.closedCases} resolved
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-2 rounded-lg bg-purple-100">
                      <ClockIcon className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-500">Avg Resolution</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatDuration(metrics.avgResolutionTime)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Time to resolve</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Priority Distribution */}
        {metrics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Cases by Priority</h3>
              </div>
              <div className="card-body">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                      <span className="text-sm font-medium text-gray-700">P1 - Critical</span>
                    </div>
                    <div className="text-sm text-gray-900 font-semibold">
                      {metrics.casesByPriority.P1}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                      <span className="text-sm font-medium text-gray-700">P2 - High</span>
                    </div>
                    <div className="text-sm text-gray-900 font-semibold">
                      {metrics.casesByPriority.P2}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                      <span className="text-sm font-medium text-gray-700">P3 - Medium</span>
                    </div>
                    <div className="text-sm text-gray-900 font-semibold">
                      {metrics.casesByPriority.P3}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Case Status Breakdown</h3>
              </div>
              <div className="card-body">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Open</span>
                    <span className="text-sm text-red-600 font-semibold">{metrics.openCases}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">In Progress</span>
                    <span className="text-sm text-blue-600 font-semibold">{metrics.inProgressCases}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Resolved</span>
                    <span className="text-sm text-green-600 font-semibold">{metrics.resolvedCases}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Closed</span>
                    <span className="text-sm text-gray-600 font-semibold">{metrics.closedCases}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analyst Performance */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center space-x-2">
              <UserGroupIcon className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900">Analyst Performance</h3>
            </div>
          </div>
          <div className="card-body p-0">
            {analysts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Analyst
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assigned
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Resolved
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Load
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Resolution
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Performance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Overdue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analysts.map((analyst) => (
                      <tr key={analyst._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {analyst.firstName} {analyst.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {analyst.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {analyst.performance.totalCasesAssigned}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {analyst.performance.totalCasesResolved}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {analyst.performance.currentCaseLoad}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDuration(analyst.performance.avgResolutionTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <TrophyIcon className={`h-4 w-4 ${getPerformanceColor(analyst.performance.rating)}`} />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {analyst.performance.rating ? analyst.performance.rating.toFixed(1) : 'N/A'}/5.0
                              </div>
                              <div className={`text-xs ${getPerformanceColor(analyst.performance.rating)}`}>
                                {getPerformanceLabel(analyst.performance.rating)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {analyst.performance.overdueCases > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {analyst.performance.overdueCases}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No analyst data</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Performance metrics will appear here once analysts start handling cases.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}