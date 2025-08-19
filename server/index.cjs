const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const fs = require('fs').promises;
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');

// Load environment variables conditionally for local development only
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '.env.local') });
}

// Import services after env vars are loaded
const mongoInboundCallsService = require('./services/mongoInboundCallsService.cjs');
const MongoOutgoingCallsService = require('./services/mongoOutgoingCallsService.cjs');
const MongoAreaCodesService = require('./services/mongoAreaCodesService.cjs');
const MongoCombinedCallLogsService = require('./services/mongoCombinedCallLogsService.cjs');
const { MongoUsersService } = require('./services/mongoUsersService.cjs');
const { transformDisplayToMongoDB, transformMongoDBToDisplay } = require('./utils/fieldMapping.cjs');
const OptimizedCSVProcessor = require('./services/optimizedCsvProcessor.cjs');

// Initialize services
const mongoOutgoingCallsService = new MongoOutgoingCallsService();
const mongoAreaCodesService = new MongoAreaCodesService();
const mongoCombinedCallLogsService = new MongoCombinedCallLogsService();
const mongoUsersService = new MongoUsersService();

const app = express();
const PORT = process.env.API_PORT || 3001;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for optimized processing
  }
});

// Security middleware
app.use(helmet());

// Enable CORS for frontend
app.use(cors({
  origin: '*', // Temporarily allow all origins to test
  credentials: false, // Must be false when using wildcard origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Accept', 'Expires']
}));

// Compression for better performance
app.use(compression());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Inbound calls endpoint with query optimization
app.get('/api/inbound-calls', async (req, res, next) => {
  try {
    const {
      page = '1',
      pageSize = '50',
      sortBy = 'CallTime',
      sortOrder = 'DESC',
      search = '',
      startDate,
      endDate,
      ...filters
    } = req.query;

    // Validate and parse query parameters
    const options = {
      page: Math.max(1, parseInt(page)),
      pageSize: Math.min(50000, Math.max(1, parseInt(pageSize))), // Max 50000 per page for exports
      sortBy: sortBy,
      sortOrder: sortOrder.toUpperCase(),
      search: search,
      startDate: startDate,
      endDate: endDate,
      filters: Object.keys(filters).reduce((acc, key) => {
        // Exclude the _t timestamp parameter from filters
        if (filters[key] && key !== '_t') {
          acc[key] = filters[key];
        }
        return acc;
      }, {})
    };

    // NO CACHING - Set headers to prevent any caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    // Always fetch fresh data from MongoDB (no caching)
    console.log('[API] Fetching fresh real-time data from MongoDB (no cache)...');
    const result = await mongoInboundCallsService.getInboundCalls(options);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error in /api/inbound-calls:', error);
    next(error);
  }
});

