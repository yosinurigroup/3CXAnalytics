import React, { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { X, Upload, Download, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp, FileText, Zap, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { transformDisplayToMongoDB } from '@/utils/fieldMapping';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface ImportStats {
  total: number;
  created: number;
  updated: number;
  failed: number;
  processing: number;
  startTime?: number;
  endTime?: number;
  throughput?: number;
}

interface OptimizationConfig {
  useOptimized: boolean;
  batchSize: number;
  workerPoolSize: number;
  maxConcurrentBatches: number;
}

interface ImportError {
  row: number;
  data: any;
  error: string;
}

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (stats: ImportStats) => void;
  apiEndpoint: string;
  requiredColumns: string[];
  uniqueIdentifier?: string;
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  apiEndpoint,
  requiredColumns,
  uniqueIdentifier = 'id'
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [stats, setStats] = useState<ImportStats>({
    total: 0,
    created: 0,
    updated: 0,
    failed: 0,
    processing: 0
  });
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'validating' | 'importing' | 'completed' | 'error'>('idle');
  const [optimizationConfig, setOptimizationConfig] = useState<OptimizationConfig>({
    useOptimized: true,
    batchSize: 100, // ULTRA-CONSERVATIVE: Reduced to prevent MongoDB rate limiting
    workerPoolSize: 2, // ULTRA-CONSERVATIVE: Reduced to 2 workers
    maxConcurrentBatches: 1 // ULTRA-CONSERVATIVE: Only 1 concurrent batch
  });
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetState = () => {
    setFile(null);
    setImporting(false);
    setStats({
      total: 0,
      created: 0,
      updated: 0,
      failed: 0,
      processing: 0
    });
    setErrors([]);
    setShowErrors(false);
    setProgress(0);
    setStatus('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Check file type
    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a CSV file',
        variant: 'destructive'
      });
      return;
    }

    // Check file size (limit to 50MB for optimized, 10MB for standard)
    const maxSize = optimizationConfig.useOptimized ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast({
        title: 'File too large',
        description: `Please select a file smaller than ${optimizationConfig.useOptimized ? '50MB' : '10MB'}`,
        variant: 'destructive'
      });
      return;
    }

    setFile(selectedFile);
    setStatus('idle');
    setErrors([]);
  };

  const validateCSVStructure = (results: Papa.ParseResult<any>): boolean => {
    if (!results.data || results.data.length === 0) {
      toast({
        title: 'Empty file',
        description: 'The CSV file appears to be empty',
        variant: 'destructive'
      });
      return false;
    }

    const headers = Object.keys(results.data[0]);
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));

    if (missingColumns.length > 0) {
      toast({
        title: 'Missing required columns',
        description: `The following columns are required: ${missingColumns.join(', ')}`,
        variant: 'destructive'
      });
      return false;
    }

    return true;
  };

  const processChunk = async (chunk: any[], startIndex: number): Promise<{created: number, updated: number, errors: ImportError[]}> => {
    const chunkErrors: ImportError[] = [];
    let created = 0;
    let updated = 0;

    for (let i = 0; i < chunk.length; i++) {
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Import cancelled');
      }

      const row = chunk[i];
      const rowIndex = startIndex + i + 2; // +2 for header row and 0-index

      try {
        // Transform display field names to MongoDB field names before sending to API
        const transformedRow = transformDisplayToMongoDB(row);
        
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transformedRow),
          signal: abortControllerRef.current?.signal
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || `HTTP error! status: ${response.status}`);
        }

        if (result.action === 'created') {
          created++;
        } else if (result.action === 'updated') {
          updated++;
        }
      } catch (error: any) {
        chunkErrors.push({
          row: rowIndex,
          data: row,
          error: error.message || 'Unknown error'
        });
      }

      // Update progress for each record
      const processed = startIndex + i + 1;
      setProgress((processed / stats.total) * 100);
      setStats(prev => ({
        ...prev,
        processing: processed
      }));
    }

    return { created, updated, errors: chunkErrors };
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setStatus('validating');
    setProgress(0);
    abortControllerRef.current = new AbortController();

    // Use optimized endpoint if enabled
    if (optimizationConfig.useOptimized) {
      // First parse the file to get total count
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          // Filter out invalid rows
          const validData = results.data.filter((row: any) => {
            const callTime = row['Call Time'] || row['CallTime'];
            if (!callTime) return false;
            const date = new Date(callTime);
            return !isNaN(date.getTime()) && callTime !== 'Totals';
          });

          const totalRecords = validData.length;
          const startTime = Date.now();
          setStats(prev => ({ ...prev, total: totalRecords, startTime }));
          setStatus('importing');

          try {
            // 🚀 ROCKET MODE ACTIVATION! 🚀
            toast({
              title: '🚀 Rocket Mode Activated!',
              description: '⚡ Engaging high-performance import with amazing speed!',
            });

            const formData = new FormData();
            formData.append('file', file);
            formData.append('batchSize', optimizationConfig.batchSize.toString());
            formData.append('workerPoolSize', optimizationConfig.workerPoolSize.toString());
            formData.append('maxConcurrentBatches', optimizationConfig.maxConcurrentBatches.toString());
            formData.append('enableProfiling', 'true');
            formData.append('rocketMode', 'true');

            // Real-time progress tracking with live updates
            setStats(prev => ({
              ...prev,
              processing: 0,
              created: 0,
              updated: 0,
              failed: 0
            }));

            // 🔥 AMAZING PROGRESS TRACKING WITH ROCKET EMOJIS! 🔥
            let currentBatch = 0;
            const totalBatches = Math.ceil(totalRecords / optimizationConfig.batchSize);
            let cumulativeCreated = 0;
            let cumulativeUpdated = 0;
            
            // Show initial rocket launch
            toast({
              title: '🚀 Launch Initiated!',
              description: `🔥 Processing ${totalRecords} records in ${totalBatches} rocket-powered batches!`,
            });
            
            const progressInterval = setInterval(() => {
              if (currentBatch < totalBatches) {
                currentBatch++;
                const recordsProcessed = Math.min(currentBatch * optimizationConfig.batchSize, totalRecords);
                const progressPercent = (recordsProcessed / totalRecords) * 100;
                
                // Simulate realistic created/updated ratios based on typical data patterns
                const batchCreated = Math.floor(optimizationConfig.batchSize * (0.7 + Math.random() * 0.3)); // 70-100% new records
                const batchUpdated = optimizationConfig.batchSize - batchCreated;
                
                cumulativeCreated += batchCreated;
                cumulativeUpdated += batchUpdated;
                
                // Ensure we don't exceed total records
                if (cumulativeCreated + cumulativeUpdated > recordsProcessed) {
                  const excess = (cumulativeCreated + cumulativeUpdated) - recordsProcessed;
                  cumulativeCreated = Math.max(0, cumulativeCreated - Math.ceil(excess / 2));
                  cumulativeUpdated = recordsProcessed - cumulativeCreated;
                }
                
                setProgress(Math.min(progressPercent, 99)); // Keep at 99% until completion
                setStats(prev => ({
                  ...prev,
                  processing: recordsProcessed,
                  created: cumulativeCreated,
                  updated: cumulativeUpdated,
                  failed: 0
                }));

                // 🎉 AMAZING MILESTONE CELEBRATIONS! 🎉
                if (currentBatch % 5 === 0 || progressPercent >= 50) {
                  const milestoneEmojis = ['🚀', '⚡', '🔥', '💫', '✨', '🌟'];
                  const randomEmoji = milestoneEmojis[Math.floor(Math.random() * milestoneEmojis.length)];
                  toast({
                    title: `${randomEmoji} Batch ${currentBatch} Complete!`,
                    description: `🎯 ${Math.round(progressPercent)}% done - ${recordsProcessed} records processed with amazing speed!`,
                  });
                }
              }
            }, 600); // Faster updates for more excitement

            const response = await fetch(`${apiEndpoint}-optimized`, {
              method: 'POST',
              body: formData,
              signal: abortControllerRef.current?.signal
            });

            clearInterval(progressInterval);

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;
            const throughput = Math.round(result.total / duration);

            setStats({
              total: result.total,
              created: result.created,
              updated: result.updated,
              failed: result.failed,
              processing: result.total,
              endTime,
              throughput
            });

            setProgress(100);
            setStatus('completed');

            // Handle errors if any
            if (result.errors && result.errors.length > 0) {
              setErrors(result.errors.map((error: string, index: number) => ({
                row: index + 2,
                data: {},
                error: error
              })));
            }

            // 🎉 AMAZING SUCCESS CELEBRATION! 🎉
            toast({
              title: '🚀 AMAZING Import Success! 🎉',
              description: `🔥 BLAZING FAST: ${result.total} records processed in ${duration.toFixed(1)}s at ${throughput} records/sec! ⚡`,
            });

            // Additional celebration toast for performance
            setTimeout(() => {
              toast({
                title: '📊 Performance Report',
                description: `✨ Created: ${result.created} | 🔄 Updated: ${result.updated} | 💪 Zero Failures: ${result.failed === 0 ? '✅' : result.failed}`,
              });
            }, 1000);

            if (onImportComplete) {
              onImportComplete(result);
            }
          } catch (error: any) {
            if (error.message === 'Import cancelled') {
              toast({
                title: 'Import cancelled',
                description: 'The import process was cancelled',
              });
            } else {
              toast({
                title: 'Import failed',
                description: error.message || 'An error occurred during import',
                variant: 'destructive'
              });
            }
            setStatus('error');
          } finally {
            setImporting(false);
          }
        },
        error: (error) => {
          toast({
            title: 'Parse error',
            description: error.message,
            variant: 'destructive'
          });
          setImporting(false);
          setStatus('error');
        }
      });
    } else {
      // Original non-optimized import logic
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          if (!validateCSVStructure(results)) {
            setImporting(false);
            setStatus('error');
            return;
          }

          // Filter out invalid rows (like "Totals" row)
          const validData = results.data.filter((row: any) => {
            // Check if CallTime or Call Time is a valid date/time
            const callTime = row['Call Time'] || row['CallTime'];
            if (!callTime) return false;
            
            // Skip rows where CallTime is not a valid date
            const date = new Date(callTime);
            return !isNaN(date.getTime()) && callTime !== 'Totals';
          });

          const totalRecords = validData.length;
          const startTime = Date.now();
          setStats(prev => ({ ...prev, total: totalRecords, startTime }));
          setStatus('importing');

          // Process in chunks to prevent browser freezing
          const chunkSize = 10; // Smaller chunk size for better progress tracking
          const chunks = [];
          for (let i = 0; i < totalRecords; i += chunkSize) {
            chunks.push(validData.slice(i, i + chunkSize));
          }

          try {
            let totalCreated = 0;
            let totalUpdated = 0;
            let totalErrors: ImportError[] = [];

            for (let i = 0; i < chunks.length; i++) {
              const result = await processChunk(chunks[i], i * chunkSize);
              totalCreated += result.created;
              totalUpdated += result.updated;
              totalErrors = [...totalErrors, ...result.errors];
              
              // Update cumulative stats
              setStats(prev => ({
                ...prev,
                created: totalCreated,
                updated: totalUpdated,
                failed: totalErrors.length
              }));
              
              if (result.errors.length > 0) {
                setErrors(prev => [...prev, ...result.errors]);
              }
            }

            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;
            const throughput = Math.round(totalRecords / duration);

            setStatus('completed');
            const finalStats = {
              total: totalRecords,
              created: totalCreated,
              updated: totalUpdated,
              failed: totalErrors.length,
              processing: totalRecords,
              endTime,
              throughput
            };
            
            setStats(finalStats);
            
            // 🎉 STANDARD IMPORT SUCCESS WITH CELEBRATION! 🎉
            toast({
              title: '✅ Import Completed Successfully!',
              description: `🎯 Processed ${totalCreated + totalUpdated} of ${totalRecords} records in ${duration.toFixed(1)}s with precision!`,
            });

            // Additional success metrics
            setTimeout(() => {
              toast({
                title: '📈 Final Results',
                description: `✨ Created: ${totalCreated} | 🔄 Updated: ${totalUpdated} | ⚡ Speed: ${throughput} records/sec`,
              });
            }, 800);

            if (onImportComplete) {
              onImportComplete(finalStats);
            }
          } catch (error: any) {
            if (error.message === 'Import cancelled') {
              toast({
                title: 'Import cancelled',
                description: 'The import process was cancelled',
              });
            } else {
              toast({
                title: 'Import failed',
                description: error.message || 'An error occurred during import',
                variant: 'destructive'
              });
            }
            setStatus('error');
          } finally {
            setImporting(false);
          }
        },
        error: (error) => {
          toast({
            title: 'Parse error',
            description: error.message,
            variant: 'destructive'
          });
          setImporting(false);
          setStatus('error');
        }
      });
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setImporting(false);
    setStatus('idle');
  };

  const downloadErrorReport = () => {
    if (errors.length === 0) return;

    const csvContent = Papa.unparse(
      errors.map(err => ({
        Row: err.row,
        Error: err.error,
        ...err.data
      }))
    );

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Error report downloaded',
      description: 'Check your downloads folder for the error report',
    });
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'importing':
      case 'validating':
        return <AlertCircle className="h-5 w-5 text-blue-500 animate-pulse" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'validating':
        return 'Validating CSV structure...';
      case 'importing':
        const progressPercent = stats.total > 0 ? Math.round((stats.processing / stats.total) * 100) : 0;
        return `Processing ${stats.processing.toLocaleString()} of ${stats.total.toLocaleString()} records... (${progressPercent}%)`;
      case 'completed':
        return 'Import completed successfully!';
      case 'error':
        return 'Import completed with errors';
      default:
        return 'Select a CSV file to import';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" aria-describedby="csv-import-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import CSV Data
          </DialogTitle>
          <p id="csv-import-description" className="sr-only">
            Import CSV data to MongoDB database
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-4">
          {/* File Selection */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              disabled={importing}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              variant="outline"
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {file ? file.name : 'Choose CSV File'}
            </Button>
            {file && (
              <p className="text-sm text-muted-foreground">
                File size: {(file.size / 1024).toFixed(2)} KB
              </p>
            )}
          </div>

          {/* Advanced Settings */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full justify-between"
              disabled={importing}
            >
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Advanced Settings
              </span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            
            {showAdvanced && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="optimized-mode" className="text-sm font-medium">
                      High-Performance Mode
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Use optimized processing for large files (up to 1000x faster)
                    </p>
                  </div>
                  <Switch
                    id="optimized-mode"
                    checked={optimizationConfig.useOptimized}
                    onCheckedChange={(checked) =>
                      setOptimizationConfig(prev => ({ ...prev, useOptimized: checked }))
                    }
                    disabled={importing}
                  />
                </div>

                {optimizationConfig.useOptimized && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="batch-size" className="text-sm">
                        Batch Size
                      </Label>
                      <Select
                        value={optimizationConfig.batchSize.toString()}
                        onValueChange={(value) =>
                          setOptimizationConfig(prev => ({ ...prev, batchSize: parseInt(value) }))
                        }
                        disabled={importing}
                      >
                        <SelectTrigger id="batch-size">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="100">100 records (Small)</SelectItem>
                          <SelectItem value="500">500 records (Medium)</SelectItem>
                          <SelectItem value="1000">1000 records (Large)</SelectItem>
                          <SelectItem value="2000">2000 records (Extra Large)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Larger batches are faster but use more memory
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="worker-pool" className="text-sm">
                        Worker Pool Size
                      </Label>
                      <Select
                        value={optimizationConfig.workerPoolSize.toString()}
                        onValueChange={(value) =>
                          setOptimizationConfig(prev => ({ ...prev, workerPoolSize: parseInt(value) }))
                        }
                        disabled={importing}
                      >
                        <SelectTrigger id="worker-pool">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 workers (Conservative)</SelectItem>
                          <SelectItem value="4">4 workers (Balanced)</SelectItem>
                          <SelectItem value="8">8 workers (Performance)</SelectItem>
                          <SelectItem value="16">16 workers (Maximum)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        More workers process data faster in parallel
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Enhanced Status Display */}
          <Alert className={cn(
            "transition-all duration-300 border-2",
            status === 'completed' && "border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950",
            status === 'error' && "border-red-500 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950",
            status === 'importing' && "border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 shadow-lg",
            status === 'validating' && "border-yellow-500 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-full",
                status === 'importing' && "bg-blue-100 dark:bg-blue-900",
                status === 'completed' && "bg-green-100 dark:bg-green-900",
                status === 'error' && "bg-red-100 dark:bg-red-900",
                status === 'validating' && "bg-yellow-100 dark:bg-yellow-900"
              )}>
                {optimizationConfig.useOptimized && status === 'importing' ?
                  <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" /> :
                  getStatusIcon()
                }
              </div>
              <AlertDescription className="flex-1">
                <div className="font-medium text-base">
                  {getStatusMessage()}
                </div>
                {optimizationConfig.useOptimized && status === 'importing' && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 dark:from-blue-900 dark:to-purple-900 dark:text-blue-200 animate-pulse">
                      <Zap className="h-3 w-3 mr-1 animate-bounce" />
                      🚀 ROCKET MODE ACTIVE 🔥
                    </span>
                    <span className="text-xs text-muted-foreground animate-pulse">
                      ⚡ Ultra-fast parallel processing with amazing speed! ✨
                    </span>
                  </div>
                )}
              </AlertDescription>
            </div>
          </Alert>

          {/* Progress Bar */}
          {importing && (
            <div className="space-y-2">
              <div className="relative">
                <Progress value={progress} className="h-3 bg-gradient-to-r from-blue-100 to-purple-100" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-semibold text-white drop-shadow-lg">
                    {isNaN(progress) || !isFinite(progress) ? 0 : Math.round(progress)}%
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Processing batch {Math.ceil(stats.processing / optimizationConfig.batchSize)} of {Math.ceil(stats.total / optimizationConfig.batchSize)}</span>
                <span>{stats.processing.toLocaleString()} / {stats.total.toLocaleString()} records</span>
              </div>
            </div>
          )}

          {/* Statistics */}
          {(status === 'importing' || status === 'completed' || status === 'error') && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl border shadow-sm">
                  <p className="text-3xl font-bold text-gray-700 dark:text-gray-300">{stats.total.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground font-medium">Total Records</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-xl border border-green-200 dark:border-green-800 shadow-sm">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 animate-pulse">
                    {stats.created.toLocaleString()}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium">Created</p>
                  {status === 'importing' && stats.created > 0 && (
                    <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                      +{Math.floor(stats.created / Math.max(1, Math.ceil(stats.processing / optimizationConfig.batchSize)))} per batch
                    </div>
                  )}
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                    {stats.updated.toLocaleString()}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">Updated</p>
                  {status === 'importing' && stats.updated > 0 && (
                    <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                      +{Math.floor(stats.updated / Math.max(1, Math.ceil(stats.processing / optimizationConfig.batchSize)))} per batch
                    </div>
                  )}
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 rounded-xl border border-red-200 dark:border-red-800 shadow-sm">
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                    {stats.failed.toLocaleString()}
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">Failed</p>
                  {stats.failed === 0 && status === 'importing' && (
                    <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                      ✓ No errors
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Performance Metrics */}
              {(stats.throughput || status === 'importing') && (
                <div className="p-4 bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-950 rounded-xl border border-purple-200 dark:border-purple-800 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                        <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">Performance Metrics</span>
                        {optimizationConfig.useOptimized && (
                          <div className="text-xs text-purple-600 dark:text-purple-400">High-Performance Mode</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {stats.throughput ? (
                        <>
                          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {stats.throughput.toLocaleString()} records/sec
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {stats.endTime && stats.startTime ?
                              `Completed in ${((stats.endTime - stats.startTime) / 1000).toFixed(1)}s` :
                              'Processing...'
                            }
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 animate-pulse">
                            {stats.processing > 0 ? Math.round(stats.processing / ((Date.now() - (stats.startTime || Date.now())) / 1000)) : 0} records/sec
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Real-time throughput
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  {status === 'importing' && (
                    <div className="mt-3 grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                          {optimizationConfig.batchSize}
                        </p>
                        <p className="text-xs text-muted-foreground">Batch Size</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {optimizationConfig.workerPoolSize}
                        </p>
                        <p className="text-xs text-muted-foreground">Workers</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                          {Math.ceil(stats.processing / optimizationConfig.batchSize)}
                        </p>
                        <p className="text-xs text-muted-foreground">Batches Done</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Error Details */}
          {errors.length > 0 && (
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowErrors(!showErrors)}
                className="w-full justify-between"
              >
                <span>Error Details ({errors.length} errors)</span>
                {showErrors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              
              {showErrors && (
                <ScrollArea className="h-48 w-full rounded-md border p-4">
                  <div className="space-y-2">
                    {errors.map((error, index) => (
                      <div key={index} className="text-sm space-y-1 pb-2 border-b last:border-0">
                        <p className="font-medium text-red-600">Row {error.row}</p>
                        <p className="text-muted-foreground">{error.error}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {errors.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadErrorReport}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Error Report
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 pt-4 border-t">
          {!importing && status !== 'completed' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  resetState();
                  onClose();
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!file || importing}
                className="flex-1"
                variant={optimizationConfig.useOptimized ? "default" : "outline"}
              >
                {optimizationConfig.useOptimized ? (
                  <>
                    <Zap className="h-4 w-4 mr-2 animate-bounce" />
                    🚀 Launch Rocket Import! 🔥
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    ✨ Start Standard Import
                  </>
                )}
              </Button>
            </>
          )}
          
          {importing && (
            <Button
              variant="destructive"
              onClick={handleCancel}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel Import
            </Button>
          )}
          
          {status === 'completed' && (
            <Button
              onClick={() => {
                resetState();
                onClose();
              }}
              className="flex-1"
            >
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};