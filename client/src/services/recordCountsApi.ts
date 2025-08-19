// API service for fetching record counts from all collections
export interface RecordCounts {
  callLogs: number;
  incoming: number;
  outgoing: number;
  areaCodes: number;
  users: number;
}

export interface RecordCountsResponse {
  success: boolean;
  data?: RecordCounts;
  error?: string;
}

class RecordCountsApiService {
  private baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://3-cx-analytics-back-blush.vercel.app/api' 
    : 'http://localhost:3001/api';

  async fetchRecordCounts(): Promise<RecordCountsResponse> {
    try {
      console.log('[RECORD-COUNTS-API] Fetching record counts...');

      // Try the combined endpoint first (will work after deployment)
      const url = `${this.baseUrl}/record-counts?_t=${Date.now()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[RECORD-COUNTS-API] Combined endpoint response:', result);
        return result;
      } else {
        console.log('[RECORD-COUNTS-API] Combined endpoint not available, using fallback');
        throw new Error(`Combined endpoint not available: ${response.status}`);
      }
    } catch (error) {
      console.log('[RECORD-COUNTS-API] Using individual endpoint fallback...');
      
      // Fallback: fetch counts individually using existing endpoints
      try {
        const counts = await this.fetchCountsIndividually();
        return {
          success: true,
          data: counts
        };
      } catch (fallbackError) {
        console.error('[RECORD-COUNTS-API] All methods failed:', fallbackError);
        return {
          success: false,
          error: 'Failed to fetch record counts from all sources',
          data: {
            callLogs: 0,
            incoming: 0,
            outgoing: 0,
            areaCodes: 0,
            users: 0
          }
        };
      }
    }
  }

  private async fetchCountsIndividually(): Promise<RecordCounts> {
    console.log('[RECORD-COUNTS-API] Fetching counts individually...');

    // Use the existing working endpoints that we know are deployed
    const [callLogsResponse, incomingResponse, outgoingResponse, areaCodesResponse, usersResponse] = await Promise.allSettled([
      this.fetchCollectionCount('call-logs'),
      this.fetchCollectionCount('inbound-calls'),
      this.fetchCollectionCount('outgoing-calls'),
      this.fetchCollectionCount('area-codes'),
      this.fetchCollectionCount('users')
    ]);

    const counts = {
      callLogs: callLogsResponse.status === 'fulfilled' ? callLogsResponse.value : 0,
      incoming: incomingResponse.status === 'fulfilled' ? incomingResponse.value : 0,
      outgoing: outgoingResponse.status === 'fulfilled' ? outgoingResponse.value : 0,
      areaCodes: areaCodesResponse.status === 'fulfilled' ? areaCodesResponse.value : 0,
      users: usersResponse.status === 'fulfilled' ? usersResponse.value : 0
    };

    console.log('[RECORD-COUNTS-API] Individual counts fetched:', counts);
    return counts;
  }

  private async fetchCollectionCount(collection: string): Promise<number> {
    try {
      // Add a small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const url = `${this.baseUrl}/${collection}?page=1&pageSize=1&_t=${Date.now()}`;
      console.log(`[RECORD-COUNTS-API] Fetching count for ${collection} from:`, url);
      
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
        console.error(`[RECORD-COUNTS-API] HTTP error for ${collection}:`, response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const count = result.total || 0;
      console.log(`[RECORD-COUNTS-API] Count for ${collection}:`, count);
      return count;
    } catch (error) {
      console.error(`[RECORD-COUNTS-API] Error fetching count for ${collection}:`, error);
      return 0;
    }
  }
}

// Export singleton instance
const recordCountsApiService = new RecordCountsApiService();
export default recordCountsApiService;