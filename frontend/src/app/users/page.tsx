'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { handleAPIError } from '@/services/api';
import { 
  Users,
  Plus,
  Edit3,
  Trash2,
  Shield,
  Mail,
  Phone,
  Calendar,
  UserCheck,
  UserX,
  Crown,
  Star
} from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import axios from 'axios';

interface User {
  _id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'senior_analyst' | 'analyst' | 'viewer';
  department?: string;
  phoneNumber?: string;
  isActive: boolean;
  lastLogin?: string;
  performance: {
    totalCasesAssigned: number;
    totalCasesResolved: number;
    avgResolutionTime: number;
    currentCaseLoad: number;
    overdueCases: number;
    rating: number;
  };
  createdAt: string;
}

export default function UsersPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (user) {
      // Check if user has admin access
      if (user.role !== 'admin' && user.role !== 'senior_analyst') {
        router.push('/');
        return;
      }
      loadUsers();
    }
  }, [user, isLoading, router]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api"}/users`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setUsers(response.data.data);
      } else {
        throw new Error(response.data.error?.message || 'Failed to load users');
      }

    } catch (error) {
      console.error('Users loading error:', error);
      const apiError = handleAPIError(error);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api"}/users/${userId}/status`,
        { isActive: !currentStatus },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        await loadUsers(); // Reload users
      } else {
        throw new Error(response.data.error?.message || 'Failed to update user status');
      }
    } catch (error) {
      console.error('User status update error:', error);
      const apiError = handleAPIError(error);
      setError(apiError.message);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api"}/users/${userId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        await loadUsers(); // Reload users
      } else {
        throw new Error(response.data.error?.message || 'Failed to delete user');
      }
    } catch (error) {
      console.error('User deletion error:', error);
      const apiError = handleAPIError(error);
      setError(apiError.message);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'senior_analyst':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'analyst':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-3 w-3 mr-1" />;
      case 'senior_analyst':
        return <Star className="h-3 w-3 mr-1" />;
      case 'analyst':
        return <Shield className="h-3 w-3 mr-1" />;
      default:
        return null;
    }
  };

  const getWorkloadColor = (caseLoad: number) => {
    if (caseLoad === 0) return 'text-green-600';
    if (caseLoad <= 5) return 'text-blue-600';
    if (caseLoad <= 10) return 'text-yellow-600';
    if (caseLoad <= 15) return 'text-orange-600';
    return 'text-red-600';
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.username.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesStatus = !statusFilter || 
                         (statusFilter === 'active' && user.isActive) ||
                         (statusFilter === 'inactive' && !user.isActive);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'senior_analyst')) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
              <p className="text-muted-foreground">
                Manage system users, roles, and permissions
              </p>
            </div>
          </div>
          
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add User
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{users.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                  <p className="text-2xl font-bold text-green-600">
                    {users.filter(u => u.isActive).length}
                  </p>
                </div>
                <UserCheck className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Analysts</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {users.filter(u => u.role === 'analyst' && u.isActive).length}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Case Load</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {users.length > 0 ? 
                      Math.round(users.reduce((sum, u) => sum + u.performance.currentCaseLoad, 0) / users.length) : 
                      0
                    }
                  </p>
                </div>
                <Star className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filter Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <Select value={roleFilter || undefined} onValueChange={(value) => setRoleFilter(value || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="senior_analyst">Senior Analyst</SelectItem>
                  <SelectItem value="analyst">Analyst</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter || undefined} onValueChange={(value) => setStatusFilter(value || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>System Users</CardTitle>
            <CardDescription>
              Manage user accounts, roles, and access permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Case Load</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <p className="font-medium">{user.firstName} {user.lastName}</p>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span>{user.email}</span>
                        </div>
                        {user.phoneNumber && (
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{user.phoneNumber}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {getRoleIcon(user.role)}
                        {user.role.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 border-red-200">
                          <UserX className="h-3 w-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={getWorkloadColor(user.performance.currentCaseLoad)}>
                        {user.performance.currentCaseLoad} cases
                      </span>
                      {user.performance.overdueCases > 0 && (
                        <p className="text-xs text-red-600">
                          {user.performance.overdueCases} overdue
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm">
                          {user.performance.totalCasesResolved} resolved
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Avg: {user.performance.avgResolutionTime.toFixed(1)}h
                        </p>
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < user.performance.rating 
                                  ? 'text-yellow-400 fill-current' 
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {user.lastLogin ? 
                            new Date(user.lastLogin).toLocaleDateString() : 
                            'Never'
                          }
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button variant="outline" size="sm">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleUserStatus(user._id, user.isActive)}
                        >
                          {user.isActive ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </Button>

                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete ${user.firstName} ${user.lastName}? This action cannot be undone.`)) {
                              deleteUser(user._id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium">No users found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {users.length === 0 ? 'No users in the system.' : 'No users match your current filters.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}