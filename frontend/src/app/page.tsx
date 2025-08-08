'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import DashboardLayout from '../components/layout/DashboardLayout';
import { 
  ExclamationTriangleIcon, 
  ClockIcon, 
  CheckCircleIcon,
  UsersIcon 
} from '@heroicons/react/24/outline';

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  // Mock data for demo
  const stats = [
    {
      title: 'Open Cases',
      value: 12,
      icon: ExclamationTriangleIcon,
      color: 'red',
      change: +2
    },
    {
      title: 'In Progress',
      value: 8,
      icon: ClockIcon,
      color: 'yellow',
      change: -1
    },
    {
      title: 'Resolved Today',
      value: 5,
      icon: CheckCircleIcon,
      color: 'green',
      change: +3
    },
    {
      title: 'Active Analysts',
      value: 4,
      icon: UsersIcon,
      color: 'blue',
      change: 0
    }
  ];

  const recentCases = [
    {
      id: 'CASE-2024-01-08-00001',
      title: 'Suspicious Login Activity',
      priority: 'P1',
      status: 'Open',
      assignedTo: 'John Doe',
      createdAt: '2024-01-08T10:30:00Z'
    },
    {
      id: 'CASE-2024-01-08-00002', 
      title: 'Malware Detection',
      priority: 'P2',
      status: 'In Progress',
      assignedTo: 'Jane Smith',
      createdAt: '2024-01-08T09:15:00Z'
    },
    {
      id: 'CASE-2024-01-08-00003',
      title: 'Policy Violation',
      priority: 'P3',
      status: 'Resolved',
      assignedTo: 'Mike Johnson',
      createdAt: '2024-01-08T08:45:00Z'
    }
  ];

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
                  {recentCases.map((case_) => (
                    <li key={case_.id} className="p-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {case_.title}
                          </p>
                          <p className="text-sm text-gray-500">
                            {case_.id} • Assigned to {case_.assignedTo}
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
                  ))}
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
                <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
                  <h4 className="font-medium text-gray-900">Create Case</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Manually create a new security case
                  </p>
                </button>
                
                <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
                  <h4 className="font-medium text-gray-900">AI Assistant</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Get remediation guidance and recommendations
                  </p>
                </button>
                
                <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
                  <h4 className="font-medium text-gray-900">View Analytics</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Analyze performance and trends
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