// Optimized CSV Import endpoint with file upload support and real-time progress streaming
app.post('/api/inbound-calls/import-optimized', upload.single('file'), async (req, res, next) => {
  try {
    let csvContent;
    let config = {};
    
    // Check if file was uploaded
    if (req.file) {
      // File upload mode - using memory storage
      csvContent = req.file.buffer.toString('utf-8');
      
      // Parse configuration from form data with ROCKET SPEED defaults
      config = {
        batchSize: parseInt(req.body.batchSize) || 1000,
        workerPoolSize: parseInt(req.body.workerPoolSize) || 4,
        maxConcurrentBatches: parseInt(req.body.maxConcurrentBatches) || 5, // ROCKET: Reduced for stability
        enableProfiling: req.body.enableProfiling !== 'false',
        rocketMode: req.body.rocketMode !== 'false', // ROCKET: Enable by default
        enableStreaming: req.body.enableStreaming !== 'false' // Enable real-time streaming
      };
      
      // No file cleanup needed with memory storage
    } else if (req.body.csvContent) {
      // JSON mode (backward compatibility)
      csvContent = req.body.csvContent;
      config = req.body.config || {};
    } else {
      return res.status(400).json({
        success: false,
        error: 'CSV content or file is required'
      });
    }
    
    // Check if client wants streaming response
    const wantsStreaming = config.enableStreaming && req.headers.accept && req.headers.accept.includes('application/x-ndjson');
    
    console.log('[IMPORT] Streaming check:', {
      enableStreaming: config.enableStreaming,
      acceptHeader: req.headers.accept,
      wantsStreaming: wantsStreaming
    });
    
    if (wantsStreaming) {
      console.log('[IMPORT] Setting up streaming response...');
      // Set up streaming response
      res.writeHead(200, {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      
      // Progress callback for real-time updates
      const progressCallback = (progressData) => {
        const progressLine = JSON.stringify(progressData) + '\n';
        res.write(progressLine);
      };
      
      // Create optimized processor with ROCKET SPEED configuration
      const processor = new OptimizedCSVProcessor({
        batchSize: config.batchSize || 1000,
        workerPoolSize: config.workerPoolSize || 4,
        maxConcurrentBatches: config.maxConcurrentBatches || 5,
        enableProfiling: config.enableProfiling !== false,
        rocketMode: config.rocketMode !== false // ROCKET MODE enabled by default
      });
      
      console.log('[STREAMING IMPORT] Starting real-time CSV import with streaming...');
      console.log('[STREAMING IMPORT] Configuration:', config);
      const startTime = Date.now();
      
      // Send initial progress
      progressCallback({
        recordsFound: 0,
        created: 0,
        updated: 0,
        failed: 0,
        step: 'scanning',
        progress: 0
      });
      
      // Process CSV with real-time progress streaming
      const result = await processor.processCSVWithProgress(csvContent, mongoInboundCallsService, progressCallback);
      
      const totalTime = Date.now() - startTime;
      console.log(`[STREAMING IMPORT] Completed in ${totalTime}ms`);
      
      // Send final result
      const finalResult = {
        recordsFound: result.created + result.updated + result.failed,
        created: result.created,
        updated: result.updated,
        failed: result.failed,
        step: 'complete',
        progress: 100,
        performance: {
          totalTime: totalTime,
          throughput: result.metrics.throughput,
          parseTime: result.metrics.parseTime,
          insertTime: result.metrics.insertTime,
          totalRows: result.metrics.totalRows
        },
        message: `Import completed in ${(totalTime/1000).toFixed(2)}s - Created: ${result.created}, Updated: ${result.updated}, Failed: ${result.failed}`
      };
      
      res.write(JSON.stringify(finalResult) + '\n');
      res.end();
    } else {
      // Regular JSON response (backward compatibility)
      const processor = new OptimizedCSVProcessor({
        batchSize: config.batchSize || 1000,
        workerPoolSize: config.workerPoolSize || 4,
        maxConcurrentBatches: config.maxConcurrentBatches || 5,
        enableProfiling: config.enableProfiling !== false,
        rocketMode: config.rocketMode !== false
      });
      
      console.log('[OPTIMIZED IMPORT] Starting high-performance CSV import...');
      console.log('[OPTIMIZED IMPORT] Configuration:', config);
      const startTime = Date.now();
      
      // Process CSV with optimized processor
      const result = await processor.processCSV(csvContent, mongoInboundCallsService);
      
      const totalTime = Date.now() - startTime;
      console.log(`[OPTIMIZED IMPORT] Completed in ${totalTime}ms`);
      
      res.json({
        success: result.failed === 0,
        total: result.created + result.updated + result.failed,
        created: result.created,
        updated: result.updated,
        failed: result.failed,
        errors: result.errors.slice(0, 10), // Limit errors in response
        performance: {
          totalTime: totalTime,
          throughput: result.metrics.throughput,
          parseTime: result.metrics.parseTime,
          insertTime: result.metrics.insertTime,
          totalRows: result.metrics.totalRows
        },
        message: `Import completed in ${(totalTime/1000).toFixed(2)}s - Created: ${result.created}, Updated: ${result.updated}, Failed: ${result.failed}`
      });
    }
  } catch (error) {
    console.error('Error in optimized import:', error);
    
    // No file cleanup needed with memory storage
    
    if (res.headersSent) {
      // If streaming, send error as final message
      res.write(JSON.stringify({ error: error.message || 'Failed to import CSV data' }) + '\n');
      res.end();
    } else {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to import CSV data'
      });
    }
  }
});

// Benchmark endpoint to compare different configurations
app.post('/api/inbound-calls/benchmark', async (req, res, next) => {
  try {
    const { csvContent } = req.body;
    
    if (!csvContent) {
      return res.status(400).json({
        success: false,
        error: 'CSV content is required for benchmarking'
      });
    }
    
    console.log('[BENCHMARK] Starting performance benchmark...');
    
    const processor = new OptimizedCSVProcessor({ enableProfiling: false });
    const results = await processor.benchmark(csvContent, mongoInboundCallsService);
    
    res.json({
      success: true,
      benchmarkResults: results,
      recommendation: results[0].config, // Best configuration
      message: `Benchmark complete. Best configuration achieves ${results[0].throughput.toFixed(0)} rows/second`
    });
  } catch (error) {
    console.error('Error in benchmark:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Benchmark failed'
    });
  }
});

