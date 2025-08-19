const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

class MongoCombinedCallLogsService {
  constructor() {
    this.client = null;
    this.db = null;
    this.incomingCollection = null;
    this.outgoingCollection = null;
    this.isConnected = false;
    this.init();
  }

  async init() {
    try {
      const uri = process.env.MONGODB_URI;
      const dbName = process.env.MONGODB_DATABASE || '3cx';
      const incomingCollectionName = process.env.MONGODB_COLLECTION || 'tblIncomingCalls';
      const outgoingCollectionName = process.env.MONGODB_OUT_COLLECTION || 'tblOutgoingCalls';

      if (!uri) {
        throw new Error('MONGODB_URI environment variable is not set');
      }

      console.log(`[COMBINED-CALLS] Connecting to MongoDB...`);
      console.log(`[COMBINED-CALLS] Database: ${dbName}`);
      console.log(`[COMBINED-CALLS] Incoming Collection: ${incomingCollectionName}`);
      console.log(`[COMBINED-CALLS] Outgoing Collection: ${outgoingCollectionName}`);

      this.client = new MongoClient(uri);
      await this.client.connect();
      
      this.db = this.client.db(dbName);
      this.incomingCollection = this.db.collection(incomingCollectionName);
      this.outgoingCollection = this.db.collection(outgoingCollectionName);
      
      this.isConnected = true;
      console.log('✅ MongoCombinedCallLogsService initialized successfully');
    } catch (error) {
      console.error('❌ MongoCombinedCallLogsService initialization failed:', error);
      throw error;
    }
  }

  // Extract area code from phone number
  extractAreaCode(phoneNumber, callType = 'Incoming') {
    if (!phoneNumber) return '';
    
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // For outgoing calls, area code is ALWAYS digits 3-5 (positions 2-4 in 0-based indexing)
    // Format: [CompanyCode:2 digits][AreaCode:3 digits][PhoneNumber:remaining]
    if (callType === 'Outgoing') {
      if (digits.length >= 5) {
        return digits.substring(2, 5); // Get digits 3-5 (positions 2-4 in 0-based indexing)
      }
    } else {
      // For incoming calls, use existing logic
      // Check if it starts with 1 (US/Canada country code)
      if (digits.length >= 4 && digits.startsWith('1')) {
        return digits.substring(1, 4); // Get digits 2-4 (area code)
      }
      
      // If no country code, assume first 3 digits are area code
      if (digits.length >= 3) {
        return digits.substring(0, 3);
      }
    }
    
    return '';
  }

  // Extract company code from phone number (for outgoing calls only)
  extractCompanyCode(phoneNumber, callType = 'Incoming') {
    if (!phoneNumber || callType !== 'Outgoing') return '';
    
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Company code is first 2 digits from the left side of Caller ID for outgoing calls
    if (digits.length >= 2) {
      return digits.substring(0, 2);
    }
    
    return '';
  }

