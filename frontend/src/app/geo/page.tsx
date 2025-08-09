"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { handleAPIError } from "@/services/api";
import axios from "axios";
import {
  MapPin,
  Search,
  Globe,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Server,
  Eye,
  Target,
  RefreshCw,
  Download,
  Copy,
  ExternalLink,
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface IPAnalysisResult {
  ip: string;
  timestamp: string;
  geolocation: {
    country: string;
    countryCode: string;
    region: string;
    city: string;
    zipCode: string | null;
    coordinates: {
      lat: number;
      lng: number;
    };
    timezone: string;
  };
  network: {
    isp: string;
    organization: string;
    asn: string | null;
    connectionType: string;
    usageType: string;
    domain: string | null;
  };
  security: {
    riskScore: number;
    riskLevel: string;
    riskColor: string;
    riskReasons: string[];
    abuseConfidence: number;
    totalReports: number;
    lastReported: string | null;
    isVPN: boolean;
    isTor: boolean;
    isProxy: boolean;
    isAnonymous: boolean;
    isWhitelisted: boolean;
    threatTypes: string[];
  };
  threatIntelligence: {
    totalPages: number;
    categoryBreakdown: Record<string, number>;
    reporterCountries: Array<{
      name: string;
      code: string;
      count: number;
    }>;
    recentReports: Array<{
      reportedAt: string;
      comment: string;
      categories: number[];
      reporterId: number;
      reporterCountryCode: string;
      reporterCountryName: string;
    }>;
  };
  recommendations: string[];
  dataSource: {
    geolocation: string;
    threatIntel: string;
  };
}

export default function IPAnalysisPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [ipAddress, setIpAddress] = useState("");
  const [analysis, setAnalysis] = useState<IPAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const isValidIP = (ip: string) => {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  };

  const analyzeIP = async () => {
    if (!ipAddress.trim()) {
      setError("Please enter an IP address");
      return;
    }

    if (!isValidIP(ipAddress.trim())) {
      setError("Please enter a valid IP address");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("token");
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api"}/ip-analysis/analyze`,
        { ip: ipAddress.trim() },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = response.data;

      if (data.success) {
        setAnalysis(data.data);
        // Add to search history
        setSearchHistory(prev => {
          const newHistory = [ipAddress.trim(), ...prev.filter(ip => ip !== ipAddress.trim())];
          return newHistory.slice(0, 5); // Keep last 5 searches
        });
      } else {
        throw new Error("Analysis failed");
      }
    } catch (error) {
      console.error("IP analysis error:", error);
      const apiError = handleAPIError(error);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      analyzeIP();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getRiskBadgeColor = (riskLevel: string, riskColor: string) => {
    switch (riskColor) {
      case "red":
        return "bg-red-100 text-red-800 border-red-200";
      case "orange":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "yellow":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "green":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  const exportAnalysis = () => {
    if (!analysis) return;

    const exportData = {
      ...analysis,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ip-analysis-${analysis.ip}-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push("/auth/login");
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              IP Address Analysis Tool
            </h1>
            <p className="text-muted-foreground">
              Analyze IP addresses for threat intelligence and geolocation data
            </p>
          </div>
          {analysis && (
            <Button variant="outline" onClick={exportAnalysis}>
              <Download className="mr-2 h-4 w-4" />
              Export Analysis
            </Button>
          )}
        </div>

        {/* Search Interface */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              IP Address Lookup
            </CardTitle>
            <CardDescription>
              Enter an IP address to get comprehensive threat intelligence and geolocation analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-4">
              <div className="flex space-x-2">
                <Input
                  type="text"
                  placeholder="Enter IP address (e.g., 8.8.8.8)"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                />
                <Button onClick={analyzeIP} disabled={loading}>
                  {loading ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Analyze
                </Button>
              </div>
              
              {/* Recent Searches */}
              {searchHistory.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Recent:</span>
                  {searchHistory.map((ip) => (
                    <Button
                      key={ip}
                      variant="outline"
                      size="sm"
                      onClick={() => setIpAddress(ip)}
                      className="h-6 px-2 text-xs"
                    >
                      {ip}
                    </Button>
                  ))}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
                  <p>{error}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-6">
            {/* Risk Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Badge className={getRiskBadgeColor(analysis.security.riskLevel, analysis.security.riskColor)}>
                        {analysis.security.riskLevel} Risk
                      </Badge>
                    </div>
                    <div className="text-3xl font-bold mb-1">
                      {analysis.security.riskScore}/100
                    </div>
                    <div className="text-sm text-muted-foreground">Risk Score</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600 mb-1">
                      {analysis.security.abuseConfidence}%
                    </div>
                    <div className="text-sm text-muted-foreground">Abuse Confidence</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600 mb-1">
                      {analysis.security.totalReports}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Reports</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 mb-1">
                      {formatDate(analysis.security.lastReported)}
                    </div>
                    <div className="text-sm text-muted-foreground">Last Reported</div>
                  </div>
                </div>

                {/* Risk Reasons */}
                {analysis.security.riskReasons.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium mb-3">Risk Factors:</h4>
                    <div className="space-y-2">
                      {analysis.security.riskReasons.map((reason, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          <span className="text-sm">{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Security Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">VPN</p>
                      <p className="text-2xl font-bold">
                        {analysis.security.isVPN ? "Yes" : "No"}
                      </p>
                    </div>
                    <div className={`p-2 rounded-lg ${analysis.security.isVPN ? 'bg-orange-100' : 'bg-green-100'}`}>
                      {analysis.security.isVPN ? (
                        <AlertTriangle className="h-6 w-6 text-orange-600" />
                      ) : (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Tor</p>
                      <p className="text-2xl font-bold">
                        {analysis.security.isTor ? "Yes" : "No"}
                      </p>
                    </div>
                    <div className={`p-2 rounded-lg ${analysis.security.isTor ? 'bg-red-100' : 'bg-green-100'}`}>
                      {analysis.security.isTor ? (
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                      ) : (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Proxy</p>
                      <p className="text-2xl font-bold">
                        {analysis.security.isProxy ? "Yes" : "No"}
                      </p>
                    </div>
                    <div className={`p-2 rounded-lg ${analysis.security.isProxy ? 'bg-orange-100' : 'bg-green-100'}`}>
                      {analysis.security.isProxy ? (
                        <AlertTriangle className="h-6 w-6 text-orange-600" />
                      ) : (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Whitelisted</p>
                      <p className="text-2xl font-bold">
                        {analysis.security.isWhitelisted ? "Yes" : "No"}
                      </p>
                    </div>
                    <div className={`p-2 rounded-lg ${analysis.security.isWhitelisted ? 'bg-green-100' : 'bg-gray-100'}`}>
                      {analysis.security.isWhitelisted ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <Eye className="h-6 w-6 text-gray-600" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Location & Network Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Geolocation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Geolocation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Country</label>
                      <p className="font-medium">{analysis.geolocation.country}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Region</label>
                      <p className="font-medium">{analysis.geolocation.region}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">City</label>
                      <p className="font-medium">{analysis.geolocation.city}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Timezone</label>
                      <p className="font-medium">{analysis.geolocation.timezone}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Coordinates</label>
                    <p className="font-mono text-sm">
                      {analysis.geolocation.coordinates.lat}, {analysis.geolocation.coordinates.lng}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-6 w-6 p-0"
                        onClick={() => copyToClipboard(`${analysis.geolocation.coordinates.lat}, ${analysis.geolocation.coordinates.lng}`)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Network Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Network Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">ISP</label>
                    <p className="font-medium">{analysis.network.isp}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Organization</label>
                    <p className="font-medium">{analysis.network.organization}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">ASN</label>
                      <p className="font-mono text-sm">{analysis.network.asn || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Connection Type</label>
                      <p className="font-medium">{analysis.network.connectionType}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Usage Type</label>
                    <p className="font-medium">{analysis.network.usageType}</p>
                  </div>
                  {analysis.network.domain && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Domain</label>
                      <p className="font-medium">{analysis.network.domain}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Attack Categories Breakdown */}
            {analysis.threatIntelligence.categoryBreakdown && Object.keys(analysis.threatIntelligence.categoryBreakdown).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Attack Categories
                  </CardTitle>
                  <CardDescription>
                    Types of attacks reported for this IP
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(analysis.threatIntelligence.categoryBreakdown)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 8)
                      .map(([category, count]) => (
                        <div key={category} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                          <span className="text-sm font-medium">{category}</span>
                          <Badge variant="destructive">{count} reports</Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reporter Countries & Recent Reports */}
            {(analysis.threatIntelligence.reporterCountries.length > 0 || analysis.threatIntelligence.recentReports.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Reporter Countries */}
                {analysis.threatIntelligence.reporterCountries.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        Reporter Countries
                      </CardTitle>
                      <CardDescription>
                        Geographic distribution of abuse reporters
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analysis.threatIntelligence.reporterCountries.slice(0, 6).map((country, index) => (
                          <div key={country.code} className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-mono bg-muted px-1 rounded">{country.code}</span>
                              <span className="text-sm font-medium">{country.name}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">{country.count} reports</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Reports */}
                {analysis.threatIntelligence.recentReports.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Recent Reports
                      </CardTitle>
                      <CardDescription>
                        Latest abuse incidents
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {analysis.threatIntelligence.recentReports.slice(0, 5).map((report, index) => (
                          <div key={index} className="border-l-2 border-destructive pl-4 py-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted-foreground">
                                {new Date(report.reportedAt).toLocaleDateString()}
                              </span>
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {report.reporterCountryName}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {report.comment?.substring(0, 120)}...
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Analyst Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Analyst Recommendations
                </CardTitle>
                <CardDescription>
                  Actionable guidance for security analysts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysis.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{recommendation}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Data Sources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Analysis Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Analyzed IP</label>
                    <p className="font-mono font-medium">{analysis.ip}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Analysis Time</label>
                    <p className="text-sm">{new Date(analysis.timestamp).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Data Sources</label>
                    <p className="text-sm">
                      {analysis.dataSource.geolocation} + {analysis.dataSource.threatIntel}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}