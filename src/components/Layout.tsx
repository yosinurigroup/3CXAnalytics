import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Menu } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Top Header */}
          <header className="h-14 border-b border-sidebar-border bg-background flex items-center px-4 gap-4">
            <SidebarTrigger className="p-2 hover:bg-sidebar-accent rounded-md transition-colors">
              <Menu className="w-4 h-4" />
            </SidebarTrigger>
            
            <div className="flex-1 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Enterprise BigQuery Analytics Platform
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                System Online
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6 bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}