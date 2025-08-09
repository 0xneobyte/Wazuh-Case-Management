'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { handleAPIError } from '@/services/api';
import { 
  ShieldCheckIcon,
  ServerIcon,
  ArrowTopRightOnSquareIcon,
  PlayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CogIcon,
  DocumentTextIcon,
  ArrowPathIcon
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

interface SIEMIntegration {
  id: string;
  name: string;
  description: string;
  type: 'open-source' | 'commercial' | 'demo';
  status: 'connected' | 'disconnected' | 'available' | 'configured';
  logo?: string;
  features: string[];
  alertCount?: number;
  lastSync?: string;
  version?: string;
  documentation?: string;
}

const SIEM_INTEGRATIONS: SIEMIntegration[] = [
  {
    id: 'demo-siem',
    name: 'Demo SIEM',
    description: 'Demonstration SIEM with sample security alerts and events for testing purposes',
    type: 'demo',
    status: 'available',
    features: [
      'Sample Security Alerts',
      'Demo Attack Scenarios', 
      'Synthetic Log Data',
      'Testing Environment'
    ],
    documentation: '#demo-siem-docs'
  },
  {
    id: 'wazuh',
    name: 'Wazuh SIEM',
    description: 'Open-source security platform that performs log analysis, file integrity checking, policy monitoring and intrusion detection',
    type: 'open-source',
    status: 'configured',
    features: [
      'Real-time Log Analysis',
      'Intrusion Detection',
      'File Integrity Monitoring',
      'Vulnerability Detection',
      'Compliance Reporting'
    ],
    alertCount: 47,
    lastSync: '2025-08-09T15:30:00Z',
    version: '4.7.3',
    documentation: 'https://documentation.wazuh.com/'
  },
  {
    id: 'elastic-siem',
    name: 'Elastic Security',
    description: 'Elastic Security combines SIEM, endpoint security, and threat hunting in a single solution',
    type: 'open-source',
    status: 'available',
    features: [
      'SIEM & Analytics',
      'Endpoint Security',
      'Threat Hunting',
      'Timeline Analysis',
      'Machine Learning'
    ],
    documentation: 'https://www.elastic.co/guide/en/security/current/index.html'
  },
  {
    id: 'opensearch',
    name: 'OpenSearch Security',
    description: 'Open-source search and analytics suite with built-in security analytics capabilities',
    type: 'open-source', 
    status: 'available',
    features: [
      'Security Analytics',
      'Log Correlation',
      'Anomaly Detection',
      'Threat Intelligence',
      'Custom Dashboards'
    ],
    documentation: 'https://opensearch.org/docs/latest/security-analytics/'
  },
  {
    id: 'suricata',
    name: 'Suricata IDS/IPS',
    description: 'High performance Network IDS, IPS and Network Security Monitoring engine',
    type: 'open-source',
    status: 'available', 
    features: [
      'Network Intrusion Detection',
      'Protocol Analysis',
      'File Extraction',
      'Lua Scripting',
      'Multi-threading'
    ],
    documentation: 'https://docs.suricata.io/'
  },
  {
    id: 'osquery',
    name: 'OSquery',
    description: 'SQL-based framework for querying operating system information as a relational database',
    type: 'open-source',
    status: 'available',
    features: [
      'Endpoint Visibility',
      'SQL-based Queries', 
      'Cross-platform Support',
      'Real-time Monitoring',
      'Incident Response'
    ],
    documentation: 'https://osquery.readthedocs.io/'
  },
  {
    id: 'graylog',
    name: 'Graylog',
    description: 'Centralized log management platform with powerful search and analysis capabilities',
    type: 'open-source',
    status: 'available',
    features: [
      'Log Management',
      'Stream Processing',
      'Alerting & Notifications',
      'Search & Analysis',
      'Dashboard Creation'
    ],
    documentation: 'https://docs.graylog.org/'
  },
  {
    id: 'security-onion',
    name: 'Security Onion',
    description: 'Linux distro for threat hunting, enterprise security monitoring, and log management',
    type: 'open-source',
    status: 'available',
    features: [
      'Network Security Monitoring',
      'Threat Hunting',
      'Log Management',
      'Incident Response',
      'All-in-one Solution'
    ],
    documentation: 'https://docs.securityonion.net/'
  }
];

export default function SIEMIntegrationPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [integrations, setIntegrations] = useState<SIEMIntegration[]>(SIEM_INTEGRATIONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (user) {
      // Check if user has permission to access SIEM integrations
      if (!['admin', 'senior_analyst'].includes(user.role)) {
        router.push('/');
        return;
      }
    }
  }, [user, isLoading, router]);

  const handleIntegrationClick = (integration: SIEMIntegration) => {
    if (integration.id === 'demo-siem') {
      router.push('/siem/demo');
    } else if (integration.id === 'wazuh' && integration.status === 'configured') {
      router.push('/siem/wazuh');
    } else {
      // For other integrations, show configuration modal or redirect to docs
      if (integration.documentation && integration.documentation.startsWith('http')) {
        window.open(integration.documentation, '_blank');
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'configured':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'available':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'disconnected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'configured':
        return <CogIcon className="h-4 w-4" />;
      case 'available':
        return <PlayIcon className="h-4 w-4" />;
      case 'disconnected':
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      default:
        return <ServerIcon className="h-4 w-4" />;
    }
  };

  const formatLastSync = (lastSync?: string) => {
    if (!lastSync) return 'Never';
    return new Date(lastSync).toLocaleDateString();
  };

  if (isLoading) {
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
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              SIEM Integration Hub
            </h1>
            <p className="text-muted-foreground">
              Connect and manage various SIEM solutions for comprehensive security monitoring
            </p>
          </div>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            Refresh
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

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Integrations</p>
                  <p className="text-2xl font-bold">{integrations.length}</p>
                </div>
                <ServerIcon className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Connected</p>
                  <p className="text-2xl font-bold text-green-600">
                    {integrations.filter(i => i.status === 'connected' || i.status === 'configured').length}
                  </p>
                </div>
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Open Source</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {integrations.filter(i => i.type === 'open-source').length}
                  </p>
                </div>
                <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Alerts</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {integrations.reduce((sum, i) => sum + (i.alertCount || 0), 0)}
                  </p>
                </div>
                <ExclamationTriangleIcon className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integration Categories */}
        <div className="space-y-8">
          {/* Demo & Testing */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <PlayIcon className="h-5 w-5 text-green-600" />
              <h2 className="text-xl font-semibold">Demo & Testing</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {integrations.filter(i => i.type === 'demo').map((integration) => (
                <Card key={integration.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <span>{integration.name}</span>
                        {integration.status === 'configured' && (
                          <Badge variant="secondary">
                            {integration.alertCount} alerts
                          </Badge>
                        )}
                      </CardTitle>
                      <Badge className={getStatusColor(integration.status)}>
                        {getStatusIcon(integration.status)}
                        <span className="ml-1 capitalize">{integration.status}</span>
                      </Badge>
                    </div>
                    <CardDescription>{integration.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Features:</h4>
                        <div className="flex flex-wrap gap-1">
                          {integration.features.map((feature, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {(integration.lastSync || integration.version) && (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {integration.version && (
                            <div>
                              <span className="font-medium">Version:</span>
                              <p className="text-muted-foreground">{integration.version}</p>
                            </div>
                          )}
                          {integration.lastSync && (
                            <div>
                              <span className="font-medium">Last Sync:</span>
                              <p className="text-muted-foreground">{formatLastSync(integration.lastSync)}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex space-x-2 pt-2">
                        <Button 
                          onClick={() => handleIntegrationClick(integration)}
                          className="flex-1"
                          variant={integration.status === 'available' ? 'default' : 'secondary'}
                        >
                          {integration.status === 'available' ? 'Launch Demo' : 'Open'}
                          <ArrowTopRightOnSquareIcon className="ml-2 h-4 w-4" />
                        </Button>
                        
                        {integration.documentation && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (integration.documentation?.startsWith('http')) {
                                window.open(integration.documentation, '_blank');
                              }
                            }}
                          >
                            <DocumentTextIcon className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Open Source SIEM Solutions */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <ShieldCheckIcon className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold">Open Source SIEM Solutions</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {integrations.filter(i => i.type === 'open-source').map((integration) => (
                <Card key={integration.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <span>{integration.name}</span>
                        {integration.alertCount && (
                          <Badge variant="secondary">
                            {integration.alertCount} alerts
                          </Badge>
                        )}
                      </CardTitle>
                      <Badge className={getStatusColor(integration.status)}>
                        {getStatusIcon(integration.status)}
                        <span className="ml-1 capitalize">{integration.status}</span>
                      </Badge>
                    </div>
                    <CardDescription>{integration.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Features:</h4>
                        <div className="flex flex-wrap gap-1">
                          {integration.features.map((feature, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {(integration.lastSync || integration.version) && (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {integration.version && (
                            <div>
                              <span className="font-medium">Version:</span>
                              <p className="text-muted-foreground">{integration.version}</p>
                            </div>
                          )}
                          {integration.lastSync && (
                            <div>
                              <span className="font-medium">Last Sync:</span>
                              <p className="text-muted-foreground">{formatLastSync(integration.lastSync)}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex space-x-2 pt-2">
                        <Button 
                          onClick={() => handleIntegrationClick(integration)}
                          className="flex-1"
                          variant={integration.status === 'configured' ? 'default' : 'outline'}
                          disabled={integration.status === 'available'}
                        >
                          {integration.status === 'configured' ? 'Manage' : 
                           integration.status === 'available' ? 'Configure' : 'Setup'}
                          <ArrowTopRightOnSquareIcon className="ml-2 h-4 w-4" />
                        </Button>
                        
                        {integration.documentation && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (integration.documentation?.startsWith('http')) {
                                window.open(integration.documentation, '_blank');
                              }
                            }}
                          >
                            <DocumentTextIcon className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}