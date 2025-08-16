import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface Column<T> {
  key: keyof T;
  header: string;
  width?: string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  pageSize: initialPageSize = 10,
  className = "",
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.ceil(data.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentData = data.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Table Container with Scroll Area */}
      <div className="flex-1 border border-border/50 rounded-lg overflow-hidden bg-card">
        <ScrollArea className="h-full">
          <div className="min-w-full">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/30 backdrop-blur-sm">
                <TableRow className="hover:bg-transparent border-border/50">
                  {columns.map((column) => (
                    <TableHead
                      key={String(column.key)}
                      className="h-12 px-4 text-left font-medium text-muted-foreground"
                      style={{ width: column.width, minWidth: column.width }}
                    >
                      {column.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.map((row, index) => (
                  <TableRow
                    key={index}
                    className="border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={String(column.key)}
                        className="px-4 py-3 text-sm"
                        style={{ minWidth: column.width }}
                      >
                        {column.render
                          ? column.render(row[column.key], row)
                          : String(row[column.key] || "-")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </div>

      {/* Sticky Footer with Pagination */}
      <div className="flex-shrink-0 bg-background border-t border-border/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium text-muted-foreground">Rows per page</p>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex w-[100px] items-center justify-center text-sm font-medium text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground mt-2">
          Showing {startIndex + 1} to {Math.min(endIndex, data.length)} of {data.length} entries
        </div>
      </div>
    </div>
  );
}