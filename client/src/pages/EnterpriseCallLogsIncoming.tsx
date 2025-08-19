import { EnterpriseDataTable, Column } from "@/components/EnterpriseDataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState, useCallback } from "react";
import enterpriseApiService, { InboundCall, PerformanceMetrics, TableStatistics } from "@/services/enterpriseApiService";
import { Loader2, Database, TrendingUp, Zap, Clock, Users, Activity, AlertTriangle } from "lucide-react";
import { CSVImportModal } from "@/components/CSVImportModal";
import { useToast } from "@/hooks/use-toast";
import { transformMongoDBToDisplay, transformDisplayToMongoDB, getDisplayFieldNames } from "@/utils/fieldMapping";

// Map API response to component interface
interface IncomingCallRecord {
  CallTime: string;
  CallerID: string;
  Destination: string;
  Trunk: string;
  TrunkNumber: string;
  DID: string;
  Status: string;
  Ringing: string;
  Talking: string;
  TotalDuration: string;
  CallType: string;
  Sentiment: string;
  Summary: string;
  Transcription: string;
}

const statusColors: Record<string, string> = {
  Completed: "bg-success/10 text-success border-success/20",
  Answered: "bg-success/10 text-success border-success/20",
  Missed: "bg-destructive/10 text-destructive border-destructive/20",
  Busy: "bg-warning/10 text-warning border-warning/20",
  Failed: "bg-destructive/10 text-destructive border-destructive/20",
  Abandoned: "bg-muted text-muted-foreground border-border",
  Voicemail: "bg-primary/10 text-primary border-primary/20",
};

