import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Menu, Database, Search, Download, X, Filter, Upload, Trash2, Plus, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { FilterPopup } from "./FilterPopup";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface LayoutProps {
  children: React.ReactNode;
}

// Route configuration for dynamic headers
const routeConfig: Record<string, { title: string; showSearch?: boolean; showFilters?: boolean; showExport?: boolean; showImport?: boolean; showClearData?: boolean; showAdd?: boolean }> = {
  "/": { title: "Dashboard", showSearch: false, showFilters: false, showExport: false, showImport: false, showClearData: false },
  "/call-logs": { title: "All Call Logs", showSearch: true, showFilters: true, showExport: true, showImport: false, showClearData: false },
  "/call-logs/incoming": { title: "Incoming Call Logs", showSearch: true, showFilters: true, showExport: true, showImport: true, showClearData: true },
  "/call-logs/outgoing": { title: "Outgoing Calls", showSearch: true, showFilters: true, showExport: true, showImport: true, showClearData: true },
  "/area-codes": { title: "Area Codes", showSearch: true, showFilters: false, showExport: true, showImport: true, showClearData: true },
  "/users": { title: "Users", showSearch: true, showFilters: false, showExport: true, showImport: false, showClearData: false, showAdd: true },
  "/account": { title: "Account Settings", showSearch: false, showFilters: false, showExport: false, showImport: false, showClearData: false },
};

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [globalSearch, setGlobalSearch] = useState("");
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [activeFilters, setActiveFilters] = useState<any>(null);
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);
  const { toast } = useToast();
  const { logout, user } = useAuth();
  
  // Get current route config
  const currentRoute = routeConfig[location.pathname] || { title: "Page", showSearch: false, showFilters: false, showExport: false };

  // Reset search and filters when route changes
  useEffect(() => {
    console.log('[LAYOUT] Route changed to:', location.pathname);
    console.log('[LAYOUT] Resetting search and filters for new route');
    
    // Clear search
    setGlobalSearch("");
    
    // Clear filters
    setActiveFilters(null);
    
    // Close filter popup if open
    setShowFilterPopup(false);
    
    // Trigger FilterPopup reset
    setResetTrigger(prev => prev + 1);
    
    // Dispatch events to notify pages of the reset
    window.dispatchEvent(new CustomEvent('global-search', { detail: "" }));
    window.dispatchEvent(new CustomEvent('apply-filters', { detail: null }));
  }, [location.pathname]);

  const handleExport = () => {
    // This will be handled by the individual pages if needed
    // Or we can emit a custom event that pages can listen to
    console.log('Export button clicked in Layout - dispatching export-data event');
    window.dispatchEvent(new CustomEvent('export-data'));
  };

  const handleImport = () => {
    // Emit import event that pages can listen to
    console.log('Import button clicked in Layout - dispatching event');
    window.dispatchEvent(new CustomEvent('import-data'));
  };

  const handleAdd = () => {
    // Emit add event that pages can listen to
    console.log('Add button clicked in Layout - dispatching add-user event');
    window.dispatchEvent(new CustomEvent('add-user'));
  };

  const handleLogout = () => {
    logout();
  };

  const handleSearch = (value: string) => {
    setGlobalSearch(value);
    // Dispatch search event that pages can listen to
    window.dispatchEvent(new CustomEvent('global-search', { detail: value }));
  };

  const handleApplyFilters = (filters: any) => {
    setActiveFilters(filters);
    // Dispatch filter event that pages can listen to
    window.dispatchEvent(new CustomEvent('apply-filters', { detail: filters }));
  };

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      // Determine the correct API endpoint based on current route
      let apiEndpoint: string;
      let dataType: string;
      
      if (location.pathname === '/call-logs/outgoing') {
        apiEndpoint = 'http://localhost:3001/api/outgoing-calls/clear-all';
        dataType = 'outgoing call';
      } else if (location.pathname === '/area-codes') {
        apiEndpoint = 'http://localhost:3001/api/area-codes/clear-all';
        dataType = 'area code';
      } else {
        apiEndpoint = 'http://localhost:3001/api/inbound-calls/clear-all';
        dataType = 'incoming call';
      }
      
      console.log(`Clearing data for ${location.pathname} using endpoint: ${apiEndpoint}`);
      
      const response = await fetch(apiEndpoint, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({ confirm: 'DELETE_ALL_DATA' }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Data Cleared Successfully",
          description: data.message || `All ${dataType} data has been cleared`,
        });
        
        // Dispatch event to refresh data
        window.dispatchEvent(new CustomEvent('data-cleared'));
        
        // Force page reload to ensure fresh data
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } else {
        toast({
          title: "Failed to Clear Data",
          description: data.error || "An error occurred while clearing data",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error clearing data:', error);
      toast({
        title: "Error",
        description: "Failed to connect to the server",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
      setShowClearDataDialog(false);
    }
  };

  // Count active filters
  const getActiveFilterCount = () => {
    if (!activeFilters) return 0;
    let count = 0;
    if (activeFilters.dateFrom || activeFilters.dateTo || activeFilters.preset) count++;
    if (activeFilters.columns) {
      count += Object.values(activeFilters.columns).filter((v: any) => v).length;
    }
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full bg-background overflow-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Top Header - Full width of remaining space after sidebar */}
          <header className="sticky top-0 z-30 h-14 border-b border-sidebar-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="h-full flex items-center px-4">
              {/* Sidebar Toggle + Title */}
              <div className="flex items-center gap-3 min-w-0">
                <SidebarTrigger className="p-2 hover:bg-sidebar-accent rounded-md transition-colors flex-shrink-0">
                  <Menu className="w-4 h-4" />
                </SidebarTrigger>
                <div className="text-lg font-semibold text-foreground truncate">
                  {currentRoute.title}
                </div>
              </div>
              
              {/* Search Bar - Flexible center section */}
              {currentRoute.showSearch && (
                <div className="flex-1 max-w-xl mx-4">
                  <div className="relative w-full">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={globalSearch}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-8 h-9 text-sm w-full"
                    />
                    {globalSearch && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => handleSearch("")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Spacer when no search */}
              {!currentRoute.showSearch && <div className="flex-1" />}
              
              {/* Action Buttons - Right section */}
              <div className="flex items-center gap-2 ml-auto">
                {/* Filter Button */}
                {currentRoute.showFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilterPopup(true)}
                    className="h-9 px-3 relative"
                  >
                    <Filter className="h-4 w-4" />
                    <span className="ml-2 hidden sm:inline">Filter</span>
                    {activeFilterCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
                      >
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                )}
                
                {/* Import Button */}
                {currentRoute.showImport && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleImport}
                    className="h-9 px-3"
                    title="Import CSV"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="ml-2 hidden sm:inline">Import</span>
                  </Button>
                )}
                
                {/* Add Button */}
                {currentRoute.showAdd && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAdd}
                    className="h-9 px-3"
                    title="Add User"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="ml-2 hidden sm:inline">Add</span>
                  </Button>
                )}
                
                {/* Export Button */}
                {currentRoute.showExport && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExport}
                    className="h-9 px-3"
                    title="Export"
                  >
                    <Download className="h-4 w-4" />
                    <span className="ml-2 hidden sm:inline">Export</span>
                  </Button>
                )}
                
                {/* Clear Data Button - Only for incoming calls */}
                {currentRoute.showClearData && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowClearDataDialog(true)}
                    className="h-9 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Clear All Data"
                    disabled={isClearing}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="ml-2 hidden sm:inline">Clear Data</span>
                  </Button>
                )}
                
              </div>
            </div>
          </header>

          {/* Main Content Area - Scrollable */}
          <main className="flex-1 overflow-hidden bg-background">
            <div className="h-full overflow-auto">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Filter Popup */}
      <FilterPopup
        open={showFilterPopup}
        onOpenChange={setShowFilterPopup}
        onApplyFilters={handleApplyFilters}
        resetTrigger={resetTrigger}
      />

      {/* Clear Data Confirmation Dialog */}
      <AlertDialog open={showClearDataDialog} onOpenChange={setShowClearDataDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This action cannot be undone. This will permanently delete ALL records from the MongoDB collection.
              </span>
              <span className="block text-destructive font-semibold">
                ⚠️ Warning: All {
                  location.pathname === '/call-logs/outgoing' ? 'outgoing call' :
                  location.pathname === '/area-codes' ? 'area code' :
                  'incoming call'
                } data will be permanently removed!
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearData}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? "Clearing..." : "Delete All Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}