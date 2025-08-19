const { getCollection, initializeMongoDB } = require('../config/mongodb.cjs');
const mongoose = require('mongoose');

// Define the schema for incoming calls using CommonJS
const incomingCallSchema = new mongoose.Schema({
  _id: {
    type: String,  // Allow custom string IDs instead of ObjectId
    required: true
  },
  CallTime: {
    type: Date,
    required: true,
    index: true
  },
  CallerID: {
    type: String,
    required: true,
    index: true
  },
  Destination: {
    type: String,
    default: '',
    index: true
  },
  Trunk: {
    type: String,
    default: '',
    index: true
  },
  TrunkNumber: {
    type: String,
    default: '0'
  },
  DID: {
    type: String,
    default: ''
  },
  Status: {
    type: String,
    default: '',
    index: true
  },
  Ringing: {
    type: String,
    default: '0'
  },
  Talking: {
    type: String,
    default: '0'
  },
  TotalDuration: {
    type: String,
    default: '0'
  },
  CallType: {
    type: String,
    default: '',
    index: true
  },
  Sentiment: {
    type: String,
    default: '',
    index: true
  },
  Summary: {
    type: String,
    default: ''
  },
  Transcription: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'tblIncomingCalls'
});

// Create compound indexes for better query performance
incomingCallSchema.index({ CallTime: -1, CallerID: 1, Status: 1 }, { name: 'calltime_callerid_status_compound' });
incomingCallSchema.index({ CallTime: -1 }, { name: 'calltime_desc' });

// Create text index for search functionality
incomingCallSchema.index({
  CallerID: 'text',
  Destination: 'text',
  Trunk: 'text',
  Status: 'text',
  CallType: 'text',
  Sentiment: 'text',
  Summary: 'text',
  Transcription: 'text'
}, { name: 'search_text' });

// Create the model
const IncomingCall = mongoose.model('IncomingCall', incomingCallSchema);

// NO CACHING - Removed all caching functionality for real-time data

class MongoInboundCallsService {
  constructor() {
    this.initialized = false;
    this.initializeConnection();
  }

  async initializeConnection() {
    try {
      if (!this.initialized) {
        await initializeMongoDB();
        this.initialized = true;
        console.log('✅ MongoInboundCallsService initialized');
      }
    } catch (error) {
      console.error('❌ Failed to initialize MongoDB connection:', error);
      throw error;
    }
  }

