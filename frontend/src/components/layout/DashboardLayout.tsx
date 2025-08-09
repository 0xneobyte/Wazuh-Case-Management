"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import {
  Home,
  FolderOpen,
  Users,
  BarChart3,
  Settings,
  Bell,
  User,
  LogOut,
  Menu,
  X,
  Monitor,
  MapPin,
  Sparkles,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
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
      name: "Dashboard",
      href: "/",
      icon: Home,
      current: pathname === "/",
    },
    {
      name: "Cases",
      href: "/cases",
      icon: FolderOpen,
      current: pathname.startsWith("/cases"),
    },
    {
      name: "AI Assistant",
      href: "/ai-assistant",
      icon: Sparkles,
      current: pathname.startsWith("/ai-assistant"),
    },
    {
      name: "IP Analysis",
      href: "/geo",
      icon: MapPin,
      current: pathname.startsWith("/geo"),
    },
    {
      name: "Analytics",
      href: "/analytics",
      icon: BarChart3,
      current: pathname.startsWith("/analytics"),
    },
  ];

  // Add admin-only navigation items
  if (user?.role === "admin" || user?.role === "senior_analyst") {
    navigation.push(
      {
        name: "SIEM Integration",
        href: "/wazuh",
        icon: Monitor,
        current: pathname.startsWith("/wazuh") || pathname.startsWith("/siem"),
      },
      {
        name: "Users",
        href: "/users",
        icon: Users,
        current: pathname.startsWith("/users"),
      }
    );
  }

  navigation.push({
    name: "Settings",
    href: "/settings",
    icon: Settings,
    current: pathname.startsWith("/settings"),
  });

  const handleLogout = async () => {
    try {
      logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Mobile sidebar */}
        <div
          className={`relative z-50 md:hidden ${sidebarOpen ? "" : "hidden"}`}
        >
          <div className="fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />

            <div className="relative flex-1 flex flex-col max-w-xs w-full pt-5 pb-4 bg-card border-r">
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>

              <div className="flex-shrink-0 flex items-center px-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h1 className="text-lg font-bold">SENTRYA</h1>
                </div>
              </div>

              <div className="mt-5 flex-1 h-0 overflow-y-auto">
                <nav className="px-2 space-y-1">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        item.current
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "mr-3 h-5 w-5",
                          item.current
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      />
                      {item.name}
                      {item.badge && (
                        <Badge variant="destructive" className="ml-auto">
                          {item.badge}
                        </Badge>
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
          <div className="flex flex-col flex-grow border-r bg-card pt-5 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-xl font-bold">SENTRYA</h1>
              </div>
            </div>

            <div className="mt-5 flex-grow flex flex-col">
              <nav className="flex-1 px-2 pb-4 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      item.current
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "mr-3 h-5 w-5",
                        item.current ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    {item.name}
                    {item.badge && (
                      <Badge variant="destructive" className="ml-auto">
                        {item.badge}
                      </Badge>
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
          <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-card border-b">
            <Button
              variant="ghost"
              size="icon"
              className="px-4 border-r md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>

            <div className="flex-1 px-4 flex justify-between">
              <div className="flex-1 flex">
                {/* Search can be added here */}
              </div>

              <div className="ml-4 flex items-center md:ml-6 space-x-4">
                {/* Notifications */}
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs"
                  >
                    3
                  </Badge>
                </Button>

                <Separator orientation="vertical" className="h-6" />

                {/* Profile dropdown */}
                <div className="flex items-center space-x-3">
                  <div className="flex flex-col text-right">
                    <span className="text-sm font-medium">
                      {user?.firstName} {user?.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {user?.role?.replace("_", " ")}
                    </span>
                  </div>

                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1 bg-background">{children}</main>
        </div>
      </div>
    </>
  );
}
