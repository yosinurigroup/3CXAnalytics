import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings,
  Download,
  RefreshCw,
  Loader2,
  Database,
  Zap,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  sortable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  sticky?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  getValue?: (row: T) => any;
  exportable?: boolean;
  priority?: number; // For responsive hiding
}

interface PaginationConfig {
  serverSide: boolean;
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  pageSizeOptions: number[];
  showQuickJumper: boolean;
  showSizeChanger: boolean;
  showTotal: boolean;
  showPageInfo: boolean;
}

interface PerformanceMetrics {
  queryTime: number;
  renderTime: number;
  totalRecords: number;
  filteredRecords: number;
  lastUpdated: Date;
}

interface EnterpriseDataTableProps<T> {
  // Data
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  error?: string | null;
  
  // Pagination
  pagination?: Partial<PaginationConfig>;
  onPageChange?: (page: number, pageSize: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  
  // Sorting
  sortable?: boolean;
  defaultSort?: { column: string; direction: 'asc' | 'desc' };
  onSortChange?: (column: string, direction: 'asc' | 'desc' | null) => void;
  
  // Filtering & Search
  searchable?: boolean;
  globalSearch?: string;
  onGlobalSearchChange?: (search: string) => void;
  filters?: Record<string, any>;
  onFiltersChange?: (filters: Record<string, any>) => void;
  
  // UI Configuration
  className?: string;
  tableHeight?: string;
  rowHeight?: "compact" | "normal" | "comfortable";
  stickyHeader?: boolean;
  stickyColumns?: boolean;
  striped?: boolean;
  bordered?: boolean;
  hoverable?: boolean;
  
  // Interaction
  selectable?: boolean;
  selectedRows?: Set<number>;
  onSelectionChange?: (selectedRows: Set<number>) => void;
  onRowClick?: (row: T, index: number) => void;
  onRowDoubleClick?: (row: T, index: number) => void;
  
  // Performance
  virtualScrolling?: boolean;
  lazyLoading?: boolean;
  cacheResults?: boolean;
  
  // Export & Actions
  exportable?: boolean;
  onExport?: (format: 'csv' | 'excel' | 'json') => void;
  actions?: React.ReactNode;
  
  // Monitoring
  showPerformanceMetrics?: boolean;
  onPerformanceUpdate?: (metrics: PerformanceMetrics) => void;
  
  // Real-time
  realTimeUpdates?: boolean;
  refreshInterval?: number;
  onRefresh?: () => void;
}

type SortDirection = "asc" | "desc" | null;

export function EnterpriseDataTable<T extends Record<string, any>>({
  // Data
  data = [],
  columns,
  loading = false,
  error = null,
  
  // Pagination
  pagination = {},
  onPageChange,
  onPageSizeChange,
  
  // Sorting
  sortable = true,
  defaultSort,
  onSortChange,
  
  // Filtering & Search
  searchable = true,
  globalSearch = "",
  onGlobalSearchChange,
  filters = {},
  onFiltersChange,
  
  // UI Configuration
  className = "",
  tableHeight = "calc(100vh - 200px)",
  rowHeight = "compact",
  stickyHeader = true,
  stickyColumns = false,
  striped = false,
  bordered = true,
  hoverable = true,
  
  // Interaction
  selectable = false,
  selectedRows = new Set(),
  onSelectionChange,
  onRowClick,
  onRowDoubleClick,
  
  // Performance
  virtualScrolling = false,
  lazyLoading = false,
  cacheResults = true,
  
  // Export & Actions
  exportable = false,
  onExport,
  actions,
  
  // Monitoring
  showPerformanceMetrics = false,
  onPerformanceUpdate,
  
  // Real-time
  realTimeUpdates = false,
  refreshInterval = 30000,
  onRefresh,
}: EnterpriseDataTableProps<T>) {
  // State Management
  const [localSearch, setLocalSearch] = useState(globalSearch);
  const [localFilters, setLocalFilters] = useState(filters);
  const [sortColumn, setSortColumn] = useState<string | null>(defaultSort?.column || null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort?.direction || null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Performance tracking
  const renderStartTime = useRef<number>(Date.now());
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    queryTime: 0,
    renderTime: 0,
    totalRecords: data.length,
    filteredRecords: data.length,
    lastUpdated: new Date()
  });