// Original CSV Import endpoint for backward compatibility
app.post('/api/inbound-calls/import', async (req, res, next) => {
  try {
    const inputData = req.body;
    
    // Handle both single record and batch import
    const records = Array.isArray(inputData.records) ? inputData.records : [inputData];
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: []
    };
    
    for (const record of records) {
      // Transform display names to MongoDB field names if needed
      // Check if record has display names (with spaces) or MongoDB names (camelCase)
      const hasDisplayNames = 'Call Time' in record || 'Caller ID' in record;
      const transformedRecord = hasDisplayNames ? transformDisplayToMongoDB(record) : record;

      // Validate required fields using MongoDB field names
      const requiredFields = ['CallTime', 'CallerID'];
      const missingFields = requiredFields.filter(field => !transformedRecord[field]);
      
      if (missingFields.length > 0) {
        results.failed++;
        results.errors.push(`Missing required fields: ${missingFields.join(', ')}`);
        continue;
      }
      
      console.log('[IMPORT] Inserting record into MongoDB:', transformedRecord);
      
      // Actually insert into MongoDB with deduplication
      const result = await mongoInboundCallsService.insertInboundCall(transformedRecord);
      console.log('[IMPORT] Insert result:', result);
      
      if (result.success) {
        if (result.action === 'created') {
          results.created++;
        } else if (result.action === 'updated') {
          results.updated++;
        }
      } else {
        results.failed++;
        results.errors.push(result.error);
      }
    }
    
    // NO CACHING - Set headers to prevent any caching of import results
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Return aggregated results
    console.log(`[IMPORT] Import complete - Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`);
    res.json({
      success: results.failed === 0,
      created: results.created,
      updated: results.updated,
      failed: results.failed,
      errors: results.errors,
      message: `Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`
    });
  } catch (error) {
    console.error('Error importing record:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to import record'
    });
  }
});

// Filter options endpoint (for dropdowns)
app.get('/api/inbound-calls/filters/:field', async (req, res, next) => {
  try {
    const { field } = req.params;
    
    // Validate field name to prevent injection
    const allowedFields = ['Status', 'CallType', 'Sentiment', 'Trunk', 'Destination'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid field name'
      });
    }

    // NO CACHING - Set headers to prevent any caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    const options = await mongoInboundCallsService.getFilterOptions(field);
    
    res.json({
      success: true,
      field,
      options
    });
  } catch (error) {
    console.error(`Error fetching filter options:`, error);
    next(error);
  }
});

// COMBINED CALL LOGS ENDPOINTS
// =============================

// Combined call logs endpoint (merges incoming and outgoing)
app.get('/api/call-logs', async (req, res, next) => {
  try {
    const {
      page = '1',
      pageSize = '50',
      sortBy = 'CallTime',
      sortOrder = 'DESC',
      search = '',
      startDate,
      endDate,
      dateRange,
      ...filters
    } = req.query;

    // Helper function to convert dateRange to startDate/endDate
    const getDateRangeFromFilter = (dateRange) => {
      // Use UTC dates to match MongoDB storage
      const now = new Date();
      // Get UTC date components
      const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      
      switch (dateRange) {
        case 'today':
          // For "today", we want all records from 00:00:00 UTC to 23:59:59 UTC of the current UTC date
          const todayEnd = new Date(todayUTC);
          todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
          return {
            startDate: todayUTC.toISOString().split('T')[0], // YYYY-MM-DD
            endDate: todayEnd.toISOString().split('T')[0]    // YYYY-MM-DD (next day for < comparison)
          };
        case 'yesterday':
          const yesterday = new Date(todayUTC);
          yesterday.setUTCDate(yesterday.getUTCDate() - 1);
          return {
            startDate: yesterday.toISOString().split('T')[0],
            endDate: todayUTC.toISOString().split('T')[0]  // Up to but not including today
          };
        case 'last7days':
          const last7Days = new Date(todayUTC);
          last7Days.setUTCDate(last7Days.getUTCDate() - 7);
          const tomorrow7 = new Date(todayUTC);
          tomorrow7.setUTCDate(tomorrow7.getUTCDate() + 1);
          return {
            startDate: last7Days.toISOString().split('T')[0],
            endDate: tomorrow7.toISOString().split('T')[0]  // Include today
          };
        case 'last30days':
          const last30Days = new Date(todayUTC);
          last30Days.setUTCDate(last30Days.getUTCDate() - 30);
          const tomorrow30 = new Date(todayUTC);
          tomorrow30.setUTCDate(tomorrow30.getUTCDate() + 1);
          return {
            startDate: last30Days.toISOString().split('T')[0],
            endDate: tomorrow30.toISOString().split('T')[0]  // Include today
          };
        case 'last90days':
          const last90Days = new Date(todayUTC);
          last90Days.setUTCDate(last90Days.getUTCDate() - 90);
          const tomorrow90 = new Date(todayUTC);
          tomorrow90.setUTCDate(tomorrow90.getUTCDate() + 1);
          return {
            startDate: last90Days.toISOString().split('T')[0],
            endDate: tomorrow90.toISOString().split('T')[0]  // Include today
          };
        case 'all':
          return { startDate: null, endDate: null };
        default:
          return { startDate: null, endDate: null };
      }
    };

    // Process dateRange parameter if provided
    let processedStartDate = startDate;
    let processedEndDate = endDate;
    
    console.log(`[DEBUG-DATES] ========== DATE PROCESSING START ==========`);
    console.log(`[DEBUG-DATES] Raw parameters:`);
    console.log(`[DEBUG-DATES]   dateRange: '${dateRange}'`);
    console.log(`[DEBUG-DATES]   startDate: '${startDate}'`);
    console.log(`[DEBUG-DATES]   endDate: '${endDate}'`);
    console.log(`[DEBUG-DATES] Current server time: ${new Date().toISOString()}`);
    
    if (dateRange && dateRange !== 'all' && !startDate && !endDate) {
      console.log(`[DEBUG-DATES] Processing dateRange: '${dateRange}'`);
      const dateRangeResult = getDateRangeFromFilter(dateRange);
      processedStartDate = dateRangeResult.startDate;
      processedEndDate = dateRangeResult.endDate;
      console.log(`[DEBUG-DATES] Date range '${dateRange}' converted to:`);
      console.log(`[DEBUG-DATES]   Start: ${processedStartDate}`);
      console.log(`[DEBUG-DATES]   End: ${processedEndDate}`);
      
      // Validate the dates
      if (processedStartDate) {
        const testStart = new Date(processedStartDate);
        console.log(`[DEBUG-DATES]   Start date validation: ${testStart.toISOString()}`);
      }
      if (processedEndDate) {
        const testEnd = new Date(processedEndDate);
        console.log(`[DEBUG-DATES]   End date validation: ${testEnd.toISOString()}`);
      }
    } else if (dateRange === 'all') {
      console.log(`[DEBUG-DATES] 'All Time' selected - clearing date filters`);
      processedStartDate = null;
      processedEndDate = null;
    }
    
    console.log(`[DEBUG-DATES] Final processed dates:`);
    console.log(`[DEBUG-DATES]   startDate: ${processedStartDate ? `'${processedStartDate}'` : 'null'}`);
    console.log(`[DEBUG-DATES]   endDate: ${processedEndDate ? `'${processedEndDate}'` : 'null'}`);
    console.log(`[DEBUG-DATES] ========== DATE PROCESSING END ==========`);

    // Validate and parse query parameters
    const options = {
      page: Math.max(1, parseInt(page)),
      pageSize: Math.min(50000, Math.max(1, parseInt(pageSize))), // Max 50000 per page for exports
      sortBy: sortBy,
      sortOrder: sortOrder.toUpperCase(),
      search: search,
      startDate: processedStartDate,
      endDate: processedEndDate,
      // Flatten filters directly into options for combined call logs service
      ...Object.keys(filters).reduce((acc, key) => {
        // Exclude the _t timestamp parameter from filters
        if (filters[key] && key !== '_t') {
          acc[key] = filters[key];
        }
        return acc;
      }, {})
    };

    // NO CACHING - Set headers to prevent any caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    // Always fetch fresh data from MongoDB (no caching)
    console.log('[API-COMBINED] Fetching fresh combined call logs from MongoDB (no cache)...');
    console.log('[API-COMBINED] Options being passed to service:', JSON.stringify(options, null, 2));
    
    const result = await mongoCombinedCallLogsService.getCombinedCallLogs(options);
    
    console.log('[API-COMBINED] ========== RESPONSE SUMMARY ==========');
    console.log('[API-COMBINED] Total records found:', result.total);
    console.log('[API-COMBINED] Incoming count:', result.incomingCount);
    console.log('[API-COMBINED] Outgoing count:', result.outgoingCount);
    console.log('[API-COMBINED] Data array length:', result.data?.length || 0);
    console.log('[API-COMBINED] Expected values - All: 42787, Today: 395, Last 30: 32927, Last 90: 42786');
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error in /api/call-logs:', error);
    next(error);
  }
});

