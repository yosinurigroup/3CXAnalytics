import { Phone, Download, Search, Filter, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function CallLogs() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">All Call Logs</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive call data analysis and management
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Advanced Filter
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filter</CardTitle>
          <CardDescription>
            Find specific call records from your BigQuery dataset
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone number, caller ID, or duration..."
                className="pl-10"
              />
            </div>
            <Button variant="outline">Search</Button>
          </div>
          
          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm text-muted-foreground">Quick filters:</span>
            <Badge variant="secondary">Last 24 hours</Badge>
            <Badge variant="secondary">Missed calls</Badge>
            <Badge variant="secondary">Long duration</Badge>
            <Badge variant="secondary">International</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Data Table Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Call Records</CardTitle>
          <CardDescription>
            High-performance data table with virtual scrolling (Coming Soon)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Table Header */}
          <div className="border border-table-border rounded-lg overflow-hidden">
            <div className="bg-table-header px-6 py-3 border-b border-table-border">
              <div className="grid grid-cols-6 gap-4 text-sm font-medium text-foreground">
                <div>Timestamp</div>
                <div>Caller ID</div>
                <div>Recipient</div>
                <div>Duration</div>
                <div>Type</div>
                <div>Actions</div>
              </div>
            </div>
            
            {/* Sample Rows */}
            {[1, 2, 3, 4, 5].map((row) => (
              <div
                key={row}
                className="px-6 py-4 border-b border-table-border hover:bg-table-hover transition-colors"
              >
                <div className="grid grid-cols-6 gap-4 text-sm">
                  <div className="text-foreground">2024-01-15 14:23:42</div>
                  <div className="text-foreground">+1 (555) 123-4567</div>
                  <div className="text-foreground">+1 (555) 987-6543</div>
                  <div className="text-foreground">00:03:45</div>
                  <div>
                    <Badge variant={row % 3 === 0 ? "destructive" : row % 2 === 0 ? "default" : "secondary"}>
                      {row % 3 === 0 ? "Missed" : row % 2 === 0 ? "Outgoing" : "Incoming"}
                    </Badge>
                  </div>
                  <div>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Coming Soon Overlay */}
          <div className="mt-6 text-center p-8 bg-muted/30 rounded-lg border border-dashed border-border">
            <div className="space-y-3">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Phone className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">BigQuery Integration Coming Soon</p>
                <p className="text-sm text-muted-foreground">
                  High-performance virtual scrolling for 100M+ records, real-time filtering, and advanced analytics
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}