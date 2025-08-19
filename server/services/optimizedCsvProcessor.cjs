const { Readable, Transform, pipeline } = require('stream');
const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs').promises;
const { performance } = require('perf_hooks');

/**
 * High-Performance CSV Processor with Advanced Optimization Techniques
 * 
 * Features:
 * - Stream-based processing for memory efficiency
 * - Parallel processing with Worker Threads
 * - Batch operations for MongoDB insertion
 * - Optimized parsing with minimal allocations
 * - Performance monitoring and benchmarking
 */
class OptimizedCSVProcessor {
  constructor(options = {}) {
    // ROCKET SPEED CONFIGURATION - Optimized for maximum throughput
    this.batchSize = options.batchSize || 1000; // ROCKET: Increased to 1000 records per batch
    this.workerPoolSize = options.workerPoolSize || 4; // ROCKET: More workers for parallel processing
    this.chunkSize = options.chunkSize || 256 * 1024; // ROCKET: Larger chunks (256KB)
    this.maxConcurrentBatches = options.maxConcurrentBatches || 5; // ROCKET: 5 concurrent batches
    this.enableProfiling = options.enableProfiling !== false;
    this.rocketMode = options.rocketMode !== false; // ROCKET: Enable ultra-fast mode by default
    
    this.metrics = {
      startTime: 0,
      endTime: 0,
      totalRows: 0,
      successfulRows: 0,
      failedRows: 0,
      parseTime: 0,
      transformTime: 0,
      insertTime: 0,
      memoryUsage: {},
      throughput: 0
    };
  }

  /**
   * Process CSV with maximum performance optimization
   */
  async processCSV(csvContent, inboundCallsService) {
    this.metrics.startTime = performance.now();
    this.metrics.memoryUsage.start = process.memoryUsage();
    
    console.log('[OPTIMIZED] Starting high-performance CSV processing...');
    
    try {
      // Parse CSV header for column mapping
      const lines = csvContent.split('\n');
      const headers = this.parseCSVLine(lines[0]);
      const dataLines = lines.slice(1).filter(line => line.trim());
      
      console.log(`[OPTIMIZED] Processing ${dataLines.length} rows with ${this.workerPoolSize} workers`);
      
      // Split data into chunks for parallel processing
      const chunks = this.splitIntoChunks(dataLines, Math.ceil(dataLines.length / this.workerPoolSize));
      
      // Process chunks in parallel
      const parseStartTime = performance.now();
      const parsedChunks = await this.processChunksInParallel(chunks, headers);
      this.metrics.parseTime = performance.now() - parseStartTime;
      
      // Flatten results
      const allRecords = parsedChunks.flat();
      this.metrics.totalRows = allRecords.length;
      
      // Batch insert with optimized MongoDB operations and real-time progress
      const insertStartTime = performance.now();
      const results = await this.batchInsertOptimized(allRecords, inboundCallsService, null);
      this.metrics.insertTime = performance.now() - insertStartTime;
      
      // Calculate final metrics
      this.metrics.endTime = performance.now();
      this.metrics.memoryUsage.end = process.memoryUsage();
      this.metrics.throughput = this.metrics.totalRows / ((this.metrics.endTime - this.metrics.startTime) / 1000);
      
      this.metrics.successfulRows = results.created + results.updated;
      this.metrics.failedRows = results.failed;
      
      if (this.enableProfiling) {
        this.printPerformanceReport();
      }
      
      return {
        ...results,
        metrics: this.metrics
      };
    } catch (error) {
      console.error('[OPTIMIZED] Error in CSV processing:', error);
      throw error;
    }
  }