  // Transform incoming call record to unified format
  transformIncomingRecord(record) {
    return {
      _id: `incoming_${record._id}`,
      CompanyCode: this.extractCompanyCode(record.CallerID, 'Incoming'), // Empty for incoming calls
      AreaCode: this.extractAreaCode(record.CallerID, 'Incoming'),
      CallTime: record.CallTime,
      CallerID: record.CallerID,
      Trunk: record.Trunk || '',
      TrunkNumber: record.TrunkNumber || '',
      Status: record.Status || '',
      Ringing: record.Ringing || '',
      Talking: record.Talking || '',
      TotalDuration: record.TotalDuration || '',
      CallType: 'Incoming',
      Cost: record.Cost || '',
      Sentiment: record.Sentiment || '',
      Summary: record.Summary || '',
      Transcription: record.Transcription || '',
      // Metadata
      source: 'incoming',
      originalId: record._id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  // Transform outgoing call record to unified format
  transformOutgoingRecord(record) {
    return {
      _id: `outgoing_${record._id}`,
      CompanyCode: this.extractCompanyCode(record.Destination, 'Outgoing'), // First 2 digits for outgoing calls
      AreaCode: this.extractAreaCode(record.Destination, 'Outgoing'), // Digits 3-5 for outgoing calls
      CallTime: record.CallTime,
      CallerID: record.Destination, // Use Destination as Caller ID for outgoing
      Trunk: record.Trunk || '',
      TrunkNumber: record.TrunkNumber || '',
      Status: record.Status || '',
      Ringing: record.Ringing || '',
      Talking: record.Talking || '',
      TotalDuration: record.TotalDuration || '',
      CallType: 'Outgoing',
      Cost: record.Cost || '',
      Sentiment: record.Sentiment || '',
      Summary: record.Summary || '',
      Transcription: record.Transcription || '',
      // Metadata
      source: 'outgoing',
      originalId: record._id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  async getCombinedCallLogs(options = {}) {
    try {
      if (!this.isConnected) {
        await this.init();
      }

      const {
        page = 1,
        pageSize = 50,
        sortBy = 'CallTime',
        sortOrder = 'DESC',
        search = '',
        startDate,
        endDate,
        // Extract all other properties as filters (flattened from API)
        ...allFilters
      } = options;

      console.log(`[COMBINED-CALLS] ========== QUERY START ==========`);
      console.log(`[COMBINED-CALLS] Fetching combined call logs - Page: ${page}, Size: ${pageSize}`);
      console.log(`[COMBINED-CALLS] Date parameters - startDate: ${startDate}, endDate: ${endDate}`);
      console.log(`[COMBINED-CALLS] All filters applied:`, allFilters);

      // Check if CallType filter is applied (now directly in options)
      const callTypeFilter = allFilters.CallType;
      let includeIncoming = true;
      let includeOutgoing = true;

      if (callTypeFilter) {
        if (Array.isArray(callTypeFilter)) {
          includeIncoming = callTypeFilter.includes('Incoming');
          includeOutgoing = callTypeFilter.includes('Outgoing');
        } else if (typeof callTypeFilter === 'string') {
          const callTypes = callTypeFilter.split(',').map(v => v.trim());
          includeIncoming = callTypes.includes('Incoming');
          includeOutgoing = callTypes.includes('Outgoing');
        }
      }

      console.log(`[COMBINED-CALLS] Include Incoming: ${includeIncoming}, Include Outgoing: ${includeOutgoing}`);

      // Build match query for both collections (excluding CallType since it's handled above)
      let matchQuery = {};

      // Add search functionality
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        matchQuery.$or = [
          { CallerID: searchRegex },
          { Destination: searchRegex },
          { Status: searchRegex },
          { Trunk: searchRegex }
        ];
      }

      // Add date range filter for CallTime (DateTime column)
      if (startDate || endDate) {
        console.log(`[COMBINED-CALLS] ========== DATE FILTERING ==========`);
        console.log(`[COMBINED-CALLS] Raw date inputs - startDate: "${startDate}", endDate: "${endDate}"`);
        
        matchQuery.CallTime = {};
        if (startDate) {
          // Parse startDate as UTC and set to beginning of day UTC
          const startDateTime = new Date(startDate + 'T00:00:00.000Z');
          matchQuery.CallTime.$gte = startDateTime;
          console.log(`[COMBINED-CALLS] Start date parsed: ${startDateTime.toISOString()}`);
          console.log(`[COMBINED-CALLS] Start date filter: CallTime >= ${startDateTime}`);
        }
        if (endDate) {
          // For endDate, we use it as exclusive upper bound (less than)
          // This works with the server logic that sends next day for inclusive ranges
          const endDateTime = new Date(endDate + 'T00:00:00.000Z');
          matchQuery.CallTime.$lt = endDateTime;  // Changed from $lte to $lt
          console.log(`[COMBINED-CALLS] End date parsed: ${endDateTime.toISOString()}`);
          console.log(`[COMBINED-CALLS] End date filter: CallTime < ${endDateTime}`);
        }
        console.log(`[COMBINED-CALLS] Final CallTime query:`, JSON.stringify(matchQuery.CallTime));
        
        // Debug: Count records that match this date filter
        if (this.incomingCollection && this.outgoingCollection) {
          const testIncoming = await this.incomingCollection.countDocuments(matchQuery);
          const testOutgoing = await this.outgoingCollection.countDocuments({ ...matchQuery });
          console.log(`[COMBINED-CALLS] Test count with date filter - Incoming: ${testIncoming}, Outgoing: ${testOutgoing}`);
        }
      } else {
        console.log(`[COMBINED-CALLS] No date filtering applied - fetching all records`);
      }

      // Add other filters - handle both single values and comma-separated multi-select values
      // Skip CallType since it's handled separately, and skip internal parameters
      Object.keys(allFilters).forEach(key => {
        if (allFilters[key] && key !== '_t' && key !== 'CallType') {
          if (Array.isArray(allFilters[key])) {
            // Handle array values (direct from FilterPopup)
            matchQuery[key] = { $in: allFilters[key] };
          } else if (typeof allFilters[key] === 'string' && allFilters[key].includes(',')) {
            // Handle comma-separated values (from API transmission)
            const values = allFilters[key].split(',').map(v => v.trim()).filter(v => v !== '');
            if (values.length > 0) {
              matchQuery[key] = { $in: values };
            }
          } else {
            // Handle single values with regex
            matchQuery[key] = new RegExp(allFilters[key], 'i');
          }
        }
      });

      // Build outgoing query (adjust search fields)
      const outgoingQuery = { ...matchQuery };
      if (matchQuery.$or) {
        // Handle both search and date filtering in $or conditions
        outgoingQuery.$or = matchQuery.$or.map(condition => {
          // Handle search field mapping
          if (condition.CallerID) {
            return { Destination: condition.CallerID };
          }
          // Handle date filtering - keep CallTime conditions as-is for outgoing
          if (condition.CallTime) {
            return condition;
          }
          return condition;
        });
      }

      // Get counts for pagination - only count collections that are included
      let incomingCount = 0;
      let outgoingCount = 0;

      if (includeIncoming) {
        incomingCount = await this.incomingCollection.countDocuments(matchQuery);
      }
      if (includeOutgoing) {
        outgoingCount = await this.outgoingCollection.countDocuments(outgoingQuery);
      }

      const total = incomingCount + outgoingCount;
      const totalPages = Math.ceil(total / pageSize);
      const skip = (page - 1) * pageSize;

      console.log(`[COMBINED-CALLS] ========== COUNT RESULTS ==========`);
      console.log(`[COMBINED-CALLS] Incoming count: ${incomingCount}`);
      console.log(`[COMBINED-CALLS] Outgoing count: ${outgoingCount}`);
      console.log(`[COMBINED-CALLS] Total records: ${total}`);
      console.log(`[COMBINED-CALLS] Expected totals - All: 42787, Today: 395, Last 30: 32927, Last 90: 42786`);
      
      // Check if counts match expected values
      if (!startDate && !endDate) {
        console.log(`[COMBINED-CALLS] All Time query - Expected: 42787, Got: ${total}, Match: ${total === 42787 ? '✓' : '✗'}`);
      }
      
      console.log(`[COMBINED-CALLS] Page ${page}/${totalPages}, Skip: ${skip}, Limit: ${pageSize}`);

      // Use aggregation pipeline to efficiently combine and paginate
      const sortDirection = sortOrder === 'DESC' ? -1 : 1;
      
      // Create a unified pipeline that combines both collections
      const combinedPipeline = [];

      // Add incoming calls pipeline if included
      if (includeIncoming) {
        combinedPipeline.push({
          $unionWith: {
            coll: this.incomingCollection.collectionName,
            pipeline: [
              { $match: matchQuery },
              {
                $addFields: {
                  CompanyCode: "", // Empty for incoming calls
                  AreaCode: {
                    $let: {
                      vars: {
                        digits: { $regexFind: { input: "$CallerID", regex: /\d+/ } }
                      },
                      in: {
                        $cond: {
                          if: { $and: [
                            { $ne: ["$$digits", null] },
                            { $gte: [{ $strLenCP: "$$digits.match" }, 4] },
                            { $eq: [{ $substr: ["$$digits.match", 0, 1] }, "1"] }
                          ]},
                          then: { $substr: ["$$digits.match", 1, 3] },
                          else: {
                            $cond: {
                              if: { $and: [
                                { $ne: ["$$digits", null] },
                                { $gte: [{ $strLenCP: "$$digits.match" }, 3] }
                              ]},
                              then: { $substr: ["$$digits.match", 0, 3] },
                              else: ""
                            }
                          }
                        }
                      }
                    }
                  },
                  CallType: "Incoming",
                  source: "incoming"
                }
              },
              {
                $project: {
                  _id: { $concat: ["incoming_", { $toString: "$_id" }] },
                  CompanyCode: 1,
                  AreaCode: 1,
                  CallTime: 1,
                  CallerID: 1,
                  Trunk: { $ifNull: ["$Trunk", ""] },
                  TrunkNumber: { $ifNull: ["$TrunkNumber", ""] },
                  Status: { $ifNull: ["$Status", ""] },
                  Ringing: { $ifNull: ["$Ringing", ""] },
                  Talking: { $ifNull: ["$Talking", ""] },
                  TotalDuration: { $ifNull: ["$TotalDuration", ""] },
                  CallType: 1,
                  Cost: { $ifNull: ["$Cost", ""] },
                  Sentiment: { $ifNull: ["$Sentiment", ""] },
                  Summary: { $ifNull: ["$Summary", ""] },
                  Transcription: { $ifNull: ["$Transcription", ""] },
                  source: 1,
                  createdAt: 1,
                  updatedAt: 1
                }
              }
            ]
          }
        });
      }

      // Add outgoing calls pipeline if included
      if (includeOutgoing) {
        combinedPipeline.push({
          $unionWith: {
            coll: this.outgoingCollection.collectionName,
            pipeline: [
              { $match: outgoingQuery },
              {
                $addFields: {
                  CompanyCode: {
                    $let: {
                      vars: {
                        digits: { $regexFind: { input: "$Destination", regex: /\d+/ } }
                      },
                      in: {
                        $cond: {
                          if: { $and: [
                            { $ne: ["$$digits", null] },
                            { $gte: [{ $strLenCP: "$$digits.match" }, 2] }
                          ]},
                          then: { $substr: ["$$digits.match", 0, 2] },
                          else: ""
                        }
                      }
                    }
                  },
                  AreaCode: {
                    $let: {
                      vars: {
                        digits: { $regexFind: { input: "$Destination", regex: /\d+/ } }
                      },
                      in: {
                        $cond: {
                          // For outgoing calls, ALWAYS extract digits 3-5 (positions 2-4)
                          // Format: [CompanyCode:2 digits][AreaCode:3 digits][PhoneNumber:remaining]
                          if: { $and: [
                            { $ne: ["$$digits", null] },
                            { $gte: [{ $strLenCP: "$$digits.match" }, 5] }
                          ]},
                          then: { $substr: ["$$digits.match", 2, 3] }, // Digits 3-5 (positions 2-4 in 0-based indexing)
                          else: ""
                        }
                      }
                    }
                  },
                  CallType: "Outgoing",
                  source: "outgoing"
                }
              },
              {
                $project: {
                  _id: { $concat: ["outgoing_", { $toString: "$_id" }] },
                  CompanyCode: 1,
                  AreaCode: 1,
                  CallTime: 1,
                  CallerID: "$Destination",
                  Trunk: { $ifNull: ["$Trunk", ""] },
                  TrunkNumber: { $ifNull: ["$TrunkNumber", ""] },
                  Status: { $ifNull: ["$Status", ""] },
                  Ringing: { $ifNull: ["$Ringing", ""] },
                  Talking: { $ifNull: ["$Talking", ""] },
                  TotalDuration: { $ifNull: ["$TotalDuration", ""] },
                  CallType: 1,
                  Cost: { $ifNull: ["$Cost", ""] },
                  Sentiment: { $ifNull: ["$Sentiment", ""] },
                  Summary: { $ifNull: ["$Summary", ""] },
                  Transcription: { $ifNull: ["$Transcription", ""] },
                  source: 1,
                  createdAt: 1,
                  updatedAt: 1
                }
              }
            ]
          }
        });
      }

      // Add sorting and pagination
      combinedPipeline.push(
        { $sort: { [sortBy]: sortDirection } },
        { $skip: skip },
        { $limit: pageSize }
      );

      // Execute the pipeline on an empty collection to start the union with allowDiskUse for large datasets
      const paginatedRecords = await this.db.collection('dummy').aggregate(combinedPipeline, { allowDiskUse: true }).toArray();

      console.log(`[COMBINED-CALLS] ========== QUERY COMPLETE ==========`);
      console.log(`[COMBINED-CALLS] Returning page ${page}/${totalPages} with ${paginatedRecords.length} records`);
      console.log(`[COMBINED-CALLS] Final counts - Total: ${total}, Incoming: ${incomingCount}, Outgoing: ${outgoingCount}`);

      // Sample first few records to check dates
      if (paginatedRecords.length > 0 && (startDate || endDate)) {
        const sampleRecords = paginatedRecords.slice(0, 3);
        console.log(`[COMBINED-CALLS] Sample CallTime values from results:`);
        sampleRecords.forEach((record, idx) => {
          console.log(`[COMBINED-CALLS]   Record ${idx + 1}: ${record.CallTime}`);
        });
      }

      return {
        data: paginatedRecords,
        total,
        page,
        pageSize,
        totalPages,
        incomingCount,
        outgoingCount
      };
    } catch (error) {
      console.error('[COMBINED-CALLS] Error fetching combined call logs:', error);
      throw error;
    }
  }

  async getFilterOptions(field) {
    try {
      if (!this.isConnected) {
        await this.init();
      }

      console.log(`[COMBINED-CALLS] Getting filter options for field: ${field}`);

      let incomingOptions = [];
      let outgoingOptions = [];

      // Get distinct values from both collections
      if (field === 'CallType') {
        return ['Incoming', 'Outgoing'];
      }

      // Handle CompanyCode field specially since it's calculated
      if (field === 'CompanyCode') {
        // For CompanyCode, we need to get distinct values from outgoing calls only
        // since incoming calls have empty CompanyCode
        try {
          const outgoingRecords = await this.outgoingCollection.find({}, { Destination: 1 }).toArray();
          const companyCodes = new Set();
          
          outgoingRecords.forEach(record => {
            const companyCode = this.extractCompanyCode(record.Destination, 'Outgoing');
            if (companyCode) {
              companyCodes.add(companyCode);
            }
          });
          
          return Array.from(companyCodes).sort();
        } catch (error) {
          console.log(`[COMBINED-CALLS] Error getting CompanyCode options:`, error);
          return [];
        }
      }

      // For other fields, get from both collections
      try {
        incomingOptions = await this.incomingCollection.distinct(field);
      } catch (error) {
        console.log(`[COMBINED-CALLS] Field ${field} not found in incoming collection`);
      }

      try {
        // Map outgoing fields if needed
        let outgoingField = field;
        if (field === 'CallerID') {
          outgoingField = 'Destination';
        }
        outgoingOptions = await this.outgoingCollection.distinct(outgoingField);
      } catch (error) {
        console.log(`[COMBINED-CALLS] Field ${field} not found in outgoing collection`);
      }

      // Combine and deduplicate options
      const combinedOptions = [...new Set([...incomingOptions, ...outgoingOptions])];
      
      // Filter out null/undefined values and sort
      const filteredOptions = combinedOptions
        .filter(option => option != null && option !== '')
        .sort();

      console.log(`[COMBINED-CALLS] Found ${filteredOptions.length} unique options for ${field}`);
      return filteredOptions;
    } catch (error) {
      console.error(`[COMBINED-CALLS] Error getting filter options for ${field}:`, error);
      return [];
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log('[COMBINED-CALLS] MongoDB connection closed');
    }
  }
}

module.exports = MongoCombinedCallLogsService;