  // Pagination Configuration
  const paginationConfig: PaginationConfig = {
    serverSide: false,
    currentPage: 1,
    pageSize: 50,
    totalRecords: data.length,
    totalPages: Math.ceil(data.length / 50),
    pageSizeOptions: [10, 25, 50, 100, 200, 500, 1000],
    showQuickJumper: true,
    showSizeChanger: true,
    showTotal: true,
    showPageInfo: true,
    ...pagination
  };

  // Auto-refresh for real-time updates
  useEffect(() => {
    if (realTimeUpdates && refreshInterval > 0 && onRefresh) {
      const interval = setInterval(() => {
        setIsRefreshing(true);
        onRefresh();
        setTimeout(() => setIsRefreshing(false), 1000);
      }, refreshInterval);
      
      return () => clearInterval(interval);
    }
  }, [realTimeUpdates, refreshInterval, onRefresh]);

  // Performance monitoring
  useEffect(() => {
    const renderTime = Date.now() - renderStartTime.current;
    const metrics: PerformanceMetrics = {
      queryTime: 0, // This would be passed from API
      renderTime,
      totalRecords: data.length,
      filteredRecords: processedData.length,
      lastUpdated: new Date()
    };
    
    setPerformanceMetrics(metrics);
    onPerformanceUpdate?.(metrics);
  }, [data, onPerformanceUpdate]);

  // Get value from row for a column
  const getColumnValue = useCallback((row: T, column: Column<T>): any => {
    if (column.getValue) {
      return column.getValue(row);
    }
    const keys = String(column.key).split('.');
    let value: any = row;
    for (const key of keys) {
      value = value?.[key];
    }
    return value;
  }, []);

  // Advanced filtering and sorting
  const processedData = useMemo(() => {
    renderStartTime.current = Date.now();
    let result = [...data];

    // Global search
    if (localSearch.trim()) {
      const searchTerm = localSearch.toLowerCase();
      result = result.filter(row =>
        columns.some(column => {
          if (!column.searchable) return false;
          const value = getColumnValue(row, column);
          return String(value || '').toLowerCase().includes(searchTerm);
        })
      );
    }

    // Column filters
    Object.entries(localFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        result = result.filter(row => {
          const rowValue = getColumnValue(row, { key } as Column<T>);
          if (Array.isArray(value)) {
            return value.includes(rowValue);
          }
          return String(rowValue || '').toLowerCase().includes(String(value).toLowerCase());
        });
      }
    });

