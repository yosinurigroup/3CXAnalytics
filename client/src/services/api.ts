const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : 'http://localhost:3001/api';

export interface InboundCall {
  CallTime: string;
  CallerID: string;
  Destination: string;
  Trunk: string;
  TrunkNumber: string;
  DID: string;
  Status: string;
  Ringing: string;
  Talking: string;
  TotalDuration: string;
  CallType: string;
  Sentiment: string;
  Summary: string;
  Transcription: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export interface QueryParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  search?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}

class ApiService {
  // NO CACHING - All cache-related code removed for real-time data consistency
  // Every request goes directly to the server for fresh data

  async fetchInboundCalls(params: QueryParams = {}): Promise<ApiResponse<InboundCall[]>> {
    // ALWAYS fetch fresh data from the server
    console.log('[FRONTEND] Fetching real-time data from server with params:', params);

    try {
      const queryString = new URLSearchParams(
        Object.entries(params)
          .filter(([_, value]) => value !== undefined && value !== null)
          .map(([key, value]) => [key, String(value)])
      ).toString();

      // Always add timestamp to prevent ANY browser caching
      const url = `${API_BASE_URL}/inbound-calls${queryString ? `?${queryString}&_t=${Date.now()}` : `?_t=${Date.now()}`}`;
      console.log('[FRONTEND] Calling URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store', // Prevent browser caching
        credentials: 'same-origin'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // NO CACHING - Return fresh data directly
      console.log(`[FRONTEND] Received ${data.data?.length || 0} records from server (Total in database: ${data.total || 0})`);

      return data;
    } catch (error) {
      console.error('Error fetching inbound calls:', error);
      
      // NO MOCK DATA - Return empty result on error
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to fetch data from MongoDB',
        total: 0,
        page: params.page || 1,
        pageSize: params.pageSize || 50,
        totalPages: 0
      };
    }
  }

  async fetchFilterOptions(field: string, endpoint: 'inbound-calls' | 'outgoing-calls' | 'call-logs' = 'inbound-calls'): Promise<string[]> {
    // NO CACHING - Always fetch fresh filter options
    console.log(`[FRONTEND] Fetching real-time filter options for ${field} from ${endpoint}`);

    try {
      // Add timestamp to prevent browser caching
      const response = await fetch(`${API_BASE_URL}/${endpoint}/filters/${field}?_t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // NO CACHING - Return fresh options directly
      if (data.success) {
        return data.options;
      }
      
      return [];
    } catch (error) {
      console.error(`Error fetching filter options for ${field}:`, error);
      return [];
    }
  }

  // Import method for CSV data with real-time response
  async importInboundCalls(records: any[]): Promise<any> {
    console.log(`[FRONTEND] Importing ${records.length} records to server...`);
    
    const response = await fetch(`${API_BASE_URL}/inbound-calls/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache',
        'Pragma': 'no-cache',
      },
      cache: 'no-store',
      body: JSON.stringify({ records })
    });

    const data = await response.json();
    console.log('[FRONTEND] Import result:', data);
    return data;
  }

  // Clear all data method
  async clearAllData(): Promise<any> {
    console.log('[FRONTEND] Sending clear all data request...');
    
    const response = await fetch(`${API_BASE_URL}/inbound-calls/clear-all`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache',
        'Pragma': 'no-cache',
      },
      cache: 'no-store',
      body: JSON.stringify({ confirm: 'DELETE_ALL_DATA' })
    });

    const data = await response.json();
    console.log('[FRONTEND] Clear data result:', data);
    return data;
  }
}

export default new ApiService();