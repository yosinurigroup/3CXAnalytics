const { MongoClient } = require('mongodb');

class MongoAreaCodesService {
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

      console.log('[MONGO-AREACODES] Connecting to MongoDB...');
      this.client = new MongoClient(uri);
      await this.client.connect();
      
      this.db = this.client.db(process.env.MONGODB_DATABASE || '3cx');
      this.collection = this.db.collection(process.env.MONGODB_AREACODES_COLLECTION || 'tblAreaCodes');
      this.isConnected = true;
      
      console.log('[MONGO-AREACODES] Connected to MongoDB - tblAreaCodes collection');
      
      // Create indexes for better performance
      await this.createIndexes();
    } catch (error) {
      console.error('[MONGO-AREACODES] Connection error:', error);
      throw error;
    }
  }

  async createIndexes() {
    try {
      // Create indexes for area codes
      await this.collection.createIndex({ AreaCode: 1 }, { name: 'idx_areacode', unique: true });
      await this.collection.createIndex({ State: 1 }, { name: 'idx_state' });
      
      console.log('[MONGO-AREACODES] Indexes created successfully');
    } catch (error) {
      console.error('[MONGO-AREACODES] Error creating indexes:', error);
    }
  }

  async fetchAreaCodes(params = {}) {
    await this.connect();
    
    try {
      const {
        page = 1,
        pageSize = 50,
        search = '',
        sortBy = 'AreaCode',
        sortOrder = 'ASC',
        ...filters
      } = params;

      console.log('[MONGO-AREACODES] Fetching with params:', params);

      // Build query
      const query = {};

      // Search filter
      if (search) {
        query.$or = [
          { AreaCode: { $regex: search, $options: 'i' } },
          { State: { $regex: search, $options: 'i' } }
        ];
      }

      // Column filters
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          if (Array.isArray(filters[key])) {
            query[key] = { $in: filters[key] };
          } else {
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

      console.log(`[MONGO-AREACODES] Found ${total} total records, returning ${data.length} for page ${page}`);

      return {
        success: true,
        data: data,
        total: total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      console.error('[MONGO-AREACODES] Fetch error:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        total: 0
      };
    }
  }

  // Map CSV fields to MongoDB fields for area codes
  mapAreaCodeRecord(record) {
    const fieldMap = {
      'Area Code': 'AreaCode',
      'State': 'State'
    };

    const mappedRecord = {};
    
    // Handle field mapping with trimming for headers with spaces
    Object.keys(record).forEach(key => {
      const trimmedKey = key.trim();
      const mappedKey = fieldMap[trimmedKey] || trimmedKey;
      mappedRecord[mappedKey] = record[key];
    });

    return mappedRecord;
  }

  async bulkUpsertAreaCodes(records, progressCallback = null) {
    await this.connect();
    
    try {
      console.log(`[MONGO-AREACODES] Starting bulk upsert for ${records.length} records`);
      
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
            const mappedRecord = this.mapAreaCodeRecord(record);
            
            // Use AreaCode as the unique identifier
            const areaCode = mappedRecord.AreaCode;
            if (!areaCode) {
              failed++;
              continue;
            }

            // Prepare the document
            const doc = {
              _id: areaCode,
              AreaCode: mappedRecord.AreaCode || '',
              State: mappedRecord.State || '',
              createdAt: new Date(),
              updatedAt: new Date()
            };

            operations.push({
              replaceOne: {
                filter: { _id: areaCode },
                replacement: doc,
                upsert: true
              }
            });
          } catch (error) {
            console.error('[MONGO-AREACODES] Error preparing record:', error);
            failed++;
          }
        }

        if (operations.length > 0) {
          try {
            const result = await this.collection.bulkWrite(operations, { ordered: false });
            
            // Count created vs updated based on upserted vs matched
            created += result.upsertedCount || 0;
            updated += result.modifiedCount || 0;
            
            console.log(`[MONGO-AREACODES] Batch ${batchIndex + 1}/${batches.length}: Created: ${result.upsertedCount}, Updated: ${result.modifiedCount}`);
          } catch (error) {
            console.error('[MONGO-AREACODES] Batch operation error:', error);
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

      console.log('[MONGO-AREACODES] Bulk upsert completed:', finalStats);
      return finalStats;
    } catch (error) {
      console.error('[MONGO-AREACODES] Bulk upsert error:', error);
      throw error;
    }
  }

  async clearAllData() {
    await this.connect();
    
    try {
      console.log('[MONGO-AREACODES] Clearing all data from tblAreaCodes...');
      const result = await this.collection.deleteMany({});
      console.log(`[MONGO-AREACODES] Cleared ${result.deletedCount} records`);
      return { success: true, deletedCount: result.deletedCount };
    } catch (error) {
      console.error('[MONGO-AREACODES] Clear data error:', error);
      return { success: false, error: error.message };
    }
  }

  async getCollectionStats() {
    await this.connect();
    
    try {
      const stats = await this.db.command({ collStats: 'tblAreaCodes' });
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
      console.error('[MONGO-AREACODES] Stats error:', error);
      return { success: false, error: error.message };
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log('[MONGO-AREACODES] Disconnected from MongoDB');
    }
  }
}

module.exports = MongoAreaCodesService;