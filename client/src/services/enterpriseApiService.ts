import { InboundCall } from './api';

// Performance metrics interface
export interface PerformanceMetrics {
  queryTime: number;
  cacheHit: boolean;
  approximateCount: boolean;
  serverTime: number;
  requestId?: string;
  timestamp: number;
  cacheHitRatio?: number;
  cacheHits?: number;
  queryCount?: number;
  avgQueryTime?: number;
  errorCount?: number;
}

// Table statistics interface
export interface TableStatistics {
  totalRecords: number;
  todayRecords: number;
  avgCallDuration: number;
  topCallers: Array<{ caller: string; count: number }>;
  callsByHour: Array<{ hour: number; count: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
  // Additional properties for compatibility
  totalRows: number;
  uniqueCallers: number;
  avgDuration: number;
}

// Enhanced API response interface with performance data
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  nextCursor?: string;
  queryTime?: number;
  fromCache?: boolean;
  approximateCount?: boolean;
  performance?: PerformanceMetrics;
}

// Cache configuration
interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of cached items
  enabled: boolean;
}

// Request configuration
interface RequestConfig {
  timeout: number;
  retries: number;
  retryDelay: number;
  enableCache: boolean;
}

// Client-side cache implementation
class ClientCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  set(key: string, data: any, customTtl?: number): void {
    if (!this.config.enabled) return;

    const ttl = customTtl || this.config.ttl;
    const timestamp = Date.now();

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, { data, timestamp, ttl });
  }

  get(key: string): any | null {
    if (!this.config.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      enabled: this.config.enabled
    };
  }
}

// Request queue for offline support
interface QueuedRequest {
  id: string;
  url: string;
  options: RequestInit;
  timestamp: number;
  retries: number;
}

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private isOnline = navigator.onLine;

  constructor() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  add(request: QueuedRequest): void {
    this.queue.push(request);
    if (this.isOnline) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.isOnline) {
      const request = this.queue.shift()!;
      try {
        await fetch(request.url, request.options);
      } catch (error) {
        if (request.retries < 3) {
          request.retries++;
          this.queue.unshift(request);
        }
      }
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}

// Enterprise API Service Class
class EnterpriseApiService {
  private cache: ClientCache;
  private requestQueue: RequestQueue;
  private config: RequestConfig;
  private pendingRequests = new Map<string, Promise<any>>();
  private performanceMetrics: PerformanceMetrics[] = [];