// Filter options endpoint for combined call logs
app.get('/api/call-logs/filters/:field', async (req, res, next) => {
  try {
    const { field } = req.params;
    
    // Validate field name to prevent injection
    const allowedFields = ['Status', 'CallType', 'Sentiment', 'Trunk', 'AreaCode', 'CompanyCode'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid field name'
      });
    }

    // NO CACHING - Set headers to prevent any caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    const options = await mongoCombinedCallLogsService.getFilterOptions(field);
    
    res.json({
      success: true,
      field,
      options
    });
  } catch (error) {
    console.error(`Error fetching combined filter options:`, error);
    next(error);
  }
});

// OUTGOING CALLS ENDPOINTS
// =========================

// Outgoing calls endpoint with query optimization
app.get('/api/outgoing-calls', async (req, res, next) => {
  try {
    const {
      page = '1',
      pageSize = '50',
      sortBy = 'CallTime',
      sortOrder = 'DESC',
      search = '',
      startDate,
      endDate,
      ...filters
    } = req.query;

    // Validate and parse query parameters
    const options = {
      page: Math.max(1, parseInt(page)),
      pageSize: Math.min(50000, Math.max(1, parseInt(pageSize))), // Max 50000 per page for exports
      sortBy: sortBy,
      sortOrder: sortOrder.toUpperCase(),
      search: search,
      startDate: startDate,
      endDate: endDate,
      ...Object.keys(filters).reduce((acc, key) => {
        // Exclude the _t timestamp parameter from filters
        if (filters[key] && key !== '_t') {
          acc[key] = filters[key];
        }
        return acc;
      }, {})
    };

    // NO CACHING - Set headers to prevent any caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    // Always fetch fresh data from MongoDB (no caching)
    console.log('[API-OUTGOING] Fetching fresh real-time data from MongoDB (no cache)...');
    const result = await mongoOutgoingCallsService.fetchOutgoingCalls(options);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error in /api/outgoing-calls:', error);
    next(error);
  }
});

