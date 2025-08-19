const { MongoClient } = require('mongodb');

class MongoOutgoingCallsService {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected && this.client) {
      return;
    }

    try {
      const uri = process.env.MONGODB_URI;
      if (!uri) {
        throw new Error('MONGODB_URI environment variable is not set');
      }

      console.log('[MONGO-OUTGOING] Connecting to MongoDB...');
      this.client = new MongoClient(uri);
      await this.client.connect();
      
      this.db = this.client.db(process.env.MONGODB_DATABASE || '3cx');
      this.collection = this.db.collection(process.env.MONGODB_OUT_COLLECTION || 'tblOutgoingCalls');
      this.isConnected = true;
      
      console.log('[MONGO-OUTGOING] Connected to MongoDB - tblOutgoingCalls collection');
      
      // Create indexes for better performance
      await this.createIndexes();
    } catch (error) {
      console.error('[MONGO-OUTGOING] Connection error:', error);
      throw error;
    }
  }

  async createIndexes() {
    try {
      // Create compound index for CallTime + Destination + Status (three-part composite key for outgoing calls)
      await this.collection.createIndex(
        { CallTime: 1, Destination: 1, Status: 1 },
        { name: 'idx_calltime_destination_status' }
      );
      
      // Create individual indexes for common queries - ONLY outgoing call fields
      await this.collection.createIndex({ CallTime: -1 }, { name: 'idx_calltime_desc' });
      await this.collection.createIndex({ CallerID: 1 }, { name: 'idx_callerid' });
      await this.collection.createIndex({ Status: 1 }, { name: 'idx_status' });
      await this.collection.createIndex({ Destination: 1 }, { name: 'idx_destination' });
      await this.collection.createIndex({ Trunk: 1 }, { name: 'idx_trunk' });
      await this.collection.createIndex({ CallType: 1 }, { name: 'idx_calltype' });
      
      console.log('[MONGO-OUTGOING] Indexes created successfully');
    } catch (error) {
      console.error('[MONGO-OUTGOING] Error creating indexes:', error);
    }
  }

  // Normalize values for MongoDB _id generation (three-part composite key)
  normalizeForId(value) {
    if (!value) return 'null';
    return String(value)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase() || 'null';
  }

  // Generate three-part composite key: CallTime + Destination + Status (for outgoing calls)
  generateCompositeId(callTime, destination, status) {
    const normalizedCallTime = this.normalizeForId(callTime);
    const normalizedDestination = this.normalizeForId(destination);
    const normalizedStatus = this.normalizeForId(status);
    
    return `${normalizedCallTime}_${normalizedDestination}_${normalizedStatus}`;
  }

  async fetchOutgoingCalls(params = {}) {
    await this.connect();
    
    try {
      const {
        page = 1,
        pageSize = 50,
        search = '',
        sortBy = 'CallTime',
        sortOrder = 'DESC',
        startDate,
        endDate,
        ...filters
      } = params;

      console.log('[MONGO-OUTGOING] Fetching with params:', params);

      // Build query
      const query = {};

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

      // Search filter - ONLY your specified outgoing call fields
      if (search) {
        query.$or = [
          { CallerID: { $regex: search, $options: 'i' } },
          { Destination: { $regex: search, $options: 'i' } },
          { Status: { $regex: search, $options: 'i' } },
          { Trunk: { $regex: search, $options: 'i' } },
          { CallType: { $regex: search, $options: 'i' } }
        ];
      }

      // Column filters - handle both single values and comma-separated multi-select values
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          if (Array.isArray(filters[key])) {
            // Handle array values (direct from FilterPopup)
            query[key] = { $in: filters[key] };
          } else if (typeof filters[key] === 'string' && filters[key].includes(',')) {
            // Handle comma-separated values (from API transmission)
            const values = filters[key].split(',').map(v => v.trim()).filter(v => v !== '');
            if (values.length > 0) {
              query[key] = { $in: values };
            }
          } else {
            // Handle single values with regex
            query[key] = { $regex: filters[key], $options: 'i' };
          }
        }
      });

      // Sort configuration
      const sortConfig = {};
      sortConfig[sortBy] = sortOrder === 'ASC' ? 1 : -1;

      // Execute query with pagination
      const skip = (page - 1) * pageSize;
      const [data, total] = await Promise.all([
        this.collection
          .find(query)
          .sort(sortConfig)
          .skip(skip)
          .limit(parseInt(pageSize))
          .toArray(),
        this.collection.countDocuments(query)
      ]);

      console.log(`[MONGO-OUTGOING] Found ${total} total records, returning ${data.length} for page ${page}`);

      return {
        success: true,
        data: data,
        total: total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      console.error('[MONGO-OUTGOING] Fetch error:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        total: 0
      };
    }
  }

  // Map CSV fields to MongoDB fields for outgoing calls
  mapOutgoingCallRecord(record) {
    // Field mapping for outgoing calls with your specific headers (no display names)
    const fieldMap = {
      'Call Time': 'CallTime',
      'Caller ID': 'CallerID',
      'Caller Display name': 'CallerDisplayName',
      'Trunk': 'Trunk',
      'Trunk number': 'TrunkNumber',
      'Status': 'Status',
      'Ringing': 'Ringing',
      'Talking': 'Talking',
      'Total Duration': 'TotalDuration',
      'Destination Callee Id': 'Destination',
      'Call Type': 'CallType',
      'Cost': 'Cost',
      'Sentiment': 'Sentiment',
      'Summary': 'Summary',
      'Transcription': 'Transcription'
    };

    const mappedRecord = {};
    
    // Handle field mapping with trimming for headers with spaces
    Object.keys(record).forEach(key => {
      const trimmedKey = key.trim();
      const mappedKey = fieldMap[trimmedKey] || trimmedKey;
      mappedRecord[mappedKey] = record[key];
    });

    // No additional field processing needed - outgoing calls have different structure than incoming

    return mappedRecord;
  }

  async bulkUpsertOutgoingCalls(records, progressCallback = null) {
    await this.connect();
    
    try {
      console.log(`[MONGO-OUTGOING] Starting bulk upsert for ${records.length} records`);
      
      let created = 0;
      let updated = 0;
      let failed = 0;
      let processed = 0;

      // Process in batches for better performance
      const batchSize = 500;
      const batches = [];
      
      for (let i = 0; i < records.length; i += batchSize) {
        batches.push(records.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const operations = [];

        for (const record of batch) {
          try {
            // Map the record fields properly
            const mappedRecord = this.mapOutgoingCallRecord(record);
            
            // Generate three-part composite key: CallTime + Destination + Status
            const compositeId = this.generateCompositeId(
              mappedRecord.CallTime,
              mappedRecord.Destination, // Use Destination instead of CallerID for outgoing calls
              mappedRecord.Status
            );

            // Prepare the document with mapped fields - ONLY your specified outgoing call fields
            const doc = {
              _id: compositeId,
              CallTime: mappedRecord.CallTime ? new Date(mappedRecord.CallTime) : new Date(),
              CallerID: mappedRecord.CallerID || '',
              CallerDisplayName: mappedRecord.CallerDisplayName || '',
              Trunk: mappedRecord.Trunk || '',
              TrunkNumber: mappedRecord.TrunkNumber || '',
              Status: mappedRecord.Status || '',
              Ringing: mappedRecord.Ringing || '00:00:00',
              Talking: mappedRecord.Talking || '00:00:00',
              TotalDuration: mappedRecord.TotalDuration || '00:00:00',
              Destination: mappedRecord.Destination || '', // Destination Callee Id
              CallType: mappedRecord.CallType || 'Outbound',
              Cost: mappedRecord.Cost || '0.00',
              Sentiment: mappedRecord.Sentiment || '',
              Summary: mappedRecord.Summary || '',
              Transcription: mappedRecord.Transcription || '',
              createdAt: new Date(),
              updatedAt: new Date()
            };

            operations.push({
              replaceOne: {
                filter: { _id: compositeId },
                replacement: doc,
                upsert: true
              }
            });
          } catch (error) {
            console.error('[MONGO-OUTGOING] Error preparing record:', error);
            failed++;
          }
        }

        if (operations.length > 0) {
          try {
            const result = await this.collection.bulkWrite(operations, { ordered: false });
            
            // Count created vs updated based on upserted vs matched
            created += result.upsertedCount || 0;
            updated += result.modifiedCount || 0;
            
            console.log(`[MONGO-OUTGOING] Batch ${batchIndex + 1}/${batches.length}: Created: ${result.upsertedCount}, Updated: ${result.modifiedCount}`);
          } catch (error) {
            console.error('[MONGO-OUTGOING] Batch operation error:', error);
            failed += operations.length;
          }
        }

        processed += batch.length;

        // Report progress
        if (progressCallback) {
          const progress = Math.round((processed / records.length) * 100);
          progressCallback({
            step: 'processing',
            progress,
            recordsFound: records.length,
            created,
            updated,
            failed,
            processed
          });
        }
      }

      const finalStats = {
        total: records.length,
        created,
        updated,
        failed,
        processed
      };

      console.log('[MONGO-OUTGOING] Bulk upsert completed:', finalStats);
      return finalStats;
    } catch (error) {
      console.error('[MONGO-OUTGOING] Bulk upsert error:', error);
      throw error;
    }
  }

  async clearAllData() {
    await this.connect();
    
    try {
      console.log('[MONGO-OUTGOING] Clearing all data from tblOutgoingCalls...');
      const result = await this.collection.deleteMany({});
      console.log(`[MONGO-OUTGOING] Cleared ${result.deletedCount} records`);
      return { success: true, deletedCount: result.deletedCount };
    } catch (error) {
      console.error('[MONGO-OUTGOING] Clear data error:', error);
      return { success: false, error: error.message };
    }
  }

  async getCollectionStats() {
    await this.connect();
    
    try {
      const stats = await this.db.command({ collStats: 'tblOutgoingCalls' });
      const count = await this.collection.countDocuments();
      
      return {
        success: true,
        stats: {
          count,
          size: stats.size,
          avgObjSize: stats.avgObjSize,
          storageSize: stats.storageSize,
          indexes: stats.nindexes
        }
      };
    } catch (error) {
      console.error('[MONGO-OUTGOING] Stats error:', error);
      return { success: false, error: error.message };
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log('[MONGO-OUTGOING] Disconnected from MongoDB');
    }
  }
}

module.exports = MongoOutgoingCallsService;