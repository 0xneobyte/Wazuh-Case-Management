'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { 
  HomeIcon,
  FolderOpenIcon,
  UsersIcon,
  ChartBarIcon,
  CogIcon,
  BellIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ComputerDesktopIcon,
  MapIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  current?: boolean;
  badge?: number;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const navigation: NavigationItem[] = [
    { 
      name: 'Dashboard', 
      href: '/', 
      icon: HomeIcon,
      current: pathname === '/'
    },
    { 
      name: 'Cases', 
      href: '/cases', 
      icon: FolderOpenIcon,
      current: pathname.startsWith('/cases')
    },
    { 
      name: 'AI Assistant', 
      href: '/ai-assistant', 
      icon: SparklesIcon,
      current: pathname.startsWith('/ai-assistant')
    },
    { 
      name: 'Geo Tracker', 
      href: '/geo-tracker', 
      icon: MapIcon,
      current: pathname.startsWith('/geo-tracker')
    },
    { 
      name: 'Analytics', 
      href: '/analytics', 
      icon: ChartBarIcon,
      current: pathname.startsWith('/analytics')
    },
  ];

  // Add admin-only navigation items
  if (user?.role === 'admin' || user?.role === 'senior_analyst') {
    navigation.push(
      { 
        name: 'Users', 
        href: '/users', 
        icon: UsersIcon,
        current: pathname.startsWith('/users')
      },
      { 
        name: 'System', 
        href: '/system', 
        icon: ComputerDesktopIcon,
        current: pathname.startsWith('/system')
      }
    );
  }

  navigation.push({
    name: 'Settings',
    href: '/settings',
    icon: CogIcon,
    current: pathname.startsWith('/settings')
  });

  const handleLogout = async () => {
    try {
      logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Mobile sidebar */}
        <div className={`relative z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
          <div className="fixed inset-0 z-40 flex">
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
            
            <div className="relative flex-1 flex flex-col max-w-xs w-full pt-5 pb-4 bg-white">
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  type="button"
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  <XMarkIcon className="h-6 w-6 text-white" />
                </button>
              </div>
              
              <div className="flex-shrink-0 flex items-center px-4">
                <h1 className="text-lg font-bold text-gray-900">SENTRYA</h1>
              </div>
              
              <div className="mt-5 flex-1 h-0 overflow-y-auto">
                <nav className="px-2 space-y-1">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                        item.current
                          ? 'bg-blue-100 text-blue-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <item.icon className={`mr-4 h-6 w-6 ${item.current ? 'text-blue-500' : 'text-gray-400'}`} />
                      {item.name}
                      {item.badge && (
                        <span className="ml-auto bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
          <div className="flex flex-col flex-grow border-r border-gray-200 pt-5 bg-white overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <h1 className="text-xl font-bold text-gray-900">SENTRYA</h1>
            </div>
            
            <div className="mt-5 flex-grow flex flex-col">
              <nav className="flex-1 px-2 pb-4 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                      item.current
                        ? 'bg-blue-100 text-blue-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className={`mr-3 h-6 w-6 ${item.current ? 'text-blue-500' : 'text-gray-400'}`} />
                    {item.name}
                    {item.badge && (
                      <span className="ml-auto bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="md:pl-64 flex flex-col flex-1">
          {/* Top navigation */}
          <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow">
            <button
              type="button"
              className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            
            <div className="flex-1 px-4 flex justify-between">
              <div className="flex-1 flex">
                {/* Search can be added here */}
              </div>
              
              <div className="ml-4 flex items-center md:ml-6">
                {/* Notifications */}
                <button
                  type="button"
                  className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <BellIcon className="h-6 w-6" />
                </button>

                {/* Profile dropdown */}
                <div className="ml-3 relative">
                  <div className="flex items-center space-x-3">
                    <div className="flex flex-col text-right">
                      <span className="text-sm font-medium text-gray-700">
                        {user?.firstName} {user?.lastName}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">
                        {user?.role?.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <button
                      type="button"
                      className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <UserCircleIcon className="h-8 w-8 text-gray-400" />
                    </button>
                    
                    <button
                      onClick={handleLogout}
                      className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <ArrowRightOnRectangleIcon className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}