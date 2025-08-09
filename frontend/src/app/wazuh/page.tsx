'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { wazuhAPI, handleAPIError } from '@/services/api';
import { 
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowPathIcon,
  SignalIcon,
  ServerIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

interface WazuhAlert {
  id: string;
  timestamp: string;
  agent: {
    id: string;
    name: string;
    ip: string;
  };
  rule: {
    id: number;
    level: number;
    description: string;
    groups: string[];
  };
  location: string;
  full_log: string;
  decoder: {
    name: string;
  };
  data?: unknown;
}

interface WazuhStatus {
  connected: boolean;
  lastSync: string;
  version: string;
  totalAgents: number;
  activeAgents: number;
  alertsToday: number;
}

export default function WazuhPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [alerts, setAlerts] = useState<WazuhAlert[]>([]);
  const [status, setStatus] = useState<WazuhStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState({
    level: '',
    agent: '',
    rule: ''
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (user) {
      // Check if user has permission to access Wazuh integration
      if (!['admin', 'senior_analyst'].includes(user.role)) {
        router.push('/');
        return;
      }
      loadWazuhData();
    }
  }, [user, isLoading, router]);

  const loadWazuhData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statusResponse, alertsResponse] = await Promise.all([
        wazuhAPI.getStatus(),
        wazuhAPI.getAlerts({ limit: 50 })
      ]);

      if (statusResponse.success) {
        setStatus(statusResponse.data);
      }

      if (alertsResponse.success) {
        setAlerts(alertsResponse.data);
      }

    } catch (error) {
      console.error('Wazuh data loading error:', error);
      const apiError = handleAPIError(error);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  const syncAlerts = async () => {
    try {
      setSyncing(true);
      setError(null);

      const response = await wazuhAPI.syncAlerts();

      if (response.success) {
        // Reload data after sync
        await loadWazuhData();
      } else {
        throw new Error(response.error?.message || 'Sync failed');
      }

    } catch (error) {
      console.error('Wazuh sync error:', error);
      const apiError = handleAPIError(error);
      setError(apiError.message);
    } finally {
      setSyncing(false);
    }
  };

  const createCaseFromAlert = async (alert: WazuhAlert) => {
    try {
      const response = await wazuhAPI.createCaseFromAlert(alert.id);
      
      if (response.success) {
        router.push(`/cases/${response.data.caseId}`);
      } else {
        throw new Error(response.error?.message || 'Failed to create case');
      }
    } catch (error) {
      console.error('Case creation error:', error);
      const apiError = handleAPIError(error);
      setError(apiError.message);
    }
  };

  const getSeverityColor = (level: number) => {
    if (level >= 12) return 'bg-red-100 text-red-800';
    if (level >= 7) return 'bg-yellow-100 text-yellow-800';
    if (level >= 4) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getSeverityLabel = (level: number) => {
    if (level >= 12) return 'Critical';
    if (level >= 7) return 'High';
    if (level >= 4) return 'Medium';
    return 'Low';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !['admin', 'senior_analyst'].includes(user.role)) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Wazuh Integration</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Monitor SIEM alerts and manage security events
                </p>
              </div>
            </div>
            
            <button
              onClick={syncAlerts}
              disabled={syncing}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className={`-ml-1 mr-2 h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Alerts'}
            </button>
          </div>
          
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              <p>Error: {error}</p>
              <button 
                onClick={() => setError(null)}
                className="mt-2 text-sm underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Status Cards */}
        {status && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="card">
              <div className="card-body">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`p-2 rounded-lg ${status.connected ? 'bg-green-100' : 'bg-red-100'}`}>
                      <SignalIcon className={`h-6 w-6 ${status.connected ? 'text-green-600' : 'text-red-600'}`} />
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Connection Status</p>
                    <p className={`text-lg font-semibold ${status.connected ? 'text-green-600' : 'text-red-600'}`}>
                      {status.connected ? 'Connected' : 'Disconnected'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <ServerIcon className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Active Agents</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {status.activeAgents} / {status.totalAgents}
                    </p>
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
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Alerts Today</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {status.alertsToday}
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
                      <ClockIcon className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Last Sync</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatTimestamp(status.lastSync)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Filter Alerts</h3>
          </div>
          <div className="px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={filters.level}
                onChange={(e) => setFilters(prev => ({ ...prev, level: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Severity Levels</option>
                <option value="12">Critical (12+)</option>
                <option value="7">High (7-11)</option>
                <option value="4">Medium (4-6)</option>
                <option value="1">Low (1-3)</option>
              </select>

              <input
                type="text"
                placeholder="Filter by agent..."
                value={filters.agent}
                onChange={(e) => setFilters(prev => ({ ...prev, agent: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />

              <input
                type="text"
                placeholder="Filter by rule..."
                value={filters.rule}
                onChange={(e) => setFilters(prev => ({ ...prev, rule: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Alerts List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Alerts</h3>
          </div>
          
          {alerts.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {alerts
                .filter(alert => {
                  if (filters.level && alert.rule.level < parseInt(filters.level)) return false;
                  if (filters.agent && !alert.agent.name.toLowerCase().includes(filters.agent.toLowerCase())) return false;
                  if (filters.rule && !alert.rule.description.toLowerCase().includes(filters.rule.toLowerCase())) return false;
                  return true;
                })
                .map((alert) => (
                <li key={alert.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(alert.rule.level)}`}>
                          {getSeverityLabel(alert.rule.level)} ({alert.rule.level})
                        </span>
                        <span className="text-sm text-gray-500">
                          Rule {alert.rule.id}
                        </span>
                        <span className="text-sm text-gray-500">
                          Agent: {alert.agent.name} ({alert.agent.ip})
                        </span>
                      </div>
                      
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {alert.rule.description}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Location: {alert.location}</span>
                        <span>Decoder: {alert.decoder.name}</span>
                        <span>{formatTimestamp(alert.timestamp)}</span>
                      </div>
                      
                      {alert.rule.groups && alert.rule.groups.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {alert.rule.groups.map((group, index) => (
                            <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              {group}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => {
                          // Toggle full log display - you could implement this
                          console.log('Full log:', alert.full_log);
                        }}
                        className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <EyeIcon className="h-3 w-3 mr-1" />
                        View Log
                      </button>
                      
                      <button
                        onClick={() => createCaseFromAlert(alert)}
                        className="inline-flex items-center px-2 py-1 border border-transparent rounded text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Create Case
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12">
              <ShieldCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No alerts found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {status?.connected ? 
                  'No alerts match your current filters.' : 
                  'Connect to Wazuh to view alerts.'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}