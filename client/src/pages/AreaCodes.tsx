import { AdvancedDataTable, Column } from "@/components/AdvancedDataTable";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useCallback, useRef } from "react";
import areaCodesApiService from "@/services/areaCodesApi";
import { Loader2, Database, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTimelineToast, ImportProgress } from "@/hooks/use-timeline-toast";

// Area Code interface
interface AreaCodeRecord {
  AreaCode: string;
  State: string;
}

export default function AreaCodes() {
  const [data, setData] = useState<AreaCodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { showImportProgress, updateProgress, completeImport } = useTimelineToast();

  // Fetch data from MongoDB API - REAL-TIME, NO CACHING
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    // ALWAYS fetch fresh data - no caching
    console.log('[AREACODES-PAGE] Fetching real-time data...');
    
    try {
      const params = {
        page: currentPage,
        pageSize: pageSize,
        search: searchTerm,
        sortBy: 'AreaCode',
        sortOrder: 'ASC' as const,
        ...(filters?.dateRange?.from && { startDate: filters.dateRange.from }),
        ...(filters?.dateRange?.to && { endDate: filters.dateRange.to }),
        ...(filters?.columns && { ...filters.columns })
      };

      const response = await areaCodesApiService.fetchAreaCodes(params);
      
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
      console.error('Error fetching area codes:', err);
      // On error, show empty state - NO MOCK DATA
      setData([]);
      setTotalRecords(0);
      setError(err instanceof Error ? err.message : 'Failed to load data from MongoDB');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, filters]);

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
      const response = await fetch('http://localhost:3001/api/area-codes/import-optimized', {
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
      console.log('[AREACODES-IMPORT] Response content-type:', contentType);
      
      if (contentType && contentType.includes('application/x-ndjson')) {
        console.log('[AREACODES-IMPORT] Using streaming response for real-time progress');
        
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
                    console.log('[AREACODES-IMPORT] Streaming progress:', progressData);
                    
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
                    console.warn('[AREACODES-IMPORT] Failed to parse progress line:', line, e);
                  }
                }
              }
            }
            
            if (!hasReceivedData) {
              console.warn('[AREACODES-IMPORT] No streaming data received, falling back to JSON');
              throw new Error('No streaming data received');
            }
          } finally {
            reader.releaseLock();
          }
        }
      } else {
        console.log('[AREACODES-IMPORT] Using regular JSON response');
        
        // Fallback to regular JSON response
        const result = await response.json();
        console.log('[AREACODES-IMPORT] JSON response:', result);
        
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
      console.error('Error importing area codes file:', error);
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
      // Handle export functionality - EXPORT ALL DATA
      console.log("Export event received - Exporting ALL area codes data...");
      
      try {
        // Fetch ALL data for export (no pagination limits)
        const exportParams = {
          page: 1,
          pageSize: 10000, // Large number to get all records
          search: searchTerm,
          sortBy: 'AreaCode',
          sortOrder: 'ASC' as const,
          ...(filters?.dateRange?.from && { startDate: filters.dateRange.from }),
          ...(filters?.dateRange?.to && { endDate: filters.dateRange.to }),
          ...(filters?.columns && { ...filters.columns })
        };

        const response = await areaCodesApiService.fetchAreaCodes(exportParams);
        
        console.log("Export response:", response);
        
        if (response.success && response.data && response.data.length > 0) {
          console.log(`Processing ${response.data.length} records for export...`);
          
          // Create CSV with headers
          const headers = ['Area Code', 'State'];
          
          const rows = response.data.map(row => {
            return [
              row.AreaCode,
              row.State
            ].map(value => {
              // Escape values that contain commas or quotes
              if (value && (value.toString().includes(',') || value.toString().includes('"'))) {
                return `"${value.toString().replace(/"/g, '""')}"`;
              }
              return value || '';
            }).join(',');
          });
          
          const csv = [headers.join(','), ...rows].join('\n');
          console.log("CSV generated, length:", csv.length);
          
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `area-codes-${new Date().toISOString().split('T')[0]}.csv`;
          console.log("Triggering download with filename:", a.download);
          a.click();
          window.URL.revokeObjectURL(url);
          
          toast({
            title: "Export Successful",
            description: `Exported ${response.data.length} area code records to CSV`,
          });
        } else {
          toast({
            title: "No Data to Export",
            description: "There are no area code records to export",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error exporting area codes data:', error);
        toast({
          title: "Export Failed",
          description: "Failed to export area codes data. Please try again.",
          variant: "destructive"
        });
      }
    };

    const handleImport = () => {
      console.log('Import button clicked - opening file selector for area codes');
      fileInputRef.current?.click();
    };

    const handleDataCleared = () => {
      console.log('[AREACODES-PAGE] Data cleared event received - refreshing data');
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
  }, [data, searchTerm, filters, toast]);

  const columns: Column<AreaCodeRecord>[] = [
    {
      key: "AreaCode",
      header: "Area Code",
      width: "150px",
      sortable: true,
      searchable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-mono font-medium text-primary">{value}</span>
        </div>
      ),
    },
    {
      key: "State",
      header: "State",
      width: "200px",
      sortable: true,
      searchable: true,
      render: (value) => (
        <Badge variant="outline" className="text-sm px-3 py-1">
          {value}
        </Badge>
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
            <p className="text-sm text-muted-foreground">Loading area codes from MongoDB...</p>
          </div>
        </div>
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
            <h3 className="text-lg font-semibold mb-2">No Area Codes</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {error ? error : "No area code records found in the database."}
            </p>
            <button
              onClick={() => fetchData()}
              className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Refresh
            </button>
          </div>
        </div>
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
          // Enable server-side pagination
          serverSide={true}
          totalRecords={totalRecords}
          currentPage={currentPage}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
            setCurrentPage(1); // Reset to first page when changing page size
          }}
        />
        {loading && (
          <div className="absolute top-2 right-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
      </div>
    </>
  );
}