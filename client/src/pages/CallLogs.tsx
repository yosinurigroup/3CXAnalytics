import { AdvancedDataTable, Column } from "@/components/AdvancedDataTable";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useCallback } from "react";
import combinedCallLogsApiService, { CombinedCallLog } from "@/services/combinedCallLogsApi";
import { Loader2 } from "lucide-react";

const statusColors: Record<string, string> = {
  Answered: "bg-success/10 text-success border-success/20",
  Missed: "bg-destructive/10 text-destructive border-destructive/20",
  Unanswered: "bg-warning/10 text-warning border-warning/20",
  Redirected: "bg-secondary/10 text-secondary-foreground border-secondary/20",
};

const sentimentColors: Record<string, string> = {
  Positive: "bg-success/10 text-success border-success/20",
  Neutral: "bg-muted text-muted-foreground border-border",
  Negative: "bg-destructive/10 text-destructive border-destructive/20",
};

const callTypeColors: Record<string, string> = {
  Incoming: "bg-green-50 text-green-700 border-green-200",
  Outgoing: "bg-orange-50 text-orange-700 border-orange-200",
};

export default function CallLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<any>(null);
  const [data, setData] = useState<CombinedCallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [incomingCount, setIncomingCount] = useState(0);
  const [outgoingCount, setOutgoingCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortColumn, setSortColumn] = useState('CallTime');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch combined call logs data - optimized for smooth sorting
  const fetchData = useCallback(async () => {
    // Only show loading on initial load or when data is empty
    if (data.length === 0) {
      setLoading(true);
    }
    setError(null);
    
    console.log('[COMBINED-PAGE] Fetching real-time data...');
    
    try {
      const params = {
        page: currentPage,
        pageSize: pageSize,
        search: searchTerm,
        sortBy: sortColumn,
        sortOrder: sortDirection.toUpperCase() as 'ASC' | 'DESC',
        ...(filters?.dateFrom && { startDate: filters.dateFrom }),
        ...(filters?.dateTo && { endDate: filters.dateTo }),
        ...(filters?.columns && Object.keys(filters.columns).length > 0 && {
          ...Object.entries(filters.columns).reduce((acc, [key, value]) => {
            // Handle both single values and $in arrays
            if (typeof value === 'object' && value !== null && '$in' in value) {
              // For $in queries, we'll send as comma-separated string and let server handle it
              acc[key] = (value as { $in: string[] }).$in.join(',');
            } else {
              acc[key] = value;
            }
            return acc;
          }, {} as Record<string, any>)
        })
      };

      const response = await combinedCallLogsApiService.fetchCombinedCallLogs(params);
      
      if (response.success) {
        setData(response.data);
        setTotalRecords(response.total);
        setIncomingCount(response.incomingCount);
        setOutgoingCount(response.outgoingCount);
        setTotalPages(response.totalPages);
        
        console.log(`[COMBINED-PAGE] Loaded ${response.data.length} records (${response.incomingCount} incoming + ${response.outgoingCount} outgoing = ${response.total} total)`);
      } else {
        setData([]);
        setTotalRecords(0);
        if (response.error) {
          setError(response.error);
        }
      }
    } catch (err) {
      console.error('[COMBINED-PAGE] Error fetching data:', err);
      setData([]);
      setTotalRecords(0);
      setError(err instanceof Error ? err.message : 'Failed to fetch call logs data');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, filters, sortColumn, sortDirection, data.length]);

  // Initial data load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle pagination changes
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Handle page size changes
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  // Handle sorting changes - smooth sorting without refresh
  const handleSortChange = (columnKey: string, direction: 'asc' | 'desc' | null) => {
    if (direction === null) {
      // Reset to default sort
      setSortColumn('CallTime');
      setSortDirection('desc');
    } else {
      setSortColumn(columnKey);
      setSortDirection(direction);
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  // Listen for global search and filter events from Layout
  useEffect(() => {
    const handleSearch = (event: CustomEvent) => {
      const searchValue = event.detail;
      setSearchTerm(searchValue);
      setCurrentPage(1);
    };

    const handleFilters = (event: CustomEvent) => {
      const filterValue = event.detail;
      setFilters(filterValue);
      setCurrentPage(1);
    };

    const handleExport = async () => {
      console.log("Exporting combined call logs data...");
      try {
        const blob = await combinedCallLogsApiService.exportToCsv({
          search: searchTerm,
          ...filters
        });
        
        if (blob) {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `combined-call-logs-${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          console.log("Export completed successfully");
        } else {
          console.error("Export failed - no data returned");
        }
      } catch (error) {
        console.error("Export error:", error);
      }
    };

    window.addEventListener('global-search', handleSearch as EventListener);
    window.addEventListener('apply-filters', handleFilters as EventListener);
    window.addEventListener('export-data', handleExport);

    return () => {
      window.removeEventListener('global-search', handleSearch as EventListener);
      window.removeEventListener('apply-filters', handleFilters as EventListener);
      window.removeEventListener('export-data', handleExport);
    };
  }, [searchTerm, filters, pageSize, sortColumn, sortDirection]);

  const columns: Column<CombinedCallLog>[] = [
    {
      key: "CompanyCode",
      header: "Company Code",
      width: "100px",
      sortable: true,
      searchable: true,
      render: (value) => (
        <span className="text-xs font-medium text-blue-600">
          {value || '-'}
        </span>
      ),
    },
    {
      key: "AreaCode",
      header: "Area Code",
      width: "90px",
      sortable: true,
      searchable: true,
      render: (value) => (
        <span className="text-xs font-medium text-purple-600">
          {value || '-'}
        </span>
      ),
    },
    {
      key: "CallTime",
      header: "Call Time",
      width: "140px",
      sortable: true,
      searchable: true,
      render: (value) => (
        <span className="text-xs font-mono">
          {value ? new Date(value).toLocaleString() : '-'}
        </span>
      ),
    },
    {
      key: "CallerID",
      header: "Caller ID",
      width: "120px",
      searchable: true,
      render: (value) => (
        <span className="text-xs font-medium">{value || '-'}</span>
      ),
    },
    {
      key: "Trunk",
      header: "Trunk",
      width: "180px",
      searchable: true,
      render: (value) => (
        <span className="text-xs" title={value}>
          {value && value.length > 25 ? `${value.substring(0, 25)}...` : value || '-'}
        </span>
      ),
    },
    {
      key: "TrunkNumber",
      header: "Trunk Number",
      width: "120px",
      searchable: true,
      render: (value) => (
        <span className="text-xs text-muted-foreground">
          {value || '-'}
        </span>
      ),
    },
    {
      key: "Status",
      header: "Status",
      width: "100px",
      sortable: true,
      searchable: true,
      render: (value) => (
        <Badge 
          variant="outline" 
          className={`text-[10px] px-1.5 py-0 h-5 ${statusColors[value] || ""}`}
        >
          {value || '-'}
        </Badge>
      ),
    },
    {
      key: "Ringing",
      header: "Ringing",
      width: "80px",
      sortable: true,
      render: (value) => (
        <span className="text-xs font-mono text-muted-foreground">{value || '-'}</span>
      ),
    },
    {
      key: "Talking",
      header: "Talking",
      width: "80px",
      sortable: true,
      render: (value) => (
        <span className="text-xs font-mono text-muted-foreground">{value || '-'}</span>
      ),
    },
    {
      key: "TotalDuration",
      header: "Total Duration",
      width: "110px",
      sortable: true,
      render: (value) => (
        <span className="text-xs font-mono font-medium">{value || '-'}</span>
      ),
    },
    {
      key: "CallType",
      header: "Call Type",
      width: "90px",
      searchable: true,
      render: (value) => (
        <Badge 
          variant="outline" 
          className={`text-[10px] px-1.5 py-0 h-5 ${callTypeColors[value] || ""}`}
        >
          {value || '-'}
        </Badge>
      ),
    },
    {
      key: "Cost",
      header: "Cost",
      width: "80px",
      sortable: true,
      render: (value) => (
        <span className="text-xs text-muted-foreground">{value || '-'}</span>
      ),
    },
    {
      key: "Sentiment",
      header: "Sentiment",
      width: "90px",
      searchable: true,
      render: (value) => {
        if (!value) {
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
      width: "150px",
      searchable: true,
      render: (value) => (
        <span className="text-xs" title={value}>
          {value && value.length > 20 ? `${value.substring(0, 20)}...` : value || '-'}
        </span>
      ),
    },
    {
      key: "Transcription",
      header: "Transcription",
      width: "150px",
      searchable: true,
      render: (value) => (
        <span className="text-xs" title={value}>
          {value && value.length > 20 ? `${value.substring(0, 20)}...` : value || '-'}
        </span>
      ),
    },
  ];

  // Loading state - only show when data is empty
  if (loading && data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Loading combined call logs...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!loading && error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-2">Error loading call logs</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <button
            onClick={() => fetchData()}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-2">
      <AdvancedDataTable
        data={data}
        columns={columns}
        pageSize={pageSize}
        stickyHeader={true}
        rowHeight="compact"
        tableHeight="calc(100vh - 60px)"
        serverSide={true}
        totalRecords={totalRecords}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        enableSort={true}
        onSortChange={handleSortChange}
        currentSortColumn={sortColumn}
        currentSortDirection={sortDirection}
      />
      {loading && data.length > 0 && (
        <div className="absolute top-2 right-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}