    // Sorting
    if (sortColumn && sortDirection) {
      const column = columns.find(col => String(col.key) === sortColumn);
      if (column) {
        result.sort((a, b) => {
          const aValue = getColumnValue(a, column);
          const bValue = getColumnValue(b, column);
          
          if (aValue === null || aValue === undefined) return 1;
          if (bValue === null || bValue === undefined) return -1;
          
          let comparison = 0;
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
          } else if (aValue instanceof Date && bValue instanceof Date) {
            comparison = aValue.getTime() - bValue.getTime();
          } else {
            comparison = String(aValue).localeCompare(String(bValue));
          }
          
          return sortDirection === 'asc' ? comparison : -comparison;
        });
      }
    }

    return result;
  }, [data, localSearch, localFilters, sortColumn, sortDirection, columns, getColumnValue]);

  // Pagination calculations
  const totalPages = Math.ceil(processedData.length / paginationConfig.pageSize);
  const startIndex = (paginationConfig.currentPage - 1) * paginationConfig.pageSize;
  const endIndex = startIndex + paginationConfig.pageSize;
  const currentPageData = paginationConfig.serverSide ? data : processedData.slice(startIndex, endIndex);

  // Event handlers
  const handleSort = useCallback((columnKey: string) => {
    if (!sortable) return;
    
    let newDirection: SortDirection = 'asc';
    if (sortColumn === columnKey) {
      if (sortDirection === 'asc') {
        newDirection = 'desc';
      } else if (sortDirection === 'desc') {
        newDirection = null;
        setSortColumn(null);
      }
    }
    
    setSortColumn(newDirection ? columnKey : null);
    setSortDirection(newDirection);
    onSortChange?.(columnKey, newDirection);
  }, [sortable, sortColumn, sortDirection, onSortChange]);

  const handlePageChange = useCallback((page: number) => {
    onPageChange?.(page, paginationConfig.pageSize);
  }, [onPageChange, paginationConfig.pageSize]);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    onPageSizeChange?.(newPageSize);
  }, [onPageSizeChange]);

  const handleGlobalSearch = useCallback((value: string) => {
    setLocalSearch(value);
    onGlobalSearchChange?.(value);
  }, [onGlobalSearchChange]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'json') => {
    if (onExport) {
      onExport(format);
    } else {
      // Default CSV export
      const exportData = processedData.map(row => {
        const exportRow: Record<string, any> = {};
        columns.forEach(column => {
          if (column.exportable !== false) {
            exportRow[column.header] = getColumnValue(row, column);
          }
        });
        return exportRow;
      });

      if (format === 'csv') {
        const headers = columns.filter(col => col.exportable !== false).map(col => col.header);
        const csvContent = [
          headers.join(','),
          ...exportData.map(row => 
            headers.map(header => {
              const value = row[header];
              return typeof value === 'string' && value.includes(',') 
                ? `"${value.replace(/"/g, '""')}"` 
                : value;
            }).join(',')
          )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  }, [onExport, processedData, columns, getColumnValue]);

  // Row height classes
  const getRowHeightClass = () => {
    switch (rowHeight) {
      case 'compact': return 'h-8';
      case 'comfortable': return 'h-12';
      default: return 'h-10';
    }
  };

  // Visible columns (excluding hidden ones)
  const visibleColumns = columns.filter(col => !hiddenColumns.has(String(col.key)));

  // Loading state
  if (loading && currentPageData.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-sm text-muted-foreground">Loading data...</p>
            {showPerformanceMetrics && (
              <div className="mt-2 text-xs text-muted-foreground">
                Query time: {performanceMetrics.queryTime}ms
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Database className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2 text-destructive">Error Loading Data</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            {onRefresh && (
              <Button onClick={onRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 p-4 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-4">
          {/* Global Search */}
          {searchable && (
            <div className="relative">
              <Input
                placeholder="Search all columns..."
                value={localSearch}
                onChange={(e) => handleGlobalSearch(e.target.value)}
                className="w-64"
              />
            </div>
          )}

          {/* Performance Metrics */}
          {showPerformanceMetrics && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                {performanceMetrics.totalRecords} records
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Zap className="h-3 w-3" />
                {performanceMetrics.renderTime}ms
              </Badge>
            </div>
          )}

          {/* Real-time indicator */}
          {realTimeUpdates && (
            <Badge variant={isRefreshing ? "default" : "secondary"} className="gap-1">
              <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
              Live
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Custom Actions */}
          {actions}

          {/* Export */}
          {exportable && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48">
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleExport('csv')}
                  >
                    Export as CSV
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleExport('json')}
                  >
                    Export as JSON
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Column Settings */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Visible Columns</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {columns.map((column) => (
                      <div key={String(column.key)} className="flex items-center space-x-2">
                        <Checkbox
                          id={String(column.key)}
                          checked={!hiddenColumns.has(String(column.key))}
                          onCheckedChange={(checked) => {
                            const newHidden = new Set(hiddenColumns);
                            if (checked) {
                              newHidden.delete(String(column.key));
                            } else {
                              newHidden.add(String(column.key));
                            }
                            setHiddenColumns(newHidden);
                          }}
                        />
                        <label
                          htmlFor={String(column.key)}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {column.header}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Refresh */}
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div 
        className="flex-1 overflow-auto border-x"
        style={{ maxHeight: tableHeight }}
      >
        <table className="w-full text-sm">
          {/* Header */}
          <thead className={cn(
            "bg-muted/50",
            stickyHeader && "sticky top-0 z-20"
          )}>
            <tr className={cn(bordered && "border-b")}>
              {selectable && (
                <th className="w-12 px-3 py-2">
                  <Checkbox
                    checked={selectedRows.size === currentPageData.length && currentPageData.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const newSelection = new Set(selectedRows);
                        currentPageData.forEach((_, index) => {
                          newSelection.add(startIndex + index);
                        });
                        onSelectionChange?.(newSelection);
                      } else {
                        const newSelection = new Set(selectedRows);
                        currentPageData.forEach((_, index) => {
                          newSelection.delete(startIndex + index);
                        });
                        onSelectionChange?.(newSelection);
                      }
                    }}
                  />
                </th>
              )}
              
              {visibleColumns.map((column, index) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    "px-3 py-2 text-left font-medium text-muted-foreground",
                    column.sortable !== false && sortable && "cursor-pointer hover:text-foreground transition-colors",
                    column.sticky && stickyColumns && "sticky left-0 bg-muted/50 z-10",
                    "select-none"
                  )}
                  style={{ 
                    width: column.width,
                    minWidth: column.minWidth,
                    maxWidth: column.maxWidth
                  }}
                  onClick={() => column.sortable !== false && handleSort(String(column.key))}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate">{column.header}</span>
                    {column.sortable !== false && sortable && (
                      <div className="flex-shrink-0">
                        {sortColumn === String(column.key) ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-4 w-4" />
                          ) : (
                            <ArrowDown className="h-4 w-4" />
                          )
                        ) : (
                          <ArrowUpDown className="h-4 w-4 opacity-30" />
                        )}
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {currentPageData.length === 0 ? (
              <tr>
                <td 
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  className="text-center py-12 text-muted-foreground"
                >
                  <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <div>No data available</div>
                  {localSearch && (
                    <div className="text-xs mt-1">
                      Try adjusting your search criteria
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              currentPageData.map((row, rowIndex) => {
                const globalIndex = startIndex + rowIndex;
                const isSelected = selectedRows.has(globalIndex);
                
                return (
                  <tr
                    key={rowIndex}
                    className={cn(
                      "transition-colors",
                      bordered && "border-b border-border/30",
                      striped && rowIndex % 2 === 0 && "bg-muted/20",
                      hoverable && "hover:bg-muted/30",
                      isSelected && "bg-primary/10",
                      (onRowClick || onRowDoubleClick) && "cursor-pointer",
                      getRowHeightClass()
                    )}
                    onClick={() => onRowClick?.(row, globalIndex)}
                    onDoubleClick={() => onRowDoubleClick?.(row, globalIndex)}
                  >
                    {selectable && (
                      <td className="px-3 py-1">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const newSelection = new Set(selectedRows);
                            if (checked) {
                              newSelection.add(globalIndex);
                            } else {
                              newSelection.delete(globalIndex);
                            }
                            onSelectionChange?.(newSelection);
                          }}
                        />
                      </td>
                    )}
                    
                    {visibleColumns.map((column) => (
                      <td
                        key={String(column.key)}
                        className={cn(
                          "px-3 py-1",
                          column.sticky && stickyColumns && "sticky left-0 bg-background z-10"
                        )}
                      >
                        <div className="truncate">
                          {column.render
                            ? column.render(getColumnValue(row, column), row, globalIndex)
                            : String(getColumnValue(row, column) || "-")}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Enhanced Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t bg-background/95 backdrop-blur">
        <div className="flex items-center gap-4">
          {/* Page Size Selector */}
          {paginationConfig.showSizeChanger && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show</span>
              <Select 
                value={String(paginationConfig.pageSize)} 
                onValueChange={(value) => handlePageSizeChange(Number(value))}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paginationConfig.pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">entries</span>
            </div>
          )}

          {/* Total Records Info */}
          {paginationConfig.showTotal && (
            <div className="text-sm text-muted-foreground">
              {paginationConfig.serverSide ? (
                <>Showing {Math.min(startIndex + 1, paginationConfig.totalRecords)} to {Math.min(endIndex, paginationConfig.totalRecords)} of {paginationConfig.totalRecords.toLocaleString()} entries</>
              ) : (
                <>Showing {Math.min(startIndex + 1, processedData.length)} to {Math.min(endIndex, processedData.length)} of {processedData.length.toLocaleString()} entries</>
              )}
              {processedData.length !== data.length && (
                <span className="text-primary"> (filtered from {data.length.toLocaleString()} total)</span>
              )}
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Jumper */}
          {paginationConfig.showQuickJumper && totalPages > 10 && (
            <div className="flex items-center gap-2 mr-4">
              <span className="text-sm text-muted-foreground">Go to</span>
              <Input
                type="number"
                min={1}
                max={totalPages}
                className="h-8 w-16 text-center"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const page = parseInt((e.target as HTMLInputElement).value);
                    if (page >= 1 && page <= totalPages) {
                      handlePageChange(page);
                    }
                  }
                }}
              />
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handlePageChange(1)}
              disabled={paginationConfig.currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handlePageChange(paginationConfig.currentPage - 1)}
              disabled={paginationConfig.currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {/* Page Numbers */}
            <div className="flex items-center gap-1 px-2">
              <span className="text-sm font-medium">{paginationConfig.currentPage}</span>
              <span className="text-sm text-muted-foreground">/</span>
              <span className="text-sm font-medium">{totalPages || 1}</span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handlePageChange(paginationConfig.currentPage + 1)}
              disabled={paginationConfig.currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handlePageChange(totalPages)}
              disabled={paginationConfig.currentPage === totalPages || totalPages === 0}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}