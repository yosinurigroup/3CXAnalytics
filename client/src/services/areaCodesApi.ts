// API service for area codes data
export interface AreaCode {
  AreaCode: string;
  State: string;
}

export interface FetchAreaCodesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  [key: string]: any; // For additional filters
}

export interface AreaCodesResponse {
  success: boolean;
  data: AreaCode[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
}

class AreaCodesApiService {
  private baseUrl = process.env.NODE_ENV === 'production' ? 'https://3-cx-analytics-back-blush.vercel.app/api/area-codes' : 'http://localhost:3001/api/area-codes';

  async fetchAreaCodes(params: FetchAreaCodesParams = {}): Promise<AreaCodesResponse> {
    try {
      // Add timestamp to prevent caching
      const urlParams = new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(params).map(([key, value]) => [key, String(value)])
        ),
        _t: Date.now().toString()
      });

      const url = `${this.baseUrl}?${urlParams}`;
      console.log('[AREACODES-API] Fetching from:', url);

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
      console.log('[AREACODES-API] Response:', result);

      return result;
    } catch (error) {
      console.error('[AREACODES-API] Fetch error:', error);
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

  async importAreaCodes(file: File): Promise<ReadableStream<Uint8Array> | null> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('enableStreaming', 'true');

      console.log('[AREACODES-API] Starting import with streaming...');

      const response = await fetch(`${this.baseUrl}/import-optimized`, {
        method: 'POST',
        headers: {
          'Accept': 'application/x-ndjson',
          'Cache-Control': 'no-cache',
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.body;
    } catch (error) {
      console.error('[AREACODES-API] Import error:', error);
      return null;
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
      console.error('[AREACODES-API] Clear data error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
const areaCodesApiService = new AreaCodesApiService();
export default areaCodesApiService;