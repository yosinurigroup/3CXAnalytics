import { CallLogsTable, CallLogEntry } from "@/components/CallLogsTable";

// Mock data for demonstration
const mockIncomingCallLogs: CallLogEntry[] = [
  {
    id: "1",
    callTime: "2024-01-15T10:30:00Z",
    callerId: "+1-555-0123",
    destination: "101",
    trunk: "SIP-TRUNK-01",
    trunkNumber: "1001",
    did: "+1-555-0100",
    status: "completed",
    ringing: "00:05",
    talking: "05:32",
    totalDuration: "05:37",
    callType: "inbound",
    sentiment: "positive",
    summary: "Customer inquiring about product availability and pricing",
    transcription: "Hello, I'm calling to ask about your product availability and current pricing..."
  },
  {
    id: "2", 
    callTime: "2024-01-15T10:25:00Z",
    callerId: "+1-555-0456",
    destination: "102",
    trunk: "SIP-TRUNK-02",
    trunkNumber: "1002",
    did: "+1-555-0100",
    status: "missed",
    ringing: "00:30",
    talking: "00:00",
    totalDuration: "00:30",
    callType: "inbound",
    sentiment: "neutral",
    summary: "No answer - missed call",
    transcription: ""
  },
  {
    id: "3",
    callTime: "2024-01-15T10:20:00Z", 
    callerId: "+1-555-0789",
    destination: "103",
    trunk: "SIP-TRUNK-01",
    trunkNumber: "1001",
    did: "+1-555-0100",
    status: "completed",
    ringing: "00:03",
    talking: "12:45",
    totalDuration: "12:48",
    callType: "inbound",
    sentiment: "negative",
    summary: "Customer complaint about service quality and billing issues",
    transcription: "I'm very frustrated with the service quality and there are errors in my billing..."
  },
  {
    id: "4",
    callTime: "2024-01-15T10:15:00Z",
    callerId: "+1-555-0321",
    destination: "101",
    trunk: "SIP-TRUNK-03",
    trunkNumber: "1003", 
    did: "+1-555-0100",
    status: "busy",
    ringing: "00:02",
    talking: "00:00",
    totalDuration: "00:02",
    callType: "inbound",
    sentiment: "neutral",
    summary: "Line busy",
    transcription: ""
  },
  {
    id: "5",
    callTime: "2024-01-15T10:10:00Z",
    callerId: "+1-555-0654",
    destination: "104",
    trunk: "SIP-TRUNK-02",
    trunkNumber: "1002",
    did: "+1-555-0100", 
    status: "completed",
    ringing: "00:08",
    talking: "03:22",
    totalDuration: "03:30",
    callType: "inbound",
    sentiment: "positive",
    summary: "Technical support request resolved successfully",
    transcription: "Hi, I need help setting up my account and understanding the features..."
  }
];

export default function CallLogsIncoming() {
  return (
    <div className="h-full p-6">
      <CallLogsTable data={mockIncomingCallLogs} />
    </div>
  );
}