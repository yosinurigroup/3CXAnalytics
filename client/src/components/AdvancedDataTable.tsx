import { useState, useMemo, useEffect } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  sortable?: boolean;
  searchable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  getValue?: (row: T) => any;
}

interface AdvancedDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  className?: string;
  enableSort?: boolean;
  stickyHeader?: boolean;
  rowHeight?: "compact" | "normal" | "comfortable";
  onRowClick?: (row: T) => void;
  tableHeight?: string;
  // Server-side pagination props
  serverSide?: boolean;
  totalRecords?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  // Server-side sorting props
  onSortChange?: (columnKey: string, direction: 'asc' | 'desc' | null) => void;
  currentSortColumn?: string;
  currentSortDirection?: 'asc' | 'desc';
}

type SortDirection = "asc" | "desc" | null;

export function AdvancedDataTable<T extends Record<string, any>>({
  data,
  columns,
  pageSize: initialPageSize = 50,
  className = "",
  enableSort = true,
  stickyHeader = true,
  rowHeight = "compact",
  onRowClick,
  tableHeight,
  // Server-side pagination props
  serverSide = false,
  totalRecords = 0,
  currentPage: externalCurrentPage = 1,
  onPageChange,
  onPageSizeChange,
  // Server-side sorting props
  onSortChange,
  currentSortColumn,
  currentSortDirection,
}: AdvancedDataTableProps<T>) {
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(initialPageSize);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Use external pagination state if server-side, otherwise internal
  const currentPage = serverSide ? externalCurrentPage : internalCurrentPage;
  const pageSize = internalPageSize; // Always use internal pageSize as it gets updated by handlePageSizeChange

  // Reset page when data changes (only for client-side pagination or when data is empty)
  useEffect(() => {
    if (!serverSide) {
      setInternalCurrentPage(1);
    } else if (data.length === 0 && currentPage > 1) {
      // Only reset to page 1 if we're on a page > 1 and there's no data
      onPageChange?.(1);
    }
  }, [data.length, serverSide, onPageChange, currentPage]);

  // Get value from row for a column
  const getColumnValue = (row: T, column: Column<T>): any => {
    if (column.getValue) {
      return column.getValue(row);
    }
    const keys = String(column.key).split('.');
    let value: any = row;
    for (const key of keys) {
      value = value?.[key];
    }
    return value;
  };

  // Sort data (only for client-side sorting)
  const processedData = useMemo(() => {
    let sorted = [...data];

    // Apply client-side sorting if not using server-side sorting with callback
    if (!(serverSide && onSortChange) && sortColumn && sortDirection) {
      const column = columns.find(col => String(col.key) === sortColumn);
      if (column) {
        sorted.sort((a, b) => {
          const aValue = getColumnValue(a, column);
          const bValue = getColumnValue(b, column);
          
          if (aValue === null || aValue === undefined) return 1;
          if (bValue === null || bValue === undefined) return -1;
          
          let comparison = 0;
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
          } else {
            comparison = String(aValue).localeCompare(String(bValue));
          }
          
          return sortDirection === 'asc' ? comparison : -comparison;
        });
      }
    }

    return sorted;
  }, [data, sortColumn, sortDirection, columns, serverSide, onSortChange]);

  // Pagination - different logic for server-side vs client-side
  const totalPages = serverSide
    ? Math.ceil(totalRecords / pageSize)
    : Math.ceil(processedData.length / pageSize);
  
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  
  // For server-side pagination, show all data (already paginated by server)
  // For client-side pagination, slice the data
  const currentData = serverSide ? processedData : processedData.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    if (serverSide) {
      onPageChange?.(newPage);
    } else {
      setInternalCurrentPage(newPage);
    }
  };

  const handlePageSizeChange = (value: string) => {
    const newPageSize = Number(value);
    // Always update internal page size for consistent pagination calculation
    setInternalPageSize(newPageSize);
    
    if (serverSide) {
      onPageSizeChange?.(newPageSize);
    } else {
      setInternalCurrentPage(1);
    }
  };

  const handleSort = (columnKey: string) => {
    if (!enableSort) return;
    
    if (serverSide && onSortChange) {
      // Server-side sorting with onSortChange callback
      let newDirection: 'asc' | 'desc' | null = 'asc';
      
      if (currentSortColumn === columnKey) {
        // Same column clicked - cycle between asc and desc only (no null for server-side)
        if (currentSortDirection === 'asc') {
          newDirection = 'desc';
        } else {
          newDirection = 'asc'; // Toggle from desc to asc
        }
      } else {
        // Different column clicked - start with ascending
        newDirection = 'asc';
      }
      
      onSortChange(columnKey, newDirection);
    } else {
      // Client-side sorting (regardless of serverSide value when no onSortChange callback)
      if (sortColumn === columnKey) {
        if (sortDirection === 'asc') {
          setSortDirection('desc');
        } else if (sortDirection === 'desc') {
          setSortColumn(null);
          setSortDirection(null);
        }
      } else {
        setSortColumn(columnKey);
        setSortDirection('asc');
      }
    }
  };

  const getRowHeightClass = () => {
    switch (rowHeight) {
      case 'compact': return 'h-8';
      case 'comfortable': return 'h-12';
      default: return 'h-10';
    }
  };

  // Calculate dynamic height if not provided
  const calculatedHeight = tableHeight || "500px";

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Table Container with fixed height and scrollable body */}
      <div className="flex-1 flex flex-col border border-border/50 rounded-lg bg-background overflow-hidden" style={{ maxHeight: calculatedHeight }}>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead className={cn(
              "bg-muted/30",
              stickyHeader && "sticky top-0 z-10"
            )}>
              {/* Headers Row */}
              <tr className="border-b border-border/50">
                {columns.map((column, index) => (
                  <th
                    key={String(column.key)}
                    className={cn(
                      "px-2 sm:px-3 py-2 text-left font-medium text-muted-foreground bg-muted/30",
                      enableSort && column.sortable !== false && "cursor-pointer hover:text-foreground transition-colors",
                      "select-none",
                      // Hide less important columns on mobile
                      index > 4 && "hidden lg:table-cell"
                    )}
                    style={{ width: column.width }}
                    onClick={() => column.sortable !== false && handleSort(String(column.key))}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-xs truncate">{column.header}</span>
                      {enableSort && column.sortable !== false && (
                        <div className="ml-auto">
                          {((serverSide && onSortChange) ? currentSortColumn : sortColumn) === String(column.key) ? (
                            ((serverSide && onSortChange) ? currentSortDirection : sortDirection) === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            
            <tbody>
              {currentData.length === 0 ? (
                <tr>
                  <td 
                    colSpan={columns.length} 
                    className="text-center py-8 text-muted-foreground"
                  >
                    No results found
                  </td>
                </tr>
              ) : (
                currentData.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={cn(
                      "border-b border-border/30 hover:bg-muted/30 transition-colors",
                      onRowClick && "cursor-pointer",
                      getRowHeightClass()
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((column, colIndex) => (
                      <td
                        key={String(column.key)}
                        className={cn(
                          "px-2 sm:px-3 py-1 text-xs",
                          // Hide less important columns on mobile
                          colIndex > 4 && "hidden lg:table-cell"
                        )}
                      >
                        <div className="truncate">
                          {column.render
                            ? column.render(getColumnValue(row, column), row)
                            : String(getColumnValue(row, column) || "-")}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - Sticky Footer - Responsive */}
        <div className="sticky bottom-0 z-10 flex flex-col sm:flex-row items-center justify-between gap-2 p-2 sm:p-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Rows per page</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-7 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 50, 100, 200].map((size) => (
                  <SelectItem key={size} value={String(size)} className="text-xs">
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground sm:hidden">
              {(serverSide ? totalRecords : processedData.length) === 0
                ? "0 of 0"
                : `${Math.min(startIndex + 1, serverSide ? totalRecords : processedData.length)}-${Math.min(endIndex, serverSide ? totalRecords : processedData.length)} of ${serverSide ? totalRecords : processedData.length}`
              }
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-xs text-muted-foreground hidden sm:block">
              {(serverSide ? totalRecords : processedData.length) === 0
                ? "Showing 0 entries"
                : `Showing ${Math.min(startIndex + 1, serverSide ? totalRecords : processedData.length)} to ${Math.min(endIndex, serverSide ? totalRecords : processedData.length)} of ${serverSide ? totalRecords : processedData.length} entries`
              }
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 hidden sm:flex"
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              
              <div className="flex items-center gap-1 px-1 sm:px-2">
                <span className="text-xs hidden sm:inline">Page</span>
                <span className="text-xs font-medium">{currentPage}</span>
                <span className="text-xs">/</span>
                <span className="text-xs font-medium">{totalPages || 1}</span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 hidden sm:flex"
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                <ChevronsRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}