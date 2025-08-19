import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "./DataTable";

export interface CallLogEntry {
  id: string;
  callTime: string;
  callerId: string;
  destination: string;
  trunk: string;
  trunkNumber: string;
  did: string;
  status: "completed" | "missed" | "busy" | "failed";
  ringing: string;
  talking: string;
  totalDuration: string;
  callType: "inbound" | "outbound" | "internal";
  sentiment: "positive" | "neutral" | "negative";
  summary: string;
  transcription: string;
}

const statusColors = {
  completed: "bg-success/10 text-success border-success/20",
  missed: "bg-destructive/10 text-destructive border-destructive/20", 
  busy: "bg-warning/10 text-warning border-warning/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
};

const sentimentColors = {
  positive: "bg-success/10 text-success border-success/20",
  neutral: "bg-muted text-muted-foreground border-border",
  negative: "bg-destructive/10 text-destructive border-destructive/20",
};

const callTypeColors = {
  inbound: "bg-primary/10 text-primary border-primary/20",
  outbound: "bg-secondary/10 text-secondary-foreground border-secondary/20",
  internal: "bg-accent/10 text-accent-foreground border-accent/20",
};

export function CallLogsTable({ data }: { data: CallLogEntry[] }) {
  const columns: Column<CallLogEntry>[] = [
    {
      key: "callTime",
      header: "Call Time",
      width: "140px",
      render: (value) => (
        <div className="font-mono text-sm">
          {new Date(value).toLocaleString()}
        </div>
      ),
    },
    {
      key: "callerId",
      header: "Caller ID",
      width: "120px",
      render: (value) => (
        <div className="font-medium text-foreground">{value}</div>
      ),
    },
    {
      key: "destination",
      header: "Destination", 
      width: "120px",
    },
    {
      key: "trunk",
      header: "Trunk",
      width: "100px",
    },
    {
      key: "trunkNumber",
      header: "Trunk Number",
      width: "110px",
    },
    {
      key: "did",
      header: "DID",
      width: "100px",
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (value) => (
        <Badge variant="outline" className={statusColors[value as keyof typeof statusColors]}>
          {value}
        </Badge>
      ),
    },
    {
      key: "ringing",
      header: "Ringing",
      width: "80px",
      render: (value) => (
        <div className="font-mono text-sm text-muted-foreground">{value}</div>
      ),
    },
    {
      key: "talking", 
      header: "Talking",
      width: "80px",
      render: (value) => (
        <div className="font-mono text-sm text-muted-foreground">{value}</div>
      ),
    },
    {
      key: "totalDuration",
      header: "Total Duration",
      width: "110px",
      render: (value) => (
        <div className="font-mono text-sm font-medium">{value}</div>
      ),
    },
    {
      key: "callType",
      header: "Call Type",
      width: "100px",
      render: (value) => (
        <Badge variant="outline" className={callTypeColors[value as keyof typeof callTypeColors]}>
          {value}
        </Badge>
      ),
    },
    {
      key: "sentiment",
      header: "Sentiment",
      width: "100px",
      render: (value) => (
        <Badge variant="outline" className={sentimentColors[value as keyof typeof sentimentColors]}>
          {value}
        </Badge>
      ),
    },
    {
      key: "summary",
      header: "Summary",
      width: "200px",
      render: (value) => (
        <div className="max-w-[180px] truncate text-sm text-muted-foreground" title={value}>
          {value}
        </div>
      ),
    },
    {
      key: "transcription",
      header: "Transcription",
      width: "250px",
      render: (value) => (
        <div className="max-w-[230px] truncate text-sm text-muted-foreground" title={value}>
          {value}
        </div>
      ),
    },
  ];

  return <DataTable data={data} columns={columns} pageSize={20} />;
}