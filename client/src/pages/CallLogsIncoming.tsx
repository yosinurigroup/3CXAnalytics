import { AdvancedDataTable, Column } from "@/components/AdvancedDataTable";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useCallback, useRef } from "react";
import apiService from "@/services/api";
import type { InboundCall } from "@/services/api";
import { Loader2, Database } from "lucide-react";
import { CSVImportModal } from "@/components/CSVImportModal";
import { useToast } from "@/hooks/use-toast";
import { useTimelineToast } from "@/hooks/use-timeline-toast";
import { transformMongoDBToDisplay, getDisplayFieldNames } from "@/utils/fieldMapping";

// Use the InboundCall type from api service directly
type IncomingCallRecord = InboundCall;

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

export default function CallLogsIncoming() {
  const [data, setData] = useState<IncomingCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize, setPageSize] = useState(50); // Default 50 records per page
  const [showImportModal, setShowImportModal] = useState(false);
  // Server-side sorting state
  const [sortColumn, setSortColumn] = useState<string>('CallTime');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { showImportProgress, updateProgress, completeImport } = useTimelineToast();

  // Fetch data from MongoDB API - REAL-TIME, NO CACHING
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    // ALWAYS fetch fresh data - no caching
    console.log('[PAGE] Fetching real-time data...');
    
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

      const response = await apiService.fetchInboundCalls(params);
      
      if (response.success && response.data) {
        setData(response.data);
        setTotalRecords(response.total || 0);
      } else {
        // If API returns error, show empty state
        setData([]);
        setTotalRecords(0);
        if (response.error) {
          setError(response.error);
        }
      }
    } catch (err) {
      console.error('Error fetching inbound calls:', err);
      // On error, show empty state - NO MOCK DATA
      setData([]);
      setTotalRecords(0);
      setError(err instanceof Error ? err.message : 'Failed to load data from MongoDB');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, filters, sortColumn, sortDirection]);

  // Handle direct file import with clean timeline notification
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.name.endsWith('.csv')) {
      toast({
        title: '🚫 Invalid file type',
        description: 'Please select a CSV file to continue the magic!',
        variant: 'destructive'
      });
      return;
    }

    // Check file size (limit to 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: '📁 File too large',
        description: 'Please select a file smaller than 50MB for optimal performance',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Start the clean timeline notification
      const timelineId = showImportProgress();

      // Use MAXIMUM PERFORMANCE settings for super fast import
      const formData = new FormData();
      formData.append('file', file);
      formData.append('batchSize', '500'); // Increased from 100 to 500
      formData.append('workerPoolSize', '8'); // Maximum worker pool size
      formData.append('maxConcurrentBatches', '4'); // Increased concurrent batches
      formData.append('enableProfiling', 'true');
      formData.append('rocketMode', 'true');
      formData.append('turboMode', 'true'); // Enable turbo mode
      formData.append('enableStreaming', 'true'); // Enable real-time streaming

      // REAL-TIME PROGRESS TRACKING - Request streaming response
      const response = await fetch('http://localhost:3001/api/inbound-calls/import-optimized', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/x-ndjson' // Request streaming response
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || `HTTP error! status: ${response.status}`;
        } catch {
          errorMessage = errorText || `HTTP error! status: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      // Check if the response supports streaming
      const contentType = response.headers.get('content-type');
      console.log('[IMPORT] Response content-type:', contentType);
      
      if (contentType && contentType.includes('application/x-ndjson')) {
        console.log('[IMPORT] Using streaming response for real-time progress');
        
        // Handle streaming response for real-time updates
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let hasReceivedData = false;
        
        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              hasReceivedData = true;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer
              
              for (const line of lines) {
                if (line.trim()) {
                  try {
                    const progressData = JSON.parse(line);
                    console.log('[IMPORT] Streaming progress:', progressData);
                    
                    // Check if this is the final result
                    if (progressData.step === 'complete' || progressData.progress === 100) {
                      completeImport(timelineId, {
                        recordsFound: progressData.recordsFound || progressData.total || 0,
                        created: progressData.created || 0,
                        updated: progressData.updated || 0,
                        failed: progressData.failed || 0,
                        currentStep: 'complete',
                        progress: 100
                      });
                    } else {
                      // Update progress with real-time data from server
                      updateProgress(timelineId, {
                        recordsFound: progressData.recordsFound || progressData.total || 0,
                        created: progressData.created || 0,
                        updated: progressData.updated || 0,
                        failed: progressData.failed || 0,
                        currentStep: progressData.step || 'processing',
                        progress: progressData.progress || 0
                      });
                    }
                  } catch (e) {
                    console.warn('[IMPORT] Failed to parse progress line:', line, e);
                  }
                }
              }
            }
            
            if (!hasReceivedData) {
              console.warn('[IMPORT] No streaming data received, falling back to JSON');
              throw new Error('No streaming data received');
            }
          } finally {
            reader.releaseLock();
          }
        }
      } else {
        console.log('[IMPORT] Using regular JSON response');
        
        // Fallback to regular JSON response
        const result = await response.json();
        console.log('[IMPORT] JSON response:', result);
        
        // Update with records found immediately
        updateProgress(timelineId, {
          recordsFound: result.total || 0,
          created: 0,
          updated: 0,
          failed: 0,
          currentStep: 'processing',
          progress: 50
        });

        // Show final results immediately
        completeImport(timelineId, {
          recordsFound: result.total || 0,
          created: result.created || 0,
          updated: result.updated || 0,
          failed: result.failed || 0,
          currentStep: 'complete',
          progress: 100
        });
      }

      // Refresh the data after import
      fetchData();
    } catch (error: any) {
      console.error('Error importing file:', error);
      toast({
        title: "💥 Import Challenge Encountered",
        description: error.message || 'The import process hit a snag, but we\'re ready to try again!',
        variant: "destructive"
      });
    } finally {
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for global search and filter events from Layout
  useEffect(() => {
    const handleSearch = (event: CustomEvent) => {
      setSearchTerm(event.detail);
      setCurrentPage(1); // Reset to first page on new search
    };

    const handleFilters = (event: CustomEvent) => {
      setFilters(event.detail);
      setCurrentPage(1); // Reset to first page on new filters
    };

    const handleExport = async () => {
      // Handle export functionality with display names - EXPORT ALL DATA
      console.log("Export event received - Exporting ALL incoming call data...");
      
      try {
        // Fetch ALL data for export (no pagination limits)
        const exportParams = {
          page: 1,
          pageSize: 10000, // Large number to get all records
          search: searchTerm,
          sortBy: sortColumn,
          sortOrder: sortDirection.toUpperCase() as 'ASC' | 'DESC',
          ...(filters?.dateFrom && { startDate: filters.dateFrom }),
          ...(filters?.dateTo && { endDate: filters.dateTo }),
          ...(filters?.columns && Object.keys(filters.columns).length > 0 && {
            ...Object.entries(filters.columns).reduce((acc, [key, value]) => {
              // Handle both single values and $in arrays
              if (typeof value === 'object' && value !== null && '$in' in value) {
                acc[key] = (value as { $in: string[] }).$in.join(',');
              } else {
                acc[key] = value;
              }
              return acc;
            }, {} as Record<string, any>)
          })
        };

        const response = await apiService.fetchInboundCalls(exportParams);
        
        console.log("Export response:", response);
        
        if (response.success && response.data && response.data.length > 0) {
          console.log(`Processing ${response.data.length} records for export...`);
          
          // Transform data to use display names
          const displayData = response.data.map(row => transformMongoDBToDisplay(row));
          console.log("Sample transformed data:", displayData[0]);
          
          // Create CSV with display names as headers
          const headers = getDisplayFieldNames().join(',');
          console.log("CSV Headers:", headers);
          
          const rows = displayData.map(row => {
            return getDisplayFieldNames().map(field => {
              const value = row[field];
              // Escape values that contain commas or quotes
              if (value && (value.toString().includes(',') || value.toString().includes('"'))) {
                return `"${value.toString().replace(/"/g, '""')}"`;
              }
              return value || '';
            }).join(',');
          });
          
          const csv = [headers, ...rows].join('\n');
          console.log("CSV generated, length:", csv.length);
          console.log("First few lines of CSV:", csv.substring(0, 200));
          
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `incoming-calls-${new Date().toISOString().split('T')[0]}.csv`;
          console.log("Triggering download with filename:", a.download);
          a.click();
          window.URL.revokeObjectURL(url);
          
          toast({
            title: "Export Successful",
            description: `Exported ${response.data.length} records to CSV (all data from database)`,
          });
        } else {
          toast({
            title: "No Data to Export",
            description: "There are no records to export",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error exporting data:', error);
        toast({
          title: "Export Failed",
          description: "Failed to export data. Please try again.",
          variant: "destructive"
        });
      }
    };

    const handleImport = () => {
      console.log('Import button clicked - opening file selector');
      fileInputRef.current?.click();
    };

    const handleDataCleared = () => {
      console.log('[PAGE] Data cleared event received - refreshing data');
      // Clear state immediately
      setData([]);
      setTotalRecords(0);
      // Reset page to 1
      setCurrentPage(1);
      // Fetch fresh data immediately
      setTimeout(() => {
        fetchData();
      }, 100);
    };

    window.addEventListener('global-search', handleSearch as EventListener);
    window.addEventListener('apply-filters', handleFilters as EventListener);
    window.addEventListener('export-data', handleExport);
    window.addEventListener('import-data', handleImport);
    window.addEventListener('data-cleared', handleDataCleared);

    return () => {
      window.removeEventListener('global-search', handleSearch as EventListener);
      window.removeEventListener('apply-filters', handleFilters as EventListener);
      window.removeEventListener('export-data', handleExport);
      window.removeEventListener('import-data', handleImport);
      window.removeEventListener('data-cleared', handleDataCleared);
    };
  }, [data, searchTerm, filters, toast, sortColumn, sortDirection, fetchData]);

  // Handle server-side sorting
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
      render: (value) => (
        <span className="text-xs">{value || '-'}</span>
      ),
    },
    {
      key: "TrunkNumber",
      header: "Trunk Number",
      width: "110px",
      render: (value) => (
        <span className="text-xs text-muted-foreground">{value || '-'}</span>
      ),
    },
    {
      key: "DID",
      header: "DID",
      width: "110px",
      searchable: true,
      render: (value) => (
        <span className="text-xs text-muted-foreground">{value || '-'}</span>
      ),
    },
    {
      key: "Status",
      header: "Status",
      width: "90px",
      sortable: true,
      searchable: true,
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
      key: "Ringing",
      header: "Ringing",
      width: "70px",
      sortable: true,
      render: (value) => (
        <span className="text-xs font-mono text-muted-foreground">{value || '00:00'}</span>
      ),
    },
    {
      key: "Talking",
      header: "Talking",
      width: "70px",
      sortable: true,
      render: (value) => (
        <span className="text-xs font-mono text-muted-foreground">{value || '00:00'}</span>
      ),
    },
    {
      key: "TotalDuration",
      header: "Total Duration",
      width: "95px",
      sortable: true,
      render: (value) => (
        <span className="text-xs font-mono font-medium">{value || '00:00'}</span>
      ),
    },
    {
      key: "CallType",
      header: "Call Type",
      width: "80px",
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
    {
      key: "Transcription",
      header: "Transcription",
      width: "250px",
      searchable: true,
      render: (value) => (
        <span className="text-xs text-muted-foreground truncate" title={value}>
          {value || '-'}
        </span>
      ),
    },
  ];

  // Loading state
  if (loading && data.length === 0) {
    return (
      <>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-sm text-muted-foreground">Loading incoming calls from MongoDB...</p>
          </div>
        </div>
        
        {/* CSV Import Modal - Always render */}
        <CSVImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          apiEndpoint="http://localhost:3001/api/inbound-calls/import"
          requiredColumns={[
            'Call Time',
            'Caller ID'
          ]}
          uniqueIdentifier="Call Time"
          onImportComplete={(stats) => {
            toast({
              title: "Import Complete",
              description: `Created: ${stats.created}, Updated: ${stats.updated}, Failed: ${stats.failed}`,
            });
            // Refresh the data after import - always real-time
            fetchData();
            setShowImportModal(false);
          }}
        />
      </>
    );
  }

  // Empty state when no data exists
  if (!loading && data.length === 0) {
    return (
      <>
        {/* Hidden file input for direct import - MUST BE PRESENT IN EMPTY STATE */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Incoming Calls</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {error ? error : "No incoming call records found in the database."}
            </p>
            <button
              onClick={() => fetchData()}
              className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Refresh
            </button>
          </div>
        </div>
        
        {/* CSV Import Modal - Always render */}
        <CSVImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          apiEndpoint="http://localhost:3001/api/inbound-calls/import"
          requiredColumns={[
            'Call Time',
            'Caller ID'
          ]}
          uniqueIdentifier="Call Time"
          onImportComplete={(stats) => {
            toast({
              title: "Import Complete",
              description: `Created: ${stats.created}, Updated: ${stats.updated}, Failed: ${stats.failed}`,
            });
            // Refresh the data after import - always real-time
            fetchData();
            setShowImportModal(false);
          }}
        />
      </>
    );
  }

  // Data table view
  return (
    <>
      {/* Hidden file input for direct import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="h-full p-2">
        <AdvancedDataTable
          data={data}
          columns={columns}
          pageSize={pageSize}
          stickyHeader={true}
          rowHeight="compact"
          tableHeight="calc(100vh - 60px)"
          // Enable server-side pagination and sorting
          serverSide={true}
          totalRecords={totalRecords}
          currentPage={currentPage}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
            setCurrentPage(1); // Reset to first page when changing page size
          }}
          // Server-side sorting props
          onSortChange={handleSortChange}
          currentSortColumn={sortColumn}
          currentSortDirection={sortDirection}
        />
        {loading && (
          <div className="absolute top-2 right-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        apiEndpoint="http://localhost:3001/api/inbound-calls/import"
        requiredColumns={[
          'CallTime',
          'CallerID',
          'Destination',
          'Status'
        ]}
        uniqueIdentifier="CallTime"
        onImportComplete={(stats) => {
          toast({
            title: "Import Complete",
            description: `Created: ${stats.created}, Updated: ${stats.updated}, Failed: ${stats.failed}`,
          });
          // Refresh the data after import - always real-time
          fetchData();
          setShowImportModal(false);
        }}
      />
    </>
  );
}