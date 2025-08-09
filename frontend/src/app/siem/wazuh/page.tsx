'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { wazuhAPI, handleAPIError } from '@/services/api';
import { 
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowPathIcon,
  SignalIcon,
  ServerIcon,
  EyeIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
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

export default function WazuhSIEMPage() {
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
    if (level >= 12) return 'bg-red-100 text-red-800 border-red-200';
    if (level >= 7) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (level >= 4) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
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

  const filteredAlerts = alerts.filter(alert => {
    if (filters.level && alert.rule.level < parseInt(filters.level)) return false;
    if (filters.agent && !alert.agent.name.toLowerCase().includes(filters.agent.toLowerCase())) return false;
    if (filters.rule && !alert.rule.description.toLowerCase().includes(filters.rule.toLowerCase())) return false;
    return true;
  });

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
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back
            </Button>
            <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Wazuh SIEM</h1>
              <p className="text-muted-foreground">
                Monitor Wazuh security alerts and manage incidents
              </p>
            </div>
          </div>
          
          <Button
            onClick={syncAlerts}
            disabled={syncing}
          >
            <ArrowPathIcon className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Alerts'}
          </Button>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
            <p>Error: {error}</p>
            <Button
              variant="outline"
              size="sm" 
              onClick={() => setError(null)}
              className="mt-2"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Status Cards */}
        {status && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Connection Status</p>
                    <p className={`text-lg font-semibold ${status.connected ? 'text-green-600' : 'text-red-600'}`}>
                      {status.connected ? 'Connected' : 'Disconnected'}
                    </p>
                  </div>
                  <SignalIcon className={`h-8 w-8 ${status.connected ? 'text-green-600' : 'text-red-600'}`} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Agents</p>
                    <p className="text-2xl font-bold">
                      {status.activeAgents} / {status.totalAgents}
                    </p>
                  </div>
                  <ServerIcon className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Alerts Today</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {status.alertsToday}
                    </p>
                  </div>
                  <ExclamationTriangleIcon className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Version</p>
                    <p className="text-lg font-semibold">
                      {status.version}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatTimestamp(status.lastSync)}
                    </p>
                  </div>
                  <ClockIcon className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filter Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={filters.level || undefined} onValueChange={(value) => setFilters(prev => ({ ...prev, level: value || '' }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Severity Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">Critical (12+)</SelectItem>
                  <SelectItem value="7">High (7-11)</SelectItem>
                  <SelectItem value="4">Medium (4-6)</SelectItem>
                  <SelectItem value="1">Low (1-3)</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Filter by agent..."
                value={filters.agent}
                onChange={(e) => setFilters(prev => ({ ...prev, agent: e.target.value }))}
              />

              <Input
                placeholder="Filter by rule..."
                value={filters.rule}
                onChange={(e) => setFilters(prev => ({ ...prev, rule: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Alerts List */}
        <Card>
          <CardHeader>
            <CardTitle>Wazuh Security Alerts</CardTitle>
            <CardDescription>
              Real-time security alerts from Wazuh SIEM platform
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredAlerts.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredAlerts.map((alert) => (
                  <div key={alert.id} className="p-4 hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <Badge className={getSeverityColor(alert.rule.level)}>
                            {getSeverityLabel(alert.rule.level)} ({alert.rule.level})
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Rule {alert.rule.id}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Agent: {alert.agent.name} ({alert.agent.ip})
                          </span>
                        </div>
                        
                        <p className="text-sm font-medium text-foreground mb-1">
                          {alert.rule.description}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <span>Location: {alert.location}</span>
                          <span>Decoder: {alert.decoder.name}</span>
                          <span>{formatTimestamp(alert.timestamp)}</span>
                        </div>
                        
                        {alert.rule.groups && alert.rule.groups.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {alert.rule.groups.map((group, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {group}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            console.log('Full log:', alert.full_log);
                          }}
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          View Log
                        </Button>
                        
                        <Button
                          size="sm"
                          onClick={() => createCaseFromAlert(alert)}
                        >
                          Create Case
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <ShieldCheckIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium">No alerts found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {status?.connected ? 
                    'No alerts match your current filters.' : 
                    'Connect to Wazuh to view alerts.'
                  }
                </p>
                {!status?.connected && (
                  <Button
                    onClick={syncAlerts}
                    disabled={syncing}
                    className="mt-4"
                  >
                    <ArrowPathIcon className="mr-2 h-4 w-4" />
                    Connect to Wazuh
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}