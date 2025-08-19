import { BarChart3, Phone, PhoneIncoming, PhoneOutgoing, MapPin, Users, User, LogOut, Trash2, RefreshCw, Info } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Logo } from "@/components/Logo";
import { getCurrentVersion, clearAllCache, getCacheInfo } from "@/utils/version";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRecordCounts } from "@/hooks/useRecordCounts";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const mainNavItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: BarChart3,
    color: "text-blue-500",
  },
  {
    title: "Call Logs",
    url: "/call-logs",
    icon: Phone,
    color: "text-gray-500",
  },
  {
    title: "Incoming",
    url: "/call-logs/incoming",
    icon: PhoneIncoming,
    color: "text-green-500",
  },
  {
    title: "Outgoing",
    url: "/call-logs/outgoing",
    icon: PhoneOutgoing,
    color: "text-orange-500",
  },
  {
    title: "Area Codes",
    url: "/area-codes",
    icon: MapPin,
    color: "text-purple-500",
  },
  {
    title: "Users",
    url: "/users",
    icon: Users,
    color: "text-teal-500",
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const [version, setVersion] = useState(getCurrentVersion());
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const { counts, loading: countsLoading, error: countsError } = useRecordCounts(30000); // Refresh every 30 seconds

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    // Fix: Only exact match for call-logs, not when on sub-pages
    if (path === "/call-logs") {
      return currentPath === "/call-logs";
    }
    return currentPath.startsWith(path);
  };

  const getNavClasses = (isActive: boolean) =>
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "hover:bg-sidebar-accent/50 text-sidebar-foreground";

  const handleLogout = () => {
    logout();
  };

  // Filter navigation items based on user role
  const getFilteredNavItems = () => {
    return mainNavItems.filter(item => {
      // Only show Users page to Admin users
      if (item.url === '/users') {
        return user?.Role === 'Admin';
      }
      return true;
    });
  };

  const getRecordCount = (url: string): number => {
    if (countsLoading || countsError) return 0;
    
    switch (url) {
      case '/call-logs':
        return counts.callLogs;
      case '/call-logs/incoming':
        return counts.incoming;
      case '/call-logs/outgoing':
        return counts.outgoing;
      case '/area-codes':
        return counts.areaCodes;
      case '/users':
        return counts.users;
      default:
        return 0;
    }
  };

  const formatCount = (count: number): string => {
    if (count === 0) return '0';
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  };

  const renderCountBadge = (url: string) => {
    if (collapsed || url === '/') return null;
    
    if (countsLoading) {
      return (
        <div className="bg-sidebar-accent/50 px-2 py-0.5 rounded-full ml-2">
          <div className="w-4 h-3 bg-sidebar-accent animate-pulse rounded"></div>
        </div>
      );
    }
    
    if (countsError) {
      return (
        <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-xs font-medium ml-2" title={`Error loading count: ${countsError}`}>
          !
        </span>
      );
    }
    
    const recordCount = getRecordCount(url);
    if (recordCount > 0) {
      return (
        <span className="bg-sidebar-accent text-sidebar-accent-foreground px-2 py-0.5 rounded-full text-xs font-medium ml-2">
          {formatCount(recordCount)}
        </span>
      );
    }
    
    return null;
  };

  const handleClearCache = async () => {
    if (isClearing) return;
    
    setIsClearing(true);
    try {
      const cacheInfo = getCacheInfo();
      await clearAllCache();
      
      toast({
        title: "Cache Cleared Successfully",
        description: `Cleared ${cacheInfo.keys.length} cache entries (${(cacheInfo.totalSize / 1024).toFixed(2)} KB)`,
      });
      
      // Simulate version increment to show real-time update
      const newVersion = version + 1;
      setVersion(newVersion);
      
      // Force page refresh to show cache clearing effect
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: "Cache Clear Failed",
        description: "Some cache entries could not be cleared",
        variant: "destructive"
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Update version display every 5 seconds to show real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      const currentVer = getCurrentVersion();
      if (currentVer !== version) {
        setVersion(currentVer);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [version]);

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        {/* Logo Section */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-center">
            <Logo
              size={collapsed ? "sm" : "md"}
              variant={collapsed ? "icon" : "full"}
              className="transition-all duration-300"
            />
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup className="flex-1">
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs font-medium px-3 py-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {getFilteredNavItems().map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={getNavClasses(isActive(item.url))}
                    >
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                      {!collapsed && (
                        <div className="flex items-center justify-between w-full">
                          <span>{item.title}</span>
                          {renderCountBadge(item.url)}
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Version & Cache Management Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs font-medium px-3 py-2">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Version Display */}
              <SidebarMenuItem>
                <div className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 text-sidebar-foreground/70">
                    <Info className="w-4 h-4 text-cyan-500" />
                    {!collapsed && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs">Version</span>
                        <span className="bg-sidebar-accent text-sidebar-accent-foreground px-2 py-1 rounded text-xs font-mono font-medium">
                          v{version}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </SidebarMenuItem>
              
              {/* Clear Cache Button */}
              <SidebarMenuItem>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCache}
                  disabled={isClearing}
                  className="w-full justify-start gap-3 h-9 px-3 text-sidebar-foreground hover:bg-sidebar-accent/50"
                >
                  {isClearing ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-yellow-500" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-red-500" />
                  )}
                  {!collapsed && (
                    <span>{isClearing ? "Clearing..." : "Clear Cache"}</span>
                  )}
                </Button>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Account Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs font-medium px-3 py-2">
            Account
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/account"
                    className={getNavClasses(isActive("/account"))}
                  >
                    <User className="w-4 h-4 text-indigo-500" />
                    {!collapsed && <span>Account</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full justify-start gap-3 h-9 px-3 text-sidebar-foreground hover:bg-sidebar-accent/50"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  {!collapsed && <span>Logout</span>}
                </Button>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}