  constructor() {
    this.cache = new ClientCache({
      ttl: 5 * 60 * 1000, // 5 minutes
      maxSize: 100,
      enabled: true
    });

    this.requestQueue = new RequestQueue();

    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      enableCache: true
    };
  }

  // Generate cache key for requests
  private generateCacheKey(url: string, params?: any): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${url}:${paramString}`;
  }

  // Execute request with retry logic
  private async executeWithRetry<T>(
    url: string,
    options: RequestInit = {},
    retries = this.config.retries
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Record performance metrics
      const metrics: PerformanceMetrics = {
        queryTime: Date.now() - startTime,
        cacheHit: false,
        approximateCount: data.approximateCount || false,
        serverTime: data.queryTime || 0,
        requestId: data.requestId,
        timestamp: Date.now()
      };

      this.performanceMetrics.push(metrics);
      
      // Keep only last 100 metrics
      if (this.performanceMetrics.length > 100) {
        this.performanceMetrics = this.performanceMetrics.slice(-100);
      }

      return data;
    } catch (error) {
      if (retries > 0 && navigator.onLine) {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        return this.executeWithRetry(url, options, retries - 1);
      }

      // Queue request for later if offline
      if (!navigator.onLine) {
        this.requestQueue.add({
          id: Math.random().toString(36),
          url,
          options,
          timestamp: Date.now(),
          retries: 0
        });
      }

      throw error;
    }
  }

  // Deduplicate concurrent requests
  private async deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  // Get inbound calls with enterprise features (alias for fetchInboundCalls)
  async fetchInboundCalls(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    cursor?: string;
    useApproximateCount?: boolean;
  } = {}): Promise<ApiResponse<InboundCall[]>> {
    return this.getInboundCalls(params);
  }

  // Get inbound calls with enterprise features
  async getInboundCalls(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    cursor?: string;
    useApproximateCount?: boolean;
  } = {}): Promise<ApiResponse<InboundCall[]>> {
    const cacheKey = this.generateCacheKey('/api/inbound-calls/enterprise', params);
    
    // Check cache first
    if (this.config.enableCache) {
      const cachedData = this.cache.get(cacheKey);
      if (cachedData) {
        return {
          ...cachedData,
          performance: {
            ...cachedData.performance,
            cacheHit: true
          }
        };
      }
    }

    // Deduplicate concurrent requests
    return this.deduplicateRequest(cacheKey, async () => {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const baseUrl = process.env.NODE_ENV === 'production' ? 'https://3-cx-analytics-back-blush.vercel.app' : 'http://localhost:3001';
      const url = `${baseUrl}/api/inbound-calls/enterprise?${queryParams.toString()}`;
      const response = await this.executeWithRetry<ApiResponse<InboundCall[]>>(url);

      // Cache successful responses
      if (this.config.enableCache && response.success) {
        const ttl = this.calculateCacheTtl(params);
        this.cache.set(cacheKey, response, ttl);
      }

      return response;
    });
  }

  // Calculate dynamic cache TTL based on query characteristics
  private calculateCacheTtl(params: any): number {
    const baseTtl = 5 * 60 * 1000; // 5 minutes
    
    // Shorter TTL for searches and filters
    if (params.search || params.sortBy) {
      return baseTtl / 2;
    }

    // Longer TTL for simple pagination
    if (params.page && !params.search) {
      return baseTtl * 2;
    }

    return baseTtl;
  }

  // Get performance metrics
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const baseUrl = process.env.NODE_ENV === 'production' ? 'https://3-cx-analytics-back-blush.vercel.app' : 'http://localhost:3001';
      const response = await this.executeWithRetry<ApiResponse<any>>(`${baseUrl}/api/inbound-calls/metrics`);
      
      if (response.success && response.data) {
        return {
          queryTime: response.data.queryTime || 0,
          cacheHit: response.data.cacheHit || false,
          approximateCount: response.data.approximateCount || false,
          serverTime: response.data.serverTime || 0,
          requestId: response.data.requestId,
          timestamp: Date.now(),
          cacheHitRatio: response.data.cacheHitRatio || 0,
          cacheHits: response.data.cacheHits || 0,
          queryCount: response.data.queryCount || 0,
          avgQueryTime: response.data.avgQueryTime || 0,
          errorCount: response.data.errorCount || 0
        };
      }
      
      // Return default metrics if no data
      return {
        queryTime: 0,
        cacheHit: false,
        approximateCount: false,
        serverTime: 0,
        timestamp: Date.now(),
        cacheHitRatio: 0,
        cacheHits: 0,
        queryCount: 0,
        avgQueryTime: 0,
        errorCount: 0
      };
    } catch (error) {
      console.error('[ENTERPRISE-API] Failed to get performance metrics:', error);
      return {
        queryTime: 0,
        cacheHit: false,
        approximateCount: false,
        serverTime: 0,
        timestamp: Date.now(),
        cacheHitRatio: 0,
        cacheHits: 0,
        queryCount: 0,
        avgQueryTime: 0,
        errorCount: 0
      };
    }
  }

  // Get table statistics (alias for getStatistics)
  async getTableStatistics(): Promise<TableStatistics> {
    return this.getStatistics();
  }

  // Get statistics
  async getStatistics(): Promise<TableStatistics> {
    const cacheKey = 'statistics';
    
    if (this.config.enableCache) {
      const cachedData = this.cache.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }

    try {
      const baseUrl = process.env.NODE_ENV === 'production' ? 'https://3-cx-analytics-back-blush.vercel.app' : 'http://localhost:3001';
      const response = await this.executeWithRetry<ApiResponse<any>>(`${baseUrl}/api/inbound-calls/statistics`);
      
      const defaultStats: TableStatistics = {
        totalRecords: 0,
        todayRecords: 0,
        avgCallDuration: 0,
        topCallers: [],
        callsByHour: [],
        statusDistribution: [],
        totalRows: 0,
        uniqueCallers: 0,
        avgDuration: 0
      };

      if (response.success && response.data) {
        const stats: TableStatistics = {
          totalRecords: response.data.totalRecords || 0,
          todayRecords: response.data.todayRecords || 0,
          avgCallDuration: response.data.avgCallDuration || 0,
          topCallers: response.data.topCallers || [],
          callsByHour: response.data.callsByHour || [],
          statusDistribution: response.data.statusDistribution || [],
          totalRows: response.data.totalRecords || response.data.totalRows || 0,
          uniqueCallers: response.data.uniqueCallers || 0,
          avgDuration: response.data.avgCallDuration || response.data.avgDuration || 0
        };

        if (this.config.enableCache) {
          this.cache.set(cacheKey, stats, 2 * 60 * 1000); // 2 minutes TTL
        }

        return stats;
      }

      return defaultStats;
    } catch (error) {
      console.error('[ENTERPRISE-API] Failed to get statistics:', error);
      return {
        totalRecords: 0,
        todayRecords: 0,
        avgCallDuration: 0,
        topCallers: [],
        callsByHour: [],
        statusDistribution: [],
        totalRows: 0,
        uniqueCallers: 0,
        avgDuration: 0
      };
    }
  }

  // Export data
  async exportData(format: 'csv' | 'json' | 'excel', filters?: any): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.append('format', format);
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const baseUrl = process.env.NODE_ENV === 'production' ? 'https://3-cx-analytics-back-blush.vercel.app' : 'http://localhost:3001';
    const url = `${baseUrl}/api/inbound-calls/export?${queryParams.toString()}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      
      return await response.blob();
    } catch (error) {
      console.error('[ENTERPRISE-API] Export failed:', error);
      throw error;
    }
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
    console.log('[ENTERPRISE-API] Cache cleared');
  }

  // Get cache statistics
  getCacheStats() {
    return {
      cache: this.cache.getStats(),
      queue: {
        size: this.requestQueue.getQueueSize()
      },
      performance: {
        totalRequests: this.performanceMetrics.length,
        averageResponseTime: this.performanceMetrics.length > 0 
          ? this.performanceMetrics.reduce((sum, m) => sum + m.queryTime, 0) / this.performanceMetrics.length
          : 0,
        cacheHitRate: this.performanceMetrics.length > 0
          ? this.performanceMetrics.filter(m => m.cacheHit).length / this.performanceMetrics.length
          : 0
      }
    };
  }

  // Initialize real-time updates (WebSocket support)
  initializeRealTimeUpdates(onUpdate: (data: any) => void): () => void {
    // This would connect to a WebSocket endpoint for real-time updates
    console.log('[ENTERPRISE-API] Real-time updates initialized');
    
    // Return cleanup function
    return () => {
      console.log('[ENTERPRISE-API] Real-time updates disconnected');
    };
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: number; metrics: any }> {
    try {
      const baseUrl = process.env.NODE_ENV === 'production' ? 'https://3-cx-analytics-back-blush.vercel.app' : 'http://localhost:3001';
      const response = await this.executeWithRetry<any>(`${baseUrl}/api/inbound-calls/health`);
      return {
        status: 'healthy',
        timestamp: Date.now(),
        metrics: this.getCacheStats()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        metrics: this.getCacheStats()
      };
    }
  }
}

// Export singleton instance
export const enterpriseApiService = new EnterpriseApiService();
export default enterpriseApiService;

// Re-export InboundCall for convenience using export type
export type { InboundCall };