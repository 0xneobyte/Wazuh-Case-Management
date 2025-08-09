'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import DashboardLayout from '../components/layout/DashboardLayout';
import { dashboardAPI, casesAPI, handleAPIError } from '@/services/api';
import { 
  ExclamationTriangleIcon, 
  ClockIcon, 
  CheckCircleIcon
} from '@heroicons/react/24/outline';

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
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null);
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
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
        casesAPI.getCases({ page: 1, limit: 5, sort: '-createdAt' })
      ]);

      if (overviewResponse.success) {
        setDashboardData(overviewResponse.data.overview);
      }

      if (casesResponse.success) {
        setRecentCases(casesResponse.data);
      }

    } catch (error) {
      console.error('Dashboard data loading error:', error);
      const apiError = handleAPIError(error);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  // Create stats array from real data
  const stats = [
    {
      title: 'Open Cases',
      value: dashboardData?.openCases || 0,
      icon: ExclamationTriangleIcon,
      color: 'red',
      change: 0 // You can calculate change from previous period if needed
    },
    {
      title: 'In Progress',
      value: dashboardData?.inProgressCases || 0,
      icon: ClockIcon,
      color: 'yellow', 
      change: 0
    },
    {
      title: 'Resolved',
      value: dashboardData?.resolvedCases || 0,
      icon: CheckCircleIcon,
      color: 'green',
      change: 0
    },
    {
      title: 'Overdue Cases',
      value: dashboardData?.overdueCases || 0,
      icon: ExclamationTriangleIcon,
      color: 'orange',
      change: 0
    }
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Here&apos;s what&apos;s happening with your security cases today.
          </p>
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              <p>Error loading dashboard data: {error}</p>
              <button 
                onClick={loadDashboardData}
                className="mt-2 text-sm underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="card">
              <div className="card-body">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <stat.icon className={`h-8 w-8 text-${stat.color}-600`} />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {stat.title}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stat.value}
                      </dd>
                    </dl>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      stat.change > 0 
                        ? 'bg-green-100 text-green-800' 
                        : stat.change < 0 
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {stat.change > 0 ? '+' : ''}{stat.change}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Cases */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Recent Cases</h3>
            </div>
            <div className="card-body p-0">
              <div className="flow-root">
                <ul className="divide-y divide-gray-200">
                  {recentCases.length > 0 ? (
                    recentCases.map((case_) => (
                      <li key={case_._id} className="p-4 hover:bg-gray-50 cursor-pointer">
                        <div className="flex items-center space-x-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {case_.title}
                            </p>
                            <p className="text-sm text-gray-500">
                              {case_.caseId} • {case_.assignedTo ? 
                                `Assigned to ${case_.assignedTo.firstName} ${case_.assignedTo.lastName}` : 
                                'Unassigned'
                              }
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Created {formatDate(case_.createdAt)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium priority-${case_.priority.toLowerCase()}`}>
                              {case_.priority}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium status-${case_.status.toLowerCase().replace(' ', '-')}`}>
                              {case_.status}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="p-4 text-center text-gray-500">
                      <p>No recent cases found</p>
                      <p className="text-xs mt-1">Cases will appear here once created</p>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 gap-4">
                {user?.role !== 'viewer' && (
                  <button 
                    onClick={() => router.push('/cases/create')}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
                  >
                    <h4 className="font-medium text-gray-900">Create Case</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Manually create a new security case
                    </p>
                  </button>
                )}
                
                <button 
                  onClick={() => router.push('/ai-assistant')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  <h4 className="font-medium text-gray-900">AI Assistant</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Get remediation guidance and recommendations
                  </p>
                </button>
                
                <button 
                  onClick={() => router.push('/analytics')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  <h4 className="font-medium text-gray-900">View Analytics</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Analyze performance and trends
                  </p>
                </button>
                
                {(user?.role === 'admin' || user?.role === 'senior_analyst') && (
                  <button 
                    onClick={() => router.push('/wazuh')}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
                  >
                    <h4 className="font-medium text-gray-900">Wazuh Integration</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Manage SIEM alerts and sync
                    </p>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