// Optimized CSV Import endpoint for outgoing calls with real-time progress streaming
app.post('/api/outgoing-calls/import-optimized', upload.single('file'), async (req, res, next) => {
  try {
    let csvContent;
    let config = {};
    
    // Check if file was uploaded
    if (req.file) {
      // File upload mode - using memory storage
      csvContent = req.file.buffer.toString('utf-8');
      
      // Parse configuration from form data with ROCKET SPEED defaults
      config = {
        batchSize: parseInt(req.body.batchSize) || 1000,
        workerPoolSize: parseInt(req.body.workerPoolSize) || 4,
        maxConcurrentBatches: parseInt(req.body.maxConcurrentBatches) || 5,
        enableProfiling: req.body.enableProfiling !== 'false',
        rocketMode: req.body.rocketMode !== 'false',
        enableStreaming: req.body.enableStreaming !== 'false'
      };
      
      // No file cleanup needed with memory storage
    } else if (req.body.csvContent) {
      // JSON mode (backward compatibility)
      csvContent = req.body.csvContent;
      config = req.body.config || {};
    } else {
      return res.status(400).json({
        success: false,
        error: 'CSV content or file is required'
      });
    }
    
    // Check if client wants streaming response
    const wantsStreaming = config.enableStreaming && req.headers.accept && req.headers.accept.includes('application/x-ndjson');
    
    console.log('[IMPORT-OUTGOING] Streaming check:', {
      enableStreaming: config.enableStreaming,
      acceptHeader: req.headers.accept,
      wantsStreaming: wantsStreaming
    });
    
    if (wantsStreaming) {
      console.log('[IMPORT-OUTGOING] Setting up streaming response...');
      // Set up streaming response
      res.writeHead(200, {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      
      // Progress callback for real-time updates
      const progressCallback = (progressData) => {
        const progressLine = JSON.stringify(progressData) + '\n';
        res.write(progressLine);
      };
      
      console.log('[STREAMING IMPORT-OUTGOING] Starting real-time CSV import with streaming...');
      console.log('[STREAMING IMPORT-OUTGOING] Configuration:', config);
      const startTime = Date.now();
      
      // Send initial progress
      progressCallback({
        recordsFound: 0,
        created: 0,
        updated: 0,
        failed: 0,
        step: 'scanning',
        progress: 0
      });
      
      // Parse CSV content
      const lines = csvContent.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const records = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const record = {};
        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });
        records.push(record);
      }
      
      // Process records with real-time progress streaming
      const result = await mongoOutgoingCallsService.bulkUpsertOutgoingCalls(records, progressCallback);
      
      const totalTime = Date.now() - startTime;
      console.log(`[STREAMING IMPORT-OUTGOING] Completed in ${totalTime}ms`);
      
      // Send final result
      const finalResult = {
        recordsFound: result.total,
        created: result.created,
        updated: result.updated,
        failed: result.failed,
        step: 'complete',
        progress: 100,
        performance: {
          totalTime: totalTime,
          throughput: Math.round((result.total / totalTime) * 1000),
          totalRows: result.total
        },
        message: `Import completed in ${(totalTime/1000).toFixed(2)}s - Created: ${result.created}, Updated: ${result.updated}, Failed: ${result.failed}`
      };
      
      res.write(JSON.stringify(finalResult) + '\n');
      res.end();
    } else {
      // Regular JSON response (backward compatibility)
      console.log('[OPTIMIZED IMPORT-OUTGOING] Starting high-performance CSV import...');
      console.log('[OPTIMIZED IMPORT-OUTGOING] Configuration:', config);
      const startTime = Date.now();
      
      // Parse CSV content
      const lines = csvContent.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const records = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const record = {};
        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });
        records.push(record);
      }
      
      // Process records
      const result = await mongoOutgoingCallsService.bulkUpsertOutgoingCalls(records);
      
      const totalTime = Date.now() - startTime;
      console.log(`[OPTIMIZED IMPORT-OUTGOING] Completed in ${totalTime}ms`);
      
      res.json({
        success: result.failed === 0,
        total: result.total,
        created: result.created,
        updated: result.updated,
        failed: result.failed,
        performance: {
          totalTime: totalTime,
          throughput: Math.round((result.total / totalTime) * 1000),
          totalRows: result.total
        },
        message: `Import completed in ${(totalTime/1000).toFixed(2)}s - Created: ${result.created}, Updated: ${result.updated}, Failed: ${result.failed}`
      });
    }
  } catch (error) {
    console.error('Error in outgoing calls import:', error);
    
    // No file cleanup needed with memory storage
    
    if (res.headersSent) {
      // If streaming, send error as final message
      res.write(JSON.stringify({ error: error.message || 'Failed to import CSV data' }) + '\n');
      res.end();
    } else {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to import CSV data'
      });
    }
  }
});

