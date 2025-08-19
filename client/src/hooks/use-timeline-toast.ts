import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { AwesomeImportToast } from '@/components/ui/awesome-import-toast';
import React from 'react';

export interface ImportProgress {
  recordsFound: number;
  created: number;
  updated: number;
  failed: number;
  currentStep: 'scanning' | 'processing' | 'complete';
  progress: number; // 0-100 percentage
}

export interface UseTimelineToastReturn {
  showImportProgress: () => string;
  updateProgress: (toastId: string, progress: ImportProgress) => void;
  completeImport: (toastId: string, finalStats: ImportProgress) => void;
}

export function useTimelineToast(): UseTimelineToastReturn {
  const [currentProgress, setCurrentProgress] = useState<ImportProgress | null>(null);
  const activeToastRef = useRef<{ dismiss?: () => void; update?: (props: any) => void } | null>(null);
  const toastIdRef = useRef<string | null>(null);

  // Create a single persistent toast that updates smoothly with cache-busting
  const createOrUpdateToast = useCallback((progress: ImportProgress, isComplete: boolean = false, forceNew: boolean = false) => {
    // Add timestamp to force re-render and avoid caching issues
    const timestamp = Date.now();
    
    // Close function to dismiss the toast
    const handleClose = () => {
      if (activeToastRef.current?.dismiss) {
        activeToastRef.current.dismiss();
        activeToastRef.current = null;
        toastIdRef.current = null;
        setCurrentProgress(null);
      }
    };
    
    const toastProps = {
      title: '', // No title needed
      description: React.createElement(AwesomeImportToast, {
        progress: progress.progress,
        recordsFound: progress.recordsFound,
        created: progress.created,
        updated: progress.updated,
        failed: progress.failed,
        isComplete,
        onClose: handleClose,
        key: `toast-${timestamp}` // Force re-render with unique key
      }),
      duration: isComplete ? 30000 : Infinity, // 30s for complete, infinite for progress
      className: "border-0 bg-transparent shadow-none p-0", // Remove default toast styling
    };

    // Only create new toast if forced or no active toast exists
    if (forceNew || !activeToastRef.current) {
      // Dismiss previous toast if it exists
      if (activeToastRef.current?.dismiss) {
        activeToastRef.current.dismiss();
        activeToastRef.current = null;
      }
      
      // Create fresh toast
      const toastResult = toast(toastProps);
      activeToastRef.current = toastResult;
    } else if (activeToastRef.current?.update) {
      // Update existing toast if possible
      activeToastRef.current.update(toastProps);
    } else {
      // Fallback: dismiss and create new if update not available
      if (activeToastRef.current?.dismiss) {
        activeToastRef.current.dismiss();
      }
      const toastResult = toast(toastProps);
      activeToastRef.current = toastResult;
    }
  }, []);

  const showImportProgress = useCallback((): string => {
    // Clear any existing toast state to prevent caching issues
    if (activeToastRef.current?.dismiss) {
      activeToastRef.current.dismiss();
      activeToastRef.current = null;
    }
    
    // Reset all state
    setCurrentProgress(null);
    toastIdRef.current = null;
    
    // Create fresh toast ID with timestamp for uniqueness
    const toastId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    toastIdRef.current = toastId;
    
    const initialProgress: ImportProgress = {
      recordsFound: 0,
      created: 0,
      updated: 0,
      failed: 0,
      currentStep: 'scanning',
      progress: 0
    };
    
    setCurrentProgress(initialProgress);
    createOrUpdateToast(initialProgress, false, true); // Force new toast on initial show
    
    return toastId;
  }, [createOrUpdateToast]);

  const updateProgress = useCallback((toastId: string, progress: ImportProgress) => {
    // Only update if this is the current toast
    if (toastIdRef.current === toastId) {
      setCurrentProgress(progress);
      createOrUpdateToast(progress, false, false); // Update existing toast, don't create new
    }
  }, [createOrUpdateToast]);

  const completeImport = useCallback((toastId: string, finalStats: ImportProgress) => {
    // Only complete if this is the current toast
    if (toastIdRef.current === toastId) {
      const completedStats = { ...finalStats, currentStep: 'complete' as const, progress: 100 };
      setCurrentProgress(completedStats);
      createOrUpdateToast(completedStats, true, false); // Update existing toast for completion
      
      // Clear references after completion
      setTimeout(() => {
        toastIdRef.current = null;
        activeToastRef.current = null;
        setCurrentProgress(null);
      }, 30000);
    }
  }, [createOrUpdateToast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeToastRef.current?.dismiss) {
        activeToastRef.current.dismiss();
      }
    };
  }, []);

  return {
    showImportProgress,
    updateProgress,
    completeImport,
  };
}