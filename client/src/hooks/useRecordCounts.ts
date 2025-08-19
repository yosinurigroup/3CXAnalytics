import { useState, useEffect, useCallback } from 'react';
import recordCountsApiService, { RecordCounts } from '@/services/recordCountsApi';

interface UseRecordCountsReturn {
  counts: RecordCounts;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRecordCounts(refreshInterval?: number): UseRecordCountsReturn {
  const [counts, setCounts] = useState<RecordCounts>({
    callLogs: 0,
    incoming: 0,
    outgoing: 0,
    areaCodes: 0,
    users: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await recordCountsApiService.fetchRecordCounts();
      
      if (response.success && response.data) {
        setCounts(response.data);
      } else {
        setError(response.error || 'Failed to fetch record counts');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Set up refresh interval if provided
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchCounts();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchCounts]);

  return {
    counts,
    loading,
    error,
    refetch
  };
}