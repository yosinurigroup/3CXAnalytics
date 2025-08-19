// API service for combined call logs data (incoming + outgoing)
export interface CombinedCallLog {
  _id: string;
  CompanyCode: string;
  AreaCode: string;
  CallTime: string;
  CallerID: string;
  Trunk: string;
  TrunkNumber: string;
  Status: string;
  Ringing: string;
  Talking: string;
  TotalDuration: string;
  CallType: 'Incoming' | 'Outgoing';
  Cost: string;
  Sentiment: string;
  Summary: string;
  Transcription: string;
  // Metadata
  source: 'incoming' | 'outgoing';
  originalId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FetchCombinedCallLogsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  startDate?: string;
  endDate?: string;
  [key: string]: any; // For additional filters
}

export interface CombinedCallLogsResponse {
  success: boolean;
  data: CombinedCallLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  incomingCount: number;
  outgoingCount: number;
  error?: string;
}

class CombinedCallLogsApiService {
  private baseUrl = process.env.NODE_ENV === 'production' ? 'https://3-cx-analytics-back-blush.vercel.app/api/call-logs' : 'http://localhost:3001/api/call-logs';

  async fetchCombinedCallLogs(params: FetchCombinedCallLogsParams = {}): Promise<CombinedCallLogsResponse> {
    try {
      // Add timestamp to prevent caching
      const urlParams = new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(params).map(([key, value]) => [key, String(value)])
        ),
        _t: Date.now().toString()
      });

      const url = `${this.baseUrl}?${urlParams}`;
      console.log('[COMBINED-API] Fetching from:', url);

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
      console.log('[COMBINED-API] Response:', result);

      return result;
    } catch (error) {
      console.error('[COMBINED-API] Fetch error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: [],
        total: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
        incomingCount: 0,
        outgoingCount: 0
      };
    }
  }

  async getFilterOptions(field: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/filters/${field}`, {
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
      return result.success ? result.options : [];
    } catch (error) {
      console.error(`[COMBINED-API] Filter options error for ${field}:`, error);
      return [];
    }
  }

  // Export combined call logs to CSV
  async exportToCsv(params: FetchCombinedCallLogsParams = {}): Promise<Blob | null> {
    try {
      // Get all records for export (no pagination)
      const exportParams = {
        ...params,
        page: 1,
        pageSize: 50000 // Large number to get all records
      };

      const response = await this.fetchCombinedCallLogs(exportParams);
      
      if (!response.success || !response.data.length) {
        throw new Error('No data to export');
      }

      // Create CSV content
      const headers = [
        'Company Code',
        'Area Code',
        'Call Time',
        'Caller ID',
        'Trunk',
        'Trunk Number',
        'Status',
        'Ringing',
        'Talking',
        'Total Duration',
        'Call Type',
        'Cost',
        'Sentiment',
        'Summary',
        'Transcription'
      ];

      const csvContent = [
        headers.join(','),
        ...response.data.map(record => [
          record.CompanyCode || '',
          record.AreaCode || '',
          record.CallTime || '',
          record.CallerID || '',
          record.Trunk || '',
          record.TrunkNumber || '',
          record.Status || '',
          record.Ringing || '',
          record.Talking || '',
          record.TotalDuration || '',
          record.CallType || '',
          record.Cost || '',
          record.Sentiment || '',
          `"${(record.Summary || '').replace(/"/g, '""')}"`, // Escape quotes in summary
          `"${(record.Transcription || '').replace(/"/g, '""')}"` // Escape quotes in transcription
        ].join(','))
      ].join('\n');

      return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    } catch (error) {
      console.error('[COMBINED-API] Export error:', error);
      return null;
    }
  }
}

// Export singleton instance
const combinedCallLogsApiService = new CombinedCallLogsApiService();
export default combinedCallLogsApiService;