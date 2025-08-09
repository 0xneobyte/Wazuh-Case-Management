'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { handleAPIError } from '@/services/api';
import { 
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowPathIcon,
  SignalIcon,
  ServerIcon,
  EyeIcon,
  BeakerIcon,
  ChartBarIcon
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
import { Progress } from "@/components/ui/progress";
import axios from 'axios';

interface DemoAlert {
  _id: string;
  timestamp: string;
  source: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  category: string;
  title: string;
  description: string;
  sourceIP: string;
  targetIP?: string;
  rule: {
    id: string;
    name: string;
  };
  tags: string[];
  status: 'new' | 'investigating' | 'resolved';
}

interface DemoStats {
  totalAlerts: number;
  criticalAlerts: number;
  highAlerts: number;
  mediumAlerts: number;
  lowAlerts: number;
  lastSync: string;
  alertsToday: number;
}

interface SyncProgress {
  phase: 'generating' | 'creating_cases' | 'sending_emails' | 'complete';
  message: string;
  progress: number;
}

export default function DemoSIEMPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [alerts, setAlerts] = useState<DemoAlert[]>([]);
  const [stats, setStats] = useState<DemoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [filters, setFilters] = useState({
    severity: '',
    category: '',
    status: ''
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (user) {
      // Check if user has permission to access SIEM
      if (!['admin', 'senior_analyst'].includes(user.role)) {
        router.push('/');
        return;
      }
      loadDemoData();
    }
  }, [user, isLoading, router]);

  const loadDemoData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const [alertsResponse, statsResponse] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api"}/siem/demo/alerts`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api"}/siem/demo/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (alertsResponse.data.success) {
        setAlerts(alertsResponse.data.data);
      }

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }

    } catch (error) {
      console.error('Demo SIEM data loading error:', error);
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
      setSyncProgress({ phase: 'generating', message: 'Generating demo alerts...', progress: 10 });

      const token = localStorage.getItem('token');
      
      // Start the actual API call
      const syncPromise = axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api"}/siem/demo/sync`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Simulate progress updates while API is running
      const progressTimer1 = setTimeout(() => {
        setSyncProgress({ phase: 'creating_cases', message: 'Creating cases for high-severity alerts...', progress: 40 });
      }, 500);

      const progressTimer2 = setTimeout(() => {
        setSyncProgress({ phase: 'sending_emails', message: 'Processing email notifications...', progress: 70 });
      }, 1500);

      // Wait for the actual API response
      const response = await syncPromise;

      // Clear any pending timers
      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);

      if (response.data.success) {
        // Show final progress immediately when API completes
        setSyncProgress({ phase: 'complete', message: 'Sync completed successfully!', progress: 100 });
        
        // Brief delay to show completion, then reload data
        setTimeout(async () => {
          await loadDemoData();
          setSyncProgress(null);
        }, 1000);
      } else {
        throw new Error(response.data.error?.message || 'Sync failed');
      }

    } catch (error) {
      console.error('Demo SIEM sync error:', error);
      const apiError = handleAPIError(error);
      setError(apiError.message);
      setSyncProgress(null);
    } finally {
      setSyncing(false);
    }
  };

  const createCaseFromAlert = async (alert: DemoAlert) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api"}/siem/demo/create-case`,
        { alertId: alert._id },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data.success) {
        router.push(`/cases/${response.data.data.caseId}`);
      } else {
        throw new Error(response.data.error?.message || 'Failed to create case');
      }
    } catch (error) {
      console.error('Case creation error:', error);
      const apiError = handleAPIError(error);
      setError(apiError.message);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'High':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-red-100 text-red-800';
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filters.severity && alert.severity !== filters.severity) return false;
    if (filters.category && alert.category !== filters.category) return false;
    if (filters.status && alert.status !== filters.status) return false;
    return true;
  });

  const uniqueCategories = [...new Set(alerts.map(alert => alert.category))];

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
            <BeakerIcon className="h-8 w-8 text-green-600" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Demo SIEM</h1>
              <p className="text-muted-foreground">
                Demonstration SIEM with synthetic security alerts for training and testing
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
        
        {/* Progress Bar */}
        {syncProgress && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Syncing Demo Alerts...</h4>
                  <span className="text-sm text-muted-foreground">{syncProgress.progress}%</span>
                </div>
                <Progress value={syncProgress.progress} className="w-full" />
                <p className="text-sm text-muted-foreground">{syncProgress.message}</p>
              </div>
            </CardContent>
          </Card>
        )}

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
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Alerts</p>
                    <p className="text-2xl font-bold">{stats.totalAlerts}</p>
                  </div>
                  <ChartBarIcon className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Critical</p>
                    <p className="text-2xl font-bold text-red-600">{stats.criticalAlerts}</p>
                  </div>
                  <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Today</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.alertsToday}</p>
                  </div>
                  <ClockIcon className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Demo Status</p>
                    <p className="text-lg font-semibold text-green-600">Active</p>
                  </div>
                  <SignalIcon className="h-8 w-8 text-green-600" />
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
              <Select value={filters.severity || undefined} onValueChange={(value) => setFilters(prev => ({ ...prev, severity: value || '' }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Severity Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.category || undefined} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value || '' }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.status || undefined} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value || '' }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Alerts List */}
        <Card>
          <CardHeader>
            <CardTitle>Demo Security Alerts</CardTitle>
            <CardDescription>
              Synthetic security alerts generated for demonstration and training purposes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredAlerts.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredAlerts.map((alert) => (
                  <div key={alert._id} className="p-4 hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <Badge className={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          <Badge className={getStatusColor(alert.status)}>
                            {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Rule: {alert.rule.id}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Source: {alert.source}
                          </span>
                        </div>
                        
                        <p className="text-sm font-medium text-foreground mb-1">
                          {alert.title}
                        </p>
                        
                        <p className="text-sm text-muted-foreground mb-2">
                          {alert.description}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <span>Category: {alert.category}</span>
                          <span>Source IP: {alert.sourceIP}</span>
                          {alert.targetIP && <span>Target IP: {alert.targetIP}</span>}
                          <span>{formatTimestamp(alert.timestamp)}</span>
                        </div>
                        
                        {alert.tags && alert.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {alert.tags.map((tag, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => console.log('Alert details:', alert)}
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          Details
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
                <BeakerIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium">No demo alerts found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {alerts.length === 0 
                    ? 'Click "Sync Alerts" to load demo security alerts.'
                    : 'No alerts match your current filters.'
                  }
                </p>
                {alerts.length === 0 && (
                  <Button
                    onClick={syncAlerts}
                    disabled={syncing}
                    className="mt-4"
                  >
                    <ArrowPathIcon className="mr-2 h-4 w-4" />
                    Load Demo Alerts
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