// API service for outgoing calls data
export interface OutgoingCall {
  CallTime: string;
  CallerID: string;
  CallerDisplayName: string;
  Trunk: string;
  TrunkNumber: string;
  Status: string;
  Ringing: string;
  Talking: string;
  TotalDuration: string;
  Destination: string;
  CallType: string;
  Cost: string;
  Sentiment: string;
  Summary: string;
  Transcription: string;
}

export interface FetchOutgoingCallsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  startDate?: string;
  endDate?: string;
  [key: string]: any; // For additional filters
}

export interface OutgoingCallsResponse {
  success: boolean;
  data: OutgoingCall[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
}

class OutgoingCallsApiService {
  private baseUrl = process.env.NODE_ENV === 'production' ? 'https://3-cx-analytics-back-blush.vercel.app/api/outgoing-calls' : 'http://localhost:3001/api/outgoing-calls';

  async fetchOutgoingCalls(params: FetchOutgoingCallsParams = {}): Promise<OutgoingCallsResponse> {
    try {
      // Add timestamp to prevent caching
      const urlParams = new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(params).map(([key, value]) => [key, String(value)])
        ),
        _t: Date.now().toString()
      });

      const url = `${this.baseUrl}?${urlParams}`;
      console.log('[OUTGOING-API] Fetching from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[OUTGOING-API] Response:', result);

      return result;
    } catch (error) {
      console.error('[OUTGOING-API] Fetch error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: [],
        total: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0
      };
    }
  }

  async clearAllData(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/clear-all`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirm: 'DELETE_ALL_DATA' })
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('[OUTGOING-API] Clear data error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
const outgoingCallsApiService = new OutgoingCallsApiService();
export default outgoingCallsApiService;