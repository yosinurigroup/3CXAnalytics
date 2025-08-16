import { PhoneOutgoing, Target, Timer, TrendingDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CallLogsOutgoing() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Outgoing Calls</h1>
          <p className="text-muted-foreground mt-1">
            Track outgoing call performance and success rates
          </p>
        </div>
      </div>

      {/* Outgoing Call Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outgoing</CardTitle>
            <PhoneOutgoing className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">32,156</div>
            <p className="text-xs text-muted-foreground">
              +12.4% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">73.8%</div>
            <p className="text-xs text-muted-foreground">
              +4.2% improvement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3:47</div>
            <p className="text-xs text-muted-foreground">
              -8s from average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Calls</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8,421</div>
            <p className="text-xs text-muted-foreground">
              -2.1% decrease
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Coming Soon */}
      <Card>
        <CardHeader>
          <CardTitle>Outgoing Call Analytics</CardTitle>
          <CardDescription>
            Performance optimization and call success analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-center">
          <div className="space-y-3">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <PhoneOutgoing className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-medium text-foreground">Performance Analytics Coming Soon</p>
              <p className="text-sm text-muted-foreground">
                Call success prediction, optimal timing analysis, and conversion tracking
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}