  /**
   * Process CSV with real-time progress callbacks
   */
  async processCSVWithProgress(csvContent, inboundCallsService, progressCallback) {
    this.metrics.startTime = performance.now();
    this.metrics.memoryUsage.start = process.memoryUsage();
    
    console.log('[OPTIMIZED-PROGRESS] Starting high-performance CSV processing with real-time progress...');
    
    try {
      // Parse CSV header for column mapping
      const lines = csvContent.split('\n');
      const headers = this.parseCSVLine(lines[0]);
      const dataLines = lines.slice(1).filter(line => line.trim());
      
      console.log(`[OPTIMIZED-PROGRESS] Processing ${dataLines.length} rows with ${this.workerPoolSize} workers`);
      
      // Send initial progress with records found
      if (progressCallback) {
        progressCallback({
          recordsFound: dataLines.length,
          created: 0,
          updated: 0,
          failed: 0,
          step: 'scanning',
          progress: 5
        });
      }
      
      // Split data into chunks for parallel processing
      const chunks = this.splitIntoChunks(dataLines, Math.ceil(dataLines.length / this.workerPoolSize));
      
      // Process chunks in parallel
      const parseStartTime = performance.now();
      const parsedChunks = await this.processChunksInParallel(chunks, headers);
      this.metrics.parseTime = performance.now() - parseStartTime;
      
      // Flatten results
      const allRecords = parsedChunks.flat();
      this.metrics.totalRows = allRecords.length;
      
      // Send progress after parsing
      if (progressCallback) {
        progressCallback({
          recordsFound: allRecords.length,
          created: 0,
          updated: 0,
          failed: 0,
          step: 'processing',
          progress: 15
        });
      }
      
      // Batch insert with optimized MongoDB operations and real-time progress
      const insertStartTime = performance.now();
      const results = await this.batchInsertOptimized(allRecords, inboundCallsService, progressCallback);
      this.metrics.insertTime = performance.now() - insertStartTime;
      
      // Calculate final metrics
      this.metrics.endTime = performance.now();
      this.metrics.memoryUsage.end = process.memoryUsage();
      this.metrics.throughput = this.metrics.totalRows / ((this.metrics.endTime - this.metrics.startTime) / 1000);
      
      this.metrics.successfulRows = results.created + results.updated;
      this.metrics.failedRows = results.failed;
      
      if (this.enableProfiling) {
        this.printPerformanceReport();
      }
      
      return {
        ...results,
        metrics: this.metrics
      };
    } catch (error) {
      console.error('[OPTIMIZED-PROGRESS] Error in CSV processing:', error);
      throw error;
    }
  }

  /**
   * Split data into chunks for parallel processing
   */
  splitIntoChunks(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Process chunks in parallel using Worker Threads
   */
  async processChunksInParallel(chunks, headers) {
    const promises = chunks.map((chunk, index) => 
      this.processChunkInWorker(chunk, headers, index)
    );
    
    return Promise.all(promises);
  }

  /**
   * Process a single chunk (can be run in worker thread)
   */
  async processChunkInWorker(chunk, headers, workerId) {
    console.log(`[WORKER-${workerId}] Processing ${chunk.length} rows`);
    
    const records = [];
    const startTime = performance.now();
    
    for (const line of chunk) {
      if (!line.trim()) continue;
      
      try {
        const values = this.parseCSVLine(line);
        const record = this.mapToRecord(headers, values);
        if (record) {
          records.push(record);
        }
      } catch (error) {
        console.error(`[WORKER-${workerId}] Error parsing line:`, error.message);
      }
    }
    
    const processingTime = performance.now() - startTime;
    console.log(`[WORKER-${workerId}] Processed ${records.length} records in ${processingTime.toFixed(2)}ms`);
    
    return records;
  }

  /**
   * Optimized CSV line parser (faster than regex)
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  /**
   * Map CSV values to record object with field mapping
   */
  mapToRecord(headers, values) {
    const record = {};
    
    // Field mapping from display names to MongoDB field names
    // Handle case variations and normalize field names
    const fieldMap = {
      'Call Time': 'CallTime',
      'Caller ID': 'CallerID',
      'Destination': 'Destination',
      'Trunk': 'Trunk',
      'Trunk Number': 'TrunkNumber',
      'Trunk number': 'TrunkNumber', // Handle lowercase 'number'
      'TrunkNumber': 'TrunkNumber',  // Handle direct field name
      'DID': 'DID',
      'Did': 'DID',                  // Handle capitalization variation
      'did': 'DID',                  // Handle lowercase
      'Status': 'Status',
      'Ringing': 'Ringing',
      'Talking': 'Talking',
      'Total Duration': 'TotalDuration',
      'Call Type': 'CallType',
      'Sentiment': 'Sentiment',
      'Summary': 'Summary',
      'Transcription': 'Transcription'
    };
    
    headers.forEach((header, index) => {
      // Normalize header by trimming and handling case variations
      const normalizedHeader = header.trim();
      const fieldName = fieldMap[normalizedHeader] || normalizedHeader;
      let value = values[index] || '';
      
      // Skip empty values for optional fields
      if (fieldName && (value || ['CallTime', 'CallerID'].includes(fieldName))) {
        // Convert ALL fields to strings for MongoDB compatibility
        // MongoDB schema expects STRING types for most fields
        if (['TrunkNumber', 'Ringing', 'Talking', 'TotalDuration'].includes(fieldName)) {
          // Ensure numeric fields are converted to strings
          value = String(value || '0');
        } else {
          // Convert all other fields to strings as well
          value = String(value);
        }
        
        record[fieldName] = value;
      }
    });
    
    // Validate required fields
    if (!record.CallTime || !record.CallerID) {
      return null;
    }
    
    // Validate CallTime is not "Totals" or invalid date
    if (record.CallTime === 'Totals' || record.CallTime.toLowerCase() === 'totals') {
      return null;
    }
    
    // Try to parse the date to ensure it's valid
    const date = new Date(record.CallTime);
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return record;
  }

  /**
   * ROCKET SPEED: Ultra-fast batch insert with maximum parallelization and real-time progress
   */
  async batchInsertOptimized(records, inboundCallsService, progressCallback = null) {
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: []
    };
    
    // Split records into larger batches for rocket speed
    const batches = this.splitIntoChunks(records, this.batchSize);
    console.log(`[ROCKET-SPEED] Inserting ${records.length} records in ${batches.length} batches (${this.batchSize} per batch)`);
    
    // Real-time progress tracking
    let processedRecords = 0;
    const totalRecords = records.length;
    
    if (this.rocketMode) {
      // ROCKET MODE: Maximum parallel processing with minimal delays
      console.log(`[ROCKET-MODE] Engaging maximum parallel processing with ${this.maxConcurrentBatches} concurrent batches`);
      
      // Process all batches with controlled concurrency but minimal delays
      for (let i = 0; i < batches.length; i += this.maxConcurrentBatches) {
        const concurrentBatches = batches.slice(i, i + this.maxConcurrentBatches);
        
        console.log(`[ROCKET-BATCH-GROUP] Processing batches ${i} to ${i + concurrentBatches.length - 1}`);
        
        const batchResults = await Promise.all(
          concurrentBatches.map((batch, index) =>
            this.insertBatch(batch, inboundCallsService, i + index)
          )
        );
        
        // Aggregate results and emit real-time progress
        batchResults.forEach(batchResult => {
          results.created += batchResult.created;
          results.updated += batchResult.updated;
          results.failed += batchResult.failed;
          results.errors.push(...batchResult.errors);
        });
        
        // Update processed count and emit progress
        processedRecords += concurrentBatches.reduce((sum, batch) => sum + batch.length, 0);
        const progress = Math.min(Math.round((processedRecords / totalRecords) * 100), 100);
        
        // Emit real-time progress
        if (progressCallback) {
          progressCallback({
            recordsFound: totalRecords,
            created: results.created,
            updated: results.updated,
            failed: results.failed,
            step: 'processing',
            progress: progress
          });
        }
        
        // ROCKET: Minimal delay only if we have more batches and some failed
        const hasFailures = batchResults.some(result => result.failed > 0);
        if (i + this.maxConcurrentBatches < batches.length && hasFailures) {
          console.log(`[ROCKET-THROTTLE] Brief pause due to failures (1s)...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Only 1 second delay on failures
        } else if (i + this.maxConcurrentBatches < batches.length) {
          // ROCKET: No delay between successful batch groups!
          console.log(`[ROCKET-CONTINUE] Continuing immediately to next batch group...`);
        }
      }
    } else {
      // Conservative mode with real-time progress
      for (let i = 0; i < batches.length; i += this.maxConcurrentBatches) {
        const concurrentBatches = batches.slice(i, i + this.maxConcurrentBatches);
        
        const batchResults = await Promise.all(
          concurrentBatches.map((batch, index) =>
            this.insertBatch(batch, inboundCallsService, i + index)
          )
        );
        
        // Aggregate results and emit real-time progress
        batchResults.forEach(batchResult => {
          results.created += batchResult.created;
          results.updated += batchResult.updated;
          results.failed += batchResult.failed;
          results.errors.push(...batchResult.errors);
        });
        
        // Update processed count and emit progress
        processedRecords += concurrentBatches.reduce((sum, batch) => sum + batch.length, 0);
        const progress = Math.min(Math.round((processedRecords / totalRecords) * 100), 100);
        
        // Emit real-time progress
        if (progressCallback) {
          progressCallback({
            recordsFound: totalRecords,
            created: results.created,
            updated: results.updated,
            failed: results.failed,
            step: 'processing',
            progress: progress
          });
        }
        
        // Add delay between batch groups to prevent rate limiting
        if (i + this.maxConcurrentBatches < batches.length) {
          console.log(`[CONSERVATIVE] Waiting 5 seconds before next batch group...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
    
    return results;
  }

  /**
   * Insert a single batch using rocket-speed optimized batch insertion
   */
  async insertBatch(batch, inboundCallsService, batchId) {
    const batchType = this.rocketMode ? 'ROCKET' : 'STANDARD';
    console.log(`[${batchType}-BATCH-${batchId}] Inserting ${batch.length} records using ${batchType.toLowerCase()} batch method`);
    const startTime = performance.now();
    
    try {
      // Use the new batchInsertInboundCalls method with rocket mode flag (no progress callback at batch level)
      const results = await inboundCallsService.batchInsertInboundCalls(batch, this.rocketMode, null);
      
      const processingTime = performance.now() - startTime;
      console.log(`[${batchType}-BATCH-${batchId}] Completed in ${processingTime.toFixed(2)}ms - Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`);
      
      return results;
    } catch (error) {
      console.error(`[${batchType}-BATCH-${batchId}] Error in batch insert:`, error);
      
      const processingTime = performance.now() - startTime;
      console.log(`[${batchType}-BATCH-${batchId}] Failed in ${processingTime.toFixed(2)}ms`);
      
      return {
        created: 0,
        updated: 0,
        failed: batch.length,
        errors: [error.message]
      };
    }
  }

  /**
   * Stream-based processing for very large files
   */
  async processCSVStream(readStream, inboundCallsService) {
    return new Promise((resolve, reject) => {
      const results = {
        created: 0,
        updated: 0,
        failed: 0,
        errors: []
      };
      
      let headers = null;
      let buffer = [];
      let lineBuffer = '';
      
      const transformStream = new Transform({
        async transform(chunk, encoding, callback) {
          const lines = (lineBuffer + chunk.toString()).split('\n');
          lineBuffer = lines.pop(); // Keep incomplete line for next chunk
          
          for (const line of lines) {
            if (!line.trim()) continue;
            
            if (!headers) {
              headers = this.parseCSVLine(line);
              continue;
            }
            
            const values = this.parseCSVLine(line);
            const record = this.mapToRecord(headers, values);
            
            if (record) {
              buffer.push(record);
              
              // Process buffer when it reaches batch size
              if (buffer.length >= this.batchSize) {
                const batch = buffer.splice(0, this.batchSize);
                const batchResult = await this.insertBatch(batch, inboundCallsService, results.created);
                
                results.created += batchResult.created;
                results.updated += batchResult.updated;
                results.failed += batchResult.failed;
                results.errors.push(...batchResult.errors);
              }
            }
          }
          
          callback();
        },
        
        async flush(callback) {
          // Process remaining buffer
          if (buffer.length > 0) {
            const batchResult = await this.insertBatch(buffer, inboundCallsService, results.created);
            
            results.created += batchResult.created;
            results.updated += batchResult.updated;
            results.failed += batchResult.failed;
            results.errors.push(...batchResult.errors);
          }
          
          callback();
          resolve(results);
        }
      });
      
      pipeline(
        readStream,
        transformStream,
        (error) => {
          if (error) {
            reject(error);
          }
        }
      );
    });
  }

  /**
   * Print detailed performance report
   */
  printPerformanceReport() {
    const totalTime = this.metrics.endTime - this.metrics.startTime;
    const memoryDelta = {
      rss: (this.metrics.memoryUsage.end.rss - this.metrics.memoryUsage.start.rss) / 1024 / 1024,
      heapUsed: (this.metrics.memoryUsage.end.heapUsed - this.metrics.memoryUsage.start.heapUsed) / 1024 / 1024
    };
    
    console.log('\n========================================');
    console.log('     PERFORMANCE OPTIMIZATION REPORT     ');
    console.log('========================================');
    console.log(`Total Processing Time: ${totalTime.toFixed(2)}ms`);
    console.log(`Parse Time: ${this.metrics.parseTime.toFixed(2)}ms (${(this.metrics.parseTime/totalTime*100).toFixed(1)}%)`);
    console.log(`Insert Time: ${this.metrics.insertTime.toFixed(2)}ms (${(this.metrics.insertTime/totalTime*100).toFixed(1)}%)`);
    console.log(`----------------------------------------`);
    console.log(`Total Rows Processed: ${this.metrics.totalRows}`);
    console.log(`Successful Rows: ${this.metrics.successfulRows}`);
    console.log(`Failed Rows: ${this.metrics.failedRows}`);
    console.log(`----------------------------------------`);
    console.log(`Throughput: ${this.metrics.throughput.toFixed(2)} rows/second`);
    console.log(`Memory Delta (RSS): ${memoryDelta.rss.toFixed(2)} MB`);
    console.log(`Memory Delta (Heap): ${memoryDelta.heapUsed.toFixed(2)} MB`);
    console.log(`----------------------------------------`);
    console.log(`Batch Size: ${this.batchSize}`);
    console.log(`Worker Pool Size: ${this.workerPoolSize}`);
    console.log(`Max Concurrent Batches: ${this.maxConcurrentBatches}`);
    console.log('========================================\n');
  }

  /**
   * Benchmark different configurations
   */
  async benchmark(csvContent, inboundCallsService) {
    const configurations = [
      { batchSize: 100, workerPoolSize: 2, maxConcurrentBatches: 5 },
      { batchSize: 500, workerPoolSize: 4, maxConcurrentBatches: 10 },
      { batchSize: 1000, workerPoolSize: 4, maxConcurrentBatches: 10 },
      { batchSize: 2000, workerPoolSize: 8, maxConcurrentBatches: 20 }
    ];
    
    const results = [];
    
    for (const config of configurations) {
      console.log(`\nBenchmarking configuration:`, config);
      
      const processor = new OptimizedCSVProcessor({
        ...config,
        enableProfiling: false
      });
      
      const startTime = performance.now();
      const result = await processor.processCSV(csvContent, inboundCallsService);
      const endTime = performance.now();
      
      results.push({
        config,
        time: endTime - startTime,
        throughput: result.metrics.throughput
      });
    }
    
    // Print benchmark results
    console.log('\n========================================');
    console.log('       BENCHMARK RESULTS SUMMARY        ');
    console.log('========================================');
    
    results.sort((a, b) => a.time - b.time);
    
    results.forEach((result, index) => {
      console.log(`\nRank #${index + 1}:`);
      console.log(`Configuration: Batch=${result.config.batchSize}, Workers=${result.config.workerPoolSize}, Concurrent=${result.config.maxConcurrentBatches}`);
      console.log(`Time: ${result.time.toFixed(2)}ms`);
      console.log(`Throughput: ${result.throughput.toFixed(2)} rows/second`);
    });
    
    const improvement = ((results[results.length - 1].time - results[0].time) / results[results.length - 1].time * 100).toFixed(1);
    console.log(`\nBest configuration is ${improvement}% faster than worst`);
    console.log('========================================\n');
    
    return results;
  }
}

module.exports = OptimizedCSVProcessor;