  /**
   * Get paginated inbound calls with optimized query
   */
  async getInboundCalls(options = {}) {
    await this.initializeConnection();

    const {
      page = 1,
      pageSize = 50,
      sortBy = 'CallTime',
      sortOrder = 'DESC',
      search = '',
      filters = {},
      startDate,
      endDate
    } = options;

    // NO CACHING - Always fetch fresh data for real-time updates
    console.log('Fetching fresh data from MongoDB (no cache)');

    try {
      // Build query
      let query = {};

      // Date range filter
      if (startDate || endDate) {
        query.CallTime = {};
        if (startDate) {
          query.CallTime.$gte = new Date(startDate);
        }
        if (endDate) {
          query.CallTime.$lte = new Date(endDate);
        }
      }

      // Search across multiple fields
      if (search && search.trim() !== '') {
        query.$text = { $search: search.trim() };
      }

      // Apply additional filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          // Handle comma-separated values for multi-select filters
          if (typeof value === 'string' && value.includes(',')) {
            // Split comma-separated values and use $in operator
            const values = value.split(',').map(v => v.trim()).filter(v => v !== '');
            if (values.length > 1) {
              query[key] = { $in: values };
            } else if (values.length === 1) {
              query[key] = values[0];
            }
          } else {
            query[key] = value;
          }
        }
      });

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder.toUpperCase() === 'ASC' ? 1 : -1;

      // Calculate skip value
      const skip = (page - 1) * pageSize;

      // Execute query with pagination
      const [data, total] = await Promise.all([
        IncomingCall.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(pageSize)
          .lean(), // Use lean() for better performance
        IncomingCall.countDocuments(query)
      ]);

      // Transform data to match expected format
      const transformedResult = {
        data: data.map(row => ({
          CallTime: row.CallTime,
          CallerID: row.CallerID || '',
          Destination: row.Destination || '',
          Trunk: row.Trunk || '',
          TrunkNumber: row.TrunkNumber || '',
          DID: row.DID || '',
          Status: row.Status || '',
          Ringing: row.Ringing || '',
          Talking: row.Talking || '',
          TotalDuration: row.TotalDuration || '',
          CallType: row.CallType || '',
          Sentiment: row.Sentiment || '',
          Summary: row.Summary || '',
          Transcription: row.Transcription || ''
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };

      // NO CACHING - Return fresh data directly
      return transformedResult;
    } catch (error) {
      console.error('Error fetching inbound calls from MongoDB:', error);
      throw new Error('Failed to fetch inbound calls from MongoDB');
    }
  }

  /**
   * Get distinct values for filters (cached)
   */
  async getFilterOptions(field) {
    await this.initializeConnection();

    // NO CACHING - Always fetch fresh filter options
    console.log(`Fetching fresh filter options for ${field} (no cache)`);

    try {
      const values = await IncomingCall.distinct(field, { [field]: { $ne: null, $ne: '' } });
      const sortedValues = values.sort();
      // NO CACHING - Return fresh filter options directly
      return sortedValues;
    } catch (error) {
      console.error(`Error fetching filter options for ${field}:`, error);
      return [];
    }
  }

  /**
   * Insert or update a single inbound call record with deduplication
   * Uses composite key (CallTime + CallerID + Status) to prevent duplicates
   */
  async insertInboundCall(record) {
    await this.initializeConnection();

    try {
      // Prepare the record for insertion
      const callTime = record.CallTime ? new Date(record.CallTime) : null;
      const callerID = record.CallerID || null;
      const status = record.Status || '';
      
      // Create composite key for deduplication
      if (!callTime || !callerID) {
        console.log('Missing required fields for composite key (CallTime or CallerID)');
        return { success: false, error: 'Missing required fields' };
      }

      // Create ROBUST custom document ID from CallTime + CallerID + Status
      // Use a more stable format without milliseconds and normalize all components
      const normalizedCallTime = callTime.toISOString().split('.')[0] + 'Z'; // Remove milliseconds
      const normalizedCallerID = String(callerID).trim().replace(/[^a-zA-Z0-9+\-]/g, '_'); // Sanitize CallerID
      const normalizedStatus = String(status).trim().replace(/[^a-zA-Z0-9]/g, '_'); // Sanitize Status
      const customId = `${normalizedCallTime}_${normalizedCallerID}_${normalizedStatus}`;

      // Use upsert with custom _id to prevent duplicates
      const filter = { _id: customId };
      const update = {
        $set: {
          _id: customId,
          CallTime: callTime,
          CallerID: String(callerID),
          Destination: record.Destination ? String(record.Destination) : '',
          Trunk: record.Trunk ? String(record.Trunk) : '',
          TrunkNumber: record.TrunkNumber ? String(record.TrunkNumber) : '0',
          DID: record.DID ? String(record.DID) : '',
          Status: record.Status ? String(record.Status) : '',
          Ringing: record.Ringing ? String(record.Ringing) : '0',
          Talking: record.Talking ? String(record.Talking) : '0',
          TotalDuration: record.TotalDuration ? String(record.TotalDuration) : '0',
          CallType: record.CallType ? String(record.CallType) : '',
          Sentiment: record.Sentiment ? String(record.Sentiment) : '',
          Summary: record.Summary ? String(record.Summary) : '',
          Transcription: record.Transcription ? String(record.Transcription) : ''
        }
      };

      // Use native MongoDB collection instead of Mongoose model to avoid _id casting issues
      const { getCollection } = require('../config/mongodb.cjs');
      const collection = getCollection();
      const result = await collection.replaceOne(filter, update.$set, { upsert: true });
      
      const action = result.upsertedCount > 0 ? 'created' : 'updated';
      console.log(`Successfully ${action} record in MongoDB (ID: ${customId})`);
      
      return { success: true, action };
    } catch (error) {
      console.error('Error inserting/updating record in MongoDB:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Batch insert inbound calls with optimized MongoDB operations and real-time progress
   */
  async batchInsertInboundCalls(records, rocketMode = true, progressCallback = null) {
    await this.initializeConnection();

    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    if (!records || records.length === 0) {
      return results;
    }

    try {
      if (rocketMode) {
        // ROCKET MODE: Use bulk operations for maximum speed with real-time progress
        console.log(`[ROCKET-INSERT] Processing ${records.length} records with bulk operations`);
        return await this.rocketBulkInsert(records, progressCallback);
      } else {
        // Conservative mode: Process records individually with real-time progress
        console.log(`[BATCH-INSERT] Processing ${records.length} records individually`);
        return await this.conservativeInsert(records, progressCallback);
      }
    } catch (error) {
      console.error('[BATCH-INSERT] Error in batch insert:', error);
      results.failed = records.length;
      results.errors.push(error.message);
      return results;
    }
  }

  /**
   * ROCKET MODE: Ultra-fast bulk upsert with correct Created/Updated logic and real-time progress
   */
  async rocketBulkInsert(records, progressCallback = null) {
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    console.log(`[ROCKET-BULK] Processing ${records.length} records with bulk upsert operations`);
    const startTime = Date.now();

    // Prepare bulk operations using replaceOne with upsert for correct Created/Updated logic
    const bulkOps = [];
    
    for (const record of records) {
      const callTime = record.CallTime ? new Date(record.CallTime) : null;
      const callerID = record.CallerID || null;
      const status = record.Status || '';
      
      // Skip records without required fields
      if (!callTime || !callerID) {
        results.failed++;
        results.errors.push(`Missing required fields for record: ${JSON.stringify(record)}`);
        continue;
      }

      // Create ROBUST custom document ID from CallTime + CallerID + Status
      // Use a more stable format without milliseconds and normalize all components
      const normalizedCallTime = callTime.toISOString().split('.')[0] + 'Z'; // Remove milliseconds
      const normalizedCallerID = String(callerID).trim().replace(/[^a-zA-Z0-9+\-]/g, '_'); // Sanitize CallerID
      const normalizedStatus = String(status).trim().replace(/[^a-zA-Z0-9]/g, '_'); // Sanitize Status
      const customId = `${normalizedCallTime}_${normalizedCallerID}_${normalizedStatus}`;
      
      // Debug logging for first few records
      if (bulkOps.length < 3) {
        console.log(`[ROCKET-BULK] Record ${bulkOps.length + 1}:`, {
          originalCallTime: record.CallTime,
          parsedCallTime: callTime.toISOString(),
          normalizedCallTime: normalizedCallTime,
          originalCallerID: record.CallerID,
          normalizedCallerID: normalizedCallerID,
          originalStatus: record.Status,
          normalizedStatus: normalizedStatus,
          customId: customId
        });
      }

      // Use replaceOne with upsert to get correct Created/Updated counts
      bulkOps.push({
        replaceOne: {
          filter: { _id: customId },
          replacement: {
            _id: customId,
            CallTime: callTime,
            CallerID: String(callerID),
            Destination: record.Destination ? String(record.Destination) : '',
            Trunk: record.Trunk ? String(record.Trunk) : '',
            TrunkNumber: record.TrunkNumber ? String(record.TrunkNumber) : '0',
            DID: record.DID ? String(record.DID) : '',
            Status: record.Status ? String(record.Status) : '',
            Ringing: record.Ringing ? String(record.Ringing) : '0',
            Talking: record.Talking ? String(record.Talking) : '0',
            TotalDuration: record.TotalDuration ? String(record.TotalDuration) : '0',
            CallType: record.CallType ? String(record.CallType) : '',
            Sentiment: record.Sentiment ? String(record.Sentiment) : '',
            Summary: record.Summary ? String(record.Summary) : '',
            Transcription: record.Transcription ? String(record.Transcription) : ''
          },
          upsert: true
        }
      });
    }

    if (bulkOps.length === 0) {
      console.log('[ROCKET-BULK] No valid records to process');
      return results;
    }

    try {
      // Execute bulk operations using native MongoDB collection
      console.log(`[ROCKET-BULK] Executing bulk upsert operations for ${bulkOps.length} records`);
      
      // Use native MongoDB collection for bulk operations
      const { getCollection } = require('../config/mongodb.cjs');
      const collection = getCollection();
      
      try {
        const bulkResult = await collection.bulkWrite(bulkOps, { ordered: false });
        
        const executionTime = Date.now() - startTime;
        
        // SMART Created/Updated logic using upsert results
        results.created = bulkResult.upsertedCount || 0; // New records created
        results.updated = bulkResult.modifiedCount || 0; // Existing records updated
        
        // Handle the case where records exist but no changes were made (matched but not modified)
        const matchedButNotModified = (bulkResult.matchedCount || 0) - (bulkResult.modifiedCount || 0);
        if (matchedButNotModified > 0) {
          console.log(`[ROCKET-BULK] ${matchedButNotModified} records matched but not modified (no changes detected)`);
          // Count these as "updated" since they were processed successfully
          results.updated += matchedButNotModified;
        }
        
        // Calculate successful operations
        const successfulOps = results.created + results.updated;
        results.failed = Math.max(0, bulkOps.length - successfulOps); // Failed operations (never negative)
        
        console.log(`[ROCKET-BULK] Raw bulk result:`, {
          insertedCount: bulkResult.insertedCount,
          matchedCount: bulkResult.matchedCount,
          modifiedCount: bulkResult.modifiedCount,
          deletedCount: bulkResult.deletedCount,
          upsertedCount: bulkResult.upsertedCount,
          upsertedIds: Object.keys(bulkResult.upsertedIds || {}).length,
          writeErrors: bulkResult.writeErrors ? bulkResult.writeErrors.length : 0,
          matchedButNotModified: matchedButNotModified
        });
        
        // Log any write errors for debugging
        if (bulkResult.writeErrors && bulkResult.writeErrors.length > 0) {
          console.error(`[ROCKET-BULK] Write errors detected:`, bulkResult.writeErrors.slice(0, 5));
          results.errors.push(...bulkResult.writeErrors.slice(0, 10).map(err => err.errmsg));
          // Adjust failed count based on actual write errors
          results.failed = bulkResult.writeErrors.length;
          const actualSuccessful = bulkOps.length - results.failed;
          if (actualSuccessful !== successfulOps) {
            console.log(`[ROCKET-BULK] Adjusting counts based on write errors - Successful: ${actualSuccessful}, Failed: ${results.failed}`);
          }
        }
        
        console.log(`[ROCKET-BULK] Successfully processed ${bulkOps.length} records in ${executionTime}ms`);
        console.log(`[ROCKET-BULK] SMART COUNTS - Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`);
        console.log(`[ROCKET-BULK] VERIFICATION - Input: ${bulkOps.length}, Successful: ${successfulOps}, Failed: ${results.failed}`);

        return results;
      } catch (bulkError) {
        console.error(`[ROCKET-BULK] Bulk operation failed completely:`, bulkError);
        
        // Check if it's a partial failure with some successful operations
        if (bulkError.result && bulkError.result.result) {
          const partialResult = bulkError.result.result;
          results.created = partialResult.upsertedCount || 0;
          results.updated = partialResult.modifiedCount || 0;
          
          // Handle matched but not modified for partial results
          const matchedButNotModified = (partialResult.matchedCount || 0) - (partialResult.modifiedCount || 0);
          if (matchedButNotModified > 0) {
            results.updated += matchedButNotModified;
          }
          
          const successfulOps = results.created + results.updated;
          results.failed = bulkOps.length - successfulOps;
          
          console.log(`[ROCKET-BULK] Partial success after bulk error - Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`);
          return results;
        }
        
        // Complete failure
        results.failed = bulkOps.length;
        results.errors.push(bulkError.message);
        return results;
      }
    } catch (error) {
      console.error('[ROCKET-BULK] Bulk operation failed:', error);
      
      // Handle bulk write errors (some operations may have succeeded)
      if (error.result && error.result.result) {
        const partialResult = error.result.result;
        results.created = partialResult.upsertedCount || 0;
        results.updated = partialResult.modifiedCount || 0;
        results.failed = bulkOps.length - results.created - results.updated;
        
        console.log(`[ROCKET-BULK] Partial success - Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`);
        return results;
      }
      
      // Complete failure - fallback to conservative insert
      console.log('[ROCKET-BULK] Complete failure - falling back to conservative insert');
      return await this.conservativeInsert(records);
    }
  }

  /**
   * Conservative insert (process records individually) with real-time progress
   */
  async conservativeInsert(records, progressCallback = null) {
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    console.log(`[CONSERVATIVE-INSERT] Processing ${records.length} records individually`);
    const startTime = Date.now();

    for (const record of records) {
      try {
        const result = await this.insertInboundCall(record);
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
      } catch (error) {
        results.failed++;
        results.errors.push(error.message);
      }
    }

    const executionTime = Date.now() - startTime;
    console.log(`[CONSERVATIVE-INSERT] Completed in ${executionTime}ms`);
    console.log(`[CONSERVATIVE-INSERT] Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`);

    return results;
  }

  /**
   * Clear all records from the inbound calls collection
   * WARNING: This will delete ALL data from the collection
   */
  async clearAllData() {
    await this.initializeConnection();

    try {
      // Get count before deletion
      const totalRecords = await IncomingCall.countDocuments();
      console.log(`Found ${totalRecords} records to delete`);

      // Delete all records
      console.log('Executing delete operation to clear all data...');
      const result = await IncomingCall.deleteMany({});
      
      console.log(`Successfully deleted ${result.deletedCount} records from MongoDB collection`);
      
      return {
        success: true,
        message: `Successfully deleted ${result.deletedCount} records`,
        deletedCount: result.deletedCount
      };
    } catch (error) {
      console.error('Error clearing all data from MongoDB:', error);
      return { success: false, error: error.message, deletedCount: 0 };
    }
  }

  /**
   * Clear cache (no-op since caching is disabled)
   */
  clearCache() {
    // NO CACHING - This method is kept for compatibility but does nothing
    console.log('Cache clear requested - no cache to clear (real-time mode)');
  }
}

module.exports = new MongoInboundCallsService();