// Clear all outgoing calls data endpoint
app.delete('/api/outgoing-calls/clear-all', async (req, res, next) => {
  try {
    console.log('WARNING: Clear all outgoing calls data request received');
    
    // Add a safety check
    const { confirm } = req.body;
    if (confirm !== 'DELETE_ALL_DATA') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required. Send { "confirm": "DELETE_ALL_DATA" } in request body.'
      });
    }
    
    const result = await mongoOutgoingCallsService.clearAllData();
    
    if (result.success) {
      res.json({
        success: true,
        message: `Cleared ${result.deletedCount} outgoing call records`,
        deletedCount: result.deletedCount
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error clearing outgoing calls data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear outgoing calls data'
    });
  }
});

// AREA CODES ENDPOINTS
// ====================

// Area codes endpoint with query optimization
app.get('/api/area-codes', async (req, res, next) => {
  try {
    const {
      page = '1',
      pageSize = '50',
      sortBy = 'AreaCode',
      sortOrder = 'ASC',
      search = '',
      ...filters
    } = req.query;

    // Validate and parse query parameters
    const options = {
      page: Math.max(1, parseInt(page)),
      pageSize: Math.min(50000, Math.max(1, parseInt(pageSize))), // Max 50000 per page for exports
      sortBy: sortBy,
      sortOrder: sortOrder.toUpperCase(),
      search: search,
      ...Object.keys(filters).reduce((acc, key) => {
        // Exclude the _t timestamp parameter from filters
        if (filters[key] && key !== '_t') {
          acc[key] = filters[key];
        }
        return acc;
      }, {})
    };

    // NO CACHING - Set headers to prevent any caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    // Always fetch fresh data from MongoDB (no caching)
    console.log('[API-AREACODES] Fetching fresh real-time data from MongoDB (no cache)...');
    const result = await mongoAreaCodesService.fetchAreaCodes(options);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error in /api/area-codes:', error);
    next(error);
  }
});

// Optimized CSV Import endpoint for area codes with real-time progress streaming
app.post('/api/area-codes/import-optimized', upload.single('file'), async (req, res, next) => {
  try {
    let csvContent;
    let config = {};
    
    // Check if file was uploaded
    if (req.file) {
      // File upload mode - using memory storage
      csvContent = req.file.buffer.toString('utf-8');
      
      // Parse configuration from form data with ROCKET SPEED defaults
      config = {
        batchSize: parseInt(req.body.batchSize) || 1000,
        workerPoolSize: parseInt(req.body.workerPoolSize) || 4,
        maxConcurrentBatches: parseInt(req.body.maxConcurrentBatches) || 5,
        enableProfiling: req.body.enableProfiling !== 'false',
        rocketMode: req.body.rocketMode !== 'false',
        enableStreaming: req.body.enableStreaming !== 'false'
      };
      
      // No file cleanup needed with memory storage
    } else if (req.body.csvContent) {
      // JSON mode (backward compatibility)
      csvContent = req.body.csvContent;
      config = req.body.config || {};
    } else {
      return res.status(400).json({
        success: false,
        error: 'CSV content or file is required'
      });
    }
    
    // Check if client wants streaming response
    const wantsStreaming = config.enableStreaming && req.headers.accept && req.headers.accept.includes('application/x-ndjson');
    
    console.log('[IMPORT-AREACODES] Streaming check:', {
      enableStreaming: config.enableStreaming,
      acceptHeader: req.headers.accept,
      wantsStreaming: wantsStreaming
    });
    
    if (wantsStreaming) {
      console.log('[IMPORT-AREACODES] Setting up streaming response...');
      // Set up streaming response
      res.writeHead(200, {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      
      // Progress callback for real-time updates
      const progressCallback = (progressData) => {
        const progressLine = JSON.stringify(progressData) + '\n';
        res.write(progressLine);
      };
      
      console.log('[STREAMING IMPORT-AREACODES] Starting real-time CSV import with streaming...');
      console.log('[STREAMING IMPORT-AREACODES] Configuration:', config);
      const startTime = Date.now();
      
      // Send initial progress
      progressCallback({
        recordsFound: 0,
        created: 0,
        updated: 0,
        failed: 0,
        step: 'scanning',
        progress: 0
      });
      
      // Parse CSV content
      const lines = csvContent.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const records = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const record = {};
        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });
        records.push(record);
      }
      
      // Process records with real-time progress streaming
      const result = await mongoAreaCodesService.bulkUpsertAreaCodes(records, progressCallback);
      
      const totalTime = Date.now() - startTime;
      console.log(`[STREAMING IMPORT-AREACODES] Completed in ${totalTime}ms`);
      
      // Send final result
      const finalResult = {
        recordsFound: result.total,
        created: result.created,
        updated: result.updated,
        failed: result.failed,
        step: 'complete',
        progress: 100,
        performance: {
          totalTime: totalTime,
          throughput: Math.round((result.total / totalTime) * 1000),
          totalRows: result.total
        },
        message: `Import completed in ${(totalTime/1000).toFixed(2)}s - Created: ${result.created}, Updated: ${result.updated}, Failed: ${result.failed}`
      };
      
      res.write(JSON.stringify(finalResult) + '\n');
      res.end();
    } else {
      // Regular JSON response (backward compatibility)
      console.log('[OPTIMIZED IMPORT-AREACODES] Starting high-performance CSV import...');
      console.log('[OPTIMIZED IMPORT-AREACODES] Configuration:', config);
      const startTime = Date.now();
      
      // Parse CSV content
      const lines = csvContent.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const records = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const record = {};
        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });
        records.push(record);
      }
      
      // Process records
      const result = await mongoAreaCodesService.bulkUpsertAreaCodes(records);
      
      const totalTime = Date.now() - startTime;
      console.log(`[OPTIMIZED IMPORT-AREACODES] Completed in ${totalTime}ms`);
      
      res.json({
        success: result.failed === 0,
        total: result.total,
        created: result.created,
        updated: result.updated,
        failed: result.failed,
        performance: {
          totalTime: totalTime,
          throughput: Math.round((result.total / totalTime) * 1000),
          totalRows: result.total
        },
        message: `Import completed in ${(totalTime/1000).toFixed(2)}s - Created: ${result.created}, Updated: ${result.updated}, Failed: ${result.failed}`
      });
    }
  } catch (error) {
    console.error('Error in area codes import:', error);
    
    // No file cleanup needed with memory storage
    
    if (res.headersSent) {
      // If streaming, send error as final message
      res.write(JSON.stringify({ error: error.message || 'Failed to import CSV data' }) + '\n');
      res.end();
    } else {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to import CSV data'
      });
    }
  }
});

