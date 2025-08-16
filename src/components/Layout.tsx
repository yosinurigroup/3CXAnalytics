import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Menu } from "lucide-react";
import { useLocation } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Dashboard';
      case '/call-logs':
        return 'All Call Logs';
      case '/call-logs/incoming':
        return 'Incoming Call Logs';
      case '/call-logs/outgoing':
        return 'Outgoing Call Logs';
      case '/account':
        return 'Account Settings';
      default:
        return 'Dashboard';
    }
  };

  const getPageDescription = () => {
    switch (location.pathname) {
      case '/':
        return 'Real-time analytics and insights dashboard';
      case '/call-logs':
        return 'Complete call history and analytics';
      case '/call-logs/incoming':
        return 'Real-time incoming call analytics and transcriptions';
      case '/call-logs/outgoing':
        return 'Outbound call tracking and performance metrics';
      case '/account':
        return 'Manage your account settings and preferences';
      default:
        return 'Real-time analytics and insights dashboard';
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full bg-background overflow-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col h-full">
          {/* Top Header */}
          <header className="h-14 border-b border-sidebar-border bg-background flex items-center px-4 gap-4 flex-shrink-0">
            <SidebarTrigger className="p-2 hover:bg-sidebar-accent rounded-md transition-colors">
              <Menu className="w-4 h-4" />
            </SidebarTrigger>
            
            <div className="flex-1 flex items-center justify-between">
              <div className="flex flex-col">
                <h1 className="text-lg font-semibold text-foreground">{getPageTitle()}</h1>
                <p className="text-xs text-muted-foreground">{getPageDescription()}</p>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                System Online
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}