const sentimentColors: Record<string, string> = {
  Positive: "bg-success/10 text-success border-success/20",
  Neutral: "bg-muted text-muted-foreground border-border",
  Negative: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function EnterpriseCallLogsIncoming() {
  const [data, setData] = useState<IncomingCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<any>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [tableStatistics, setTableStatistics] = useState<TableStatistics | null>(null);
  const [sortBy, setSortBy] = useState('CallTime');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const { toast } = useToast();

  // Fetch data from MongoDB API with enterprise features
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    console.log('[ENTERPRISE-PAGE] Fetching real-time data...');
    
    try {
      const params = {
        page: currentPage,
        pageSize: pageSize,
        search: searchTerm,
        sortBy: sortBy,
        sortOrder: sortOrder,
        enableCache: true,
        ...filters
      };

      const response = await enterpriseApiService.fetchInboundCalls(params);
      
      if (response.success && response.data) {
        setData(response.data);
        setTotalRecords(response.total || 0);
        setTotalPages(response.totalPages || 0);
        
        // Show performance info
        if (response.performance) {
          console.log('[ENTERPRISE-PAGE] Performance:', response.performance);
        }
      } else {
        setData([]);
        setTotalRecords(0);
        setTotalPages(0);
        if (response.error) {
          setError(response.error);
        }
      }
    } catch (err) {
      console.error('[ENTERPRISE-PAGE] Error fetching inbound calls:', err);
      setData([]);
      setTotalRecords(0);
      setTotalPages(0);
      setError(err instanceof Error ? err.message : 'Failed to load data from MongoDB');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, filters, sortBy, sortOrder]);

  // Fetch performance metrics
  const fetchPerformanceMetrics = useCallback(async () => {
    try {
      const metrics = await enterpriseApiService.getPerformanceMetrics();
      setPerformanceMetrics(metrics);
    } catch (error) {
      console.error('[ENTERPRISE-PAGE] Error fetching performance metrics:', error);
    }
  }, []);

  // Fetch table statistics
  const fetchTableStatistics = useCallback(async () => {
    try {
      const stats = await enterpriseApiService.getTableStatistics();
      setTableStatistics(stats);
    } catch (error) {
      console.error('[ENTERPRISE-PAGE] Error fetching table statistics:', error);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch metrics on component mount
  useEffect(() => {
    fetchPerformanceMetrics();
    fetchTableStatistics();
    
    // Refresh metrics every 30 seconds
    const metricsInterval = setInterval(() => {
      fetchPerformanceMetrics();
    }, 30000);

    // Refresh statistics every 5 minutes
    const statsInterval = setInterval(() => {
      fetchTableStatistics();
    }, 300000);

    return () => {
      clearInterval(metricsInterval);
      clearInterval(statsInterval);
    };
  }, [fetchPerformanceMetrics, fetchTableStatistics]);

  // Handle pagination changes
  const handlePageChange = useCallback((page: number, newPageSize: number) => {
    setCurrentPage(page);
    if (newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setCurrentPage(1); // Reset to first page when page size changes
    }
  }, [pageSize]);

  // Handle sorting changes
  const handleSortChange = useCallback((column: string, direction: 'asc' | 'desc' | null) => {
    if (direction) {
      setSortBy(column);
      setSortOrder(direction.toUpperCase() as 'ASC' | 'DESC');
    } else {
      setSortBy('CallTime');
      setSortOrder('DESC');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  }, []);

  // Handle global search
  const handleGlobalSearchChange = useCallback((search: string) => {
    setSearchTerm(search);
    setCurrentPage(1); // Reset to first page when search changes
  }, []);

  // Handle filters change
  const handleFiltersChange = useCallback((newFilters: Record<string, any>) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  }, []);

  // Handle export
  const handleExport = useCallback(async (format: 'csv' | 'excel' | 'json') => {
    try {
      const blob = await enterpriseApiService.exportData(format, {
        search: searchTerm,
        ...filters,
        sortBy,
        sortOrder
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incoming-calls-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Data exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export data",
        variant: "destructive"
      });
    }
  }, [searchTerm, filters, sortBy, sortOrder, toast]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchData();
    fetchPerformanceMetrics();
  }, [fetchData, fetchPerformanceMetrics]);

  // Handle import completion
  const handleImportComplete = useCallback((stats: any) => {
    toast({
      title: "Import Complete",
      description: `Created: ${stats.created}, Updated: ${stats.updated}, Failed: ${stats.failed}`,
    });
    fetchData();
    fetchTableStatistics();
    setShowImportModal(false);
  }, [fetchData, fetchTableStatistics, toast]);

  // Define columns for the enterprise table
  const columns: Column<IncomingCallRecord>[] = [
    {
      key: "CallTime",
      header: "Call Time",
      width: "150px",
      sortable: true,
      searchable: true,
      render: (value) => {
        const date = new Date(value);
        return (
          <span className="text-xs font-mono">
            {date.toLocaleString('en-US', { 
              timeZone: 'UTC',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
          </span>
        );
      },
    },
    {
      key: "CallerID",
      header: "Caller ID",
      width: "130px",
      searchable: true,
      render: (value) => (
        <span className="text-xs font-medium text-primary">{value || '-'}</span>
      ),
    },
    {
      key: "Destination",
      header: "Destination",
      width: "150px",
      searchable: true,
      render: (value) => (
        <span className="text-xs">{value || '-'}</span>
      ),
    },
    {
      key: "Trunk",
      header: "Trunk",
      width: "120px",
      searchable: true,
      filterable: true,
      render: (value) => (
        <span className="text-xs">{value || '-'}</span>
      ),
    },
    {
      key: "Status",
      header: "Status",
      width: "90px",
      sortable: true,
      searchable: true,
      filterable: true,
      render: (value) => (
        <Badge 
          variant="outline" 
          className={`text-[10px] px-1.5 py-0 h-5 ${statusColors[value] || ""}`}
        >
          {value || 'Unknown'}
        </Badge>
      ),
    },
    {
      key: "TotalDuration",
      header: "Duration",
      width: "95px",
      sortable: true,
      render: (value) => (
        <span className="text-xs font-mono font-medium">{value || '00:00'}</span>
      ),
    },
    {
      key: "CallType",
      header: "Type",
      width: "80px",
      filterable: true,
      render: (value) => (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
          {value || 'Inbound'}
        </Badge>
      ),
    },
    {
      key: "Sentiment",
      header: "Sentiment",
      width: "85px",
      searchable: true,
      filterable: true,
      render: (value) => {
        if (!value || value === "null") {
          return <span className="text-xs text-muted-foreground">-</span>;
        }
        return (
          <Badge 
            variant="outline" 
            className={`text-[10px] px-1.5 py-0 h-5 ${sentimentColors[value] || ""}`}
          >
            {value}
          </Badge>
        );
      },
    },
    {
      key: "Summary",
      header: "Summary",
      width: "200px",
      searchable: true,
      render: (value) => (
        <span className="text-xs text-muted-foreground truncate" title={value}>
          {value || '-'}
        </span>
      ),
    },
  ];

  // Performance metrics cards
  const renderPerformanceMetrics = () => {
    if (!performanceMetrics && !tableStatistics) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {tableStatistics && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tableStatistics.totalRows.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {tableStatistics.uniqueCallers.toLocaleString()} unique callers
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(tableStatistics.avgDuration)}s</div>
                <p className="text-xs text-muted-foreground">
                  Per call average
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {performanceMetrics && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cache Hit Ratio</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{performanceMetrics.cacheHitRatio}</div>
                <p className="text-xs text-muted-foreground">
                  {performanceMetrics.cacheHits} hits / {performanceMetrics.queryCount} queries
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Query Time</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{performanceMetrics.avgQueryTime}ms</div>
                <p className="text-xs text-muted-foreground">
                  {performanceMetrics.errorCount} errors
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  };

  // Custom actions for the toolbar
  const customActions = (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowImportModal(true)}
      >
        Import CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
      </Button>
    </>
  );

  // Loading state
  if (loading && data.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {renderPerformanceMetrics()}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-sm text-muted-foreground">Loading enterprise data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && data.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {renderPerformanceMetrics()}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2 text-destructive">Error Loading Data</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* Performance Metrics */}
      {renderPerformanceMetrics()}

      {/* Enterprise Data Table */}
      <div className="flex-1">
        <EnterpriseDataTable
          data={data}
          columns={columns}
          loading={loading}
          error={error}
          
          // Pagination
          pagination={{
            serverSide: true,
            currentPage,
            pageSize,
            totalRecords,
            totalPages,
            pageSizeOptions: [10, 25, 50, 100, 200, 500],
            showQuickJumper: true,
            showSizeChanger: true,
            showTotal: true,
            showPageInfo: true
          }}
          onPageChange={handlePageChange}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
            setCurrentPage(1);
          }}
          
          // Sorting
          sortable={true}
          defaultSort={{ column: sortBy, direction: sortOrder.toLowerCase() as 'asc' | 'desc' }}
          onSortChange={handleSortChange}
          
          // Search & Filters
          searchable={true}
          globalSearch={searchTerm}
          onGlobalSearchChange={handleGlobalSearchChange}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          
          // UI Configuration
          tableHeight="calc(100vh - 300px)"
          rowHeight="compact"
          stickyHeader={true}
          striped={false}
          bordered={true}
          hoverable={true}
          
          // Selection
          selectable={true}
          selectedRows={selectedRows}
          onSelectionChange={setSelectedRows}
          
          // Performance
          cacheResults={true}
          
          // Export & Actions
          exportable={true}
          onExport={handleExport}
          actions={customActions}
          
          // Monitoring
          showPerformanceMetrics={true}
          
          // Real-time
          realTimeUpdates={false}
          onRefresh={handleRefresh}
        />
      </div>

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        apiEndpoint="http://localhost:3001/api/inbound-calls/batch-import"
        requiredColumns={[
          'CallTime',
          'CallerID',
          'Destination',
          'Status'
        ]}
        uniqueIdentifier="CallTime"
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}