// Clear all area codes data endpoint
app.delete('/api/area-codes/clear-all', async (req, res, next) => {
  try {
    console.log('WARNING: Clear all area codes data request received');
    
    // Add a safety check
    const { confirm } = req.body;
    if (confirm !== 'DELETE_ALL_DATA') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required. Send { "confirm": "DELETE_ALL_DATA" } in request body.'
      });
    }
    
    const result = await mongoAreaCodesService.clearAllData();
    
    if (result.success) {
      res.json({
        success: true,
        message: `Cleared ${result.deletedCount} area code records`,
        deletedCount: result.deletedCount
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error clearing area codes data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear area codes data'
    });
  }
});

// USERS ENDPOINTS
// ===============

// Users endpoint with query optimization
app.get('/api/users', async (req, res, next) => {
  try {
    const {
      page = '1',
      pageSize = '50',
      sortBy = 'FirstName',
      sortOrder = 'ASC',
      search = '',
      ...filters
    } = req.query;

    // Validate and parse query parameters
    const options = {
      page: Math.max(1, parseInt(page)),
      pageSize: Math.min(50000, Math.max(1, parseInt(pageSize))), // Max 50000 per page for exports
      sortBy: sortBy,
      sortOrder: sortOrder.toUpperCase(),
      search: search,
      ...Object.keys(filters).reduce((acc, key) => {
        // Exclude the _t timestamp parameter from filters
        if (filters[key] && key !== '_t') {
          acc[key] = filters[key];
        }
        return acc;
      }, {})
    };

    // NO CACHING - Set headers to prevent any caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    // Always fetch fresh data from MongoDB (no caching)
    console.log('[API-USERS] Fetching fresh real-time data from MongoDB (no cache)...');
    const result = await mongoUsersService.fetchUsers(options);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error in /api/users:', error);
    next(error);
  }
});

// Create user endpoint
app.post('/api/users', async (req, res, next) => {
  try {
    const userData = req.body;
    
    console.log('[API-USERS] Creating new user...');
    const result = await mongoUsersService.createUser(userData);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create user'
    });
  }
});

// Get user by ID endpoint
app.get('/api/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    console.log('[API-USERS] Fetching user by ID:', id);
    const result = await mongoUsersService.getUserById(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user'
    });
  }
});

// Update user endpoint
app.put('/api/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userData = req.body;
    
    console.log('[API-USERS] Updating user:', id);
    const result = await mongoUsersService.updateUser(id, userData);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update user'
    });
  }
});

// Delete user endpoint
app.delete('/api/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    console.log('[API-USERS] Deleting user:', id);
    const result = await mongoUsersService.deleteUser(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete user'
    });
  }
});

// AUTHENTICATION ENDPOINTS
// ========================

// Login endpoint
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    console.log('[AUTH] Login attempt for email:', email);
    
    // Find user by email (including password for verification)
    const userResult = await mongoUsersService.getUserByEmailWithPassword(email);
    
    if (!userResult.success) {
      console.log('[AUTH] User not found:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    const user = userResult.user;
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.Password);
    
    if (!isValidPassword) {
      console.log('[AUTH] Invalid password for user:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    console.log('[AUTH] Login successful for user:', email);
    
    // Return user data without password
    const { Password, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      user: userWithoutPassword,
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
});

// ACCOUNT MANAGEMENT ENDPOINTS
// ============================

// RECORD COUNTS ENDPOINT
// ======================

// Record counts endpoint - returns counts for all collections
app.get('/api/record-counts', async (req, res, next) => {
  try {
    console.log('[API-RECORD-COUNTS] Fetching record counts from all collections...');

    // NO CACHING - Set headers to prevent any caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    // Fetch counts from all collections in parallel
    const [
      incomingResult,
      outgoingResult,
      areaCodesResult,
      usersResult,
      combinedResult
    ] = await Promise.allSettled([
      mongoInboundCallsService.getInboundCalls({ page: 1, pageSize: 1 }),
      mongoOutgoingCallsService.fetchOutgoingCalls({ page: 1, pageSize: 1 }),
      mongoAreaCodesService.fetchAreaCodes({ page: 1, pageSize: 1 }),
      mongoUsersService.fetchUsers({ page: 1, pageSize: 1 }),
      mongoCombinedCallLogsService.getCombinedCallLogs({ page: 1, pageSize: 1 })
    ]);

    // Extract counts from results
    const counts = {
      incoming: incomingResult.status === 'fulfilled' ? (incomingResult.value.total || 0) : 0,
      outgoing: outgoingResult.status === 'fulfilled' ? (outgoingResult.value.total || 0) : 0,
      areaCodes: areaCodesResult.status === 'fulfilled' ? (areaCodesResult.value.total || 0) : 0,
      users: usersResult.status === 'fulfilled' ? (usersResult.value.total || 0) : 0,
      callLogs: combinedResult.status === 'fulfilled' ? (combinedResult.value.total || 0) : 0
    };

    console.log('[API-RECORD-COUNTS] Record counts:', counts);

    res.json({
      success: true,
      data: counts
    });
  } catch (error) {
    console.error('Error fetching record counts:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch record counts',
      data: {
        callLogs: 0,
        incoming: 0,
        outgoing: 0,
        areaCodes: 0,
        users: 0
      }
    });
  }
});

// Import account routes
const accountRoutes = require('./routes/account.cjs');
app.use('/api/account', accountRoutes);

// Mount enterprise routes - commented out for now since we're focusing on basic MongoDB functionality
// app.use('/api/inbound-calls', enterpriseRoutes);

// Clear all data endpoint (DANGEROUS - deletes all records)
app.delete('/api/inbound-calls/clear-all', async (req, res, next) => {
  try {
    console.log('WARNING: Clear all data request received');
    
    // Add a safety check - could require a confirmation token in production
    const { confirm } = req.body;
    if (confirm !== 'DELETE_ALL_DATA') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required. Send { "confirm": "DELETE_ALL_DATA" } in request body.'
      });
    }
    
    const result = await mongoInboundCallsService.clearAllData();
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        deletedCount: result.deletedCount
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        deletedCount: result.deletedCount
      });
    }
  } catch (error) {
    console.error('Error clearing all data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear data'
    });
  }
});

// Serve static files from the React build directory
// This comes after all API routes to ensure API routes take precedence
const clientDistPath = process.env.VERCEL
  ? path.join(__dirname, '../client/dist')  // Vercel deployment
  : path.join(__dirname, '../client/dist'); // Local development

app.use(express.static(clientDistPath, {
  maxAge: '1y', // Cache static assets for 1 year
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Don't cache HTML files to ensure fresh content
    if (path.extname(filePath) === '.html') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Catch-all route for React Router - serves index.html for all non-API routes
// This MUST come after all API routes and static middleware to ensure they take precedence
app.use((req, res, next) => {
  // Skip if it's an API route
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'API endpoint not found'
    });
  }
  
  // Serve the React app's index.html for all other routes
  const indexPath = process.env.VERCEL
    ? path.join(__dirname, '../client/dist/index.html')  // Vercel deployment
    : path.join(__dirname, '../client/dist/index.html'); // Local development
    
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving React app:', err);
      console.error('Attempted path:', indexPath);
      res.status(500).json({
        success: false,
        error: 'Failed to serve application'
      });
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server only when running locally (not on Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 API Server running on http://localhost:${PORT}`);
    console.log(`📊 MongoDB Database: ${process.env.MONGODB_DATABASE || '3cx'}`);
    console.log(`📋 Incoming Calls Collection: ${process.env.MONGODB_COLLECTION || 'tblIncomingCalls'}`);
    console.log(`📤 Outgoing Calls Collection: ${process.env.MONGODB_OUT_COLLECTION || 'tblOutgoingCalls'}`);
    console.log(`📍 Area Codes Collection: ${process.env.MONGODB_AREACODES_COLLECTION || 'tblAreaCodes'}`);
    console.log(`👥 Users Collection: ${process.env.MONGODB_USERS_COLLECTION || 'tblUsers'}`);
  });

  // Graceful shutdown (only for local development)
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
  });
}

// Export the Express app for Vercel serverless deployment
module.exports = app;