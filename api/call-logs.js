const { connectToDatabase } = require('./_lib/mongodb');

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, Accept, Expires');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

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
    
    if (dateRange && dateRange !== 'all' && !startDate && !endDate) {
      const dateRangeResult = getDateRangeFromFilter(dateRange);
      processedStartDate = dateRangeResult.startDate;
      processedEndDate = dateRangeResult.endDate;
    } else if (dateRange === 'all') {
      processedStartDate = null;
      processedEndDate = null;
    }

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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    const incomingCollection = db.collection(process.env.MONGODB_COLLECTION || 'tblIncomingCalls');
    const outgoingCollection = db.collection(process.env.MONGODB_OUT_COLLECTION || 'tblOutgoingCalls');

    console.log('[API-COMBINED] Fetching fresh combined call logs from MongoDB (no cache)...');
    
    // Build base query for both collections
    const baseQuery = {};

    // Date range filter
    if (options.startDate || options.endDate) {
      baseQuery.CallTime = {};
      if (options.startDate) {
        baseQuery.CallTime.$gte = options.startDate;
      }
      if (options.endDate) {
        baseQuery.CallTime.$lt = options.endDate;
      }
    }

    // Search filter
    if (options.search) {
      baseQuery.$or = [
        { CallerID: { $regex: options.search, $options: 'i' } },
        { Trunk: { $regex: options.search, $options: 'i' } },
        { Status: { $regex: options.search, $options: 'i' } },
        { CallType: { $regex: options.search, $options: 'i' } },
        { Sentiment: { $regex: options.search, $options: 'i' } }
      ];
    }

    // Column filters (excluding search and date filters)
    const filterKeys = Object.keys(options).filter(key => 
      !['page', 'pageSize', 'sortBy', 'sortOrder', 'search', 'startDate', 'endDate'].includes(key) && 
      options[key] !== undefined && options[key] !== null && options[key] !== ''
    );

    filterKeys.forEach(key => {
      if (Array.isArray(options[key])) {
        baseQuery[key] = { $in: options[key] };
      } else {
        baseQuery[key] = { $regex: options[key], $options: 'i' };
      }
    });

    // Get data from both collections with metadata
    const [incomingData, outgoingData] = await Promise.all([
      incomingCollection.find(baseQuery).toArray(),
      outgoingCollection.find(baseQuery).toArray()
    ]);

    // Add metadata to distinguish source
    const combinedData = [
      ...incomingData.map(record => ({
        ...record,
        CallType: 'Incoming',
        source: 'incoming',
        originalId: record._id
      })),
      ...outgoingData.map(record => ({
        ...record,
        CallType: 'Outgoing',
        source: 'outgoing',
        originalId: record._id
      }))
    ];

    // Sort combined data
    const sortConfig = options.sortOrder === 'ASC' ? 1 : -1;
    combinedData.sort((a, b) => {
      const aVal = a[options.sortBy];
      const bVal = b[options.sortBy];
      
      if (aVal < bVal) return -1 * sortConfig;
      if (aVal > bVal) return 1 * sortConfig;
      return 0;
    });

    // Apply pagination
    const total = combinedData.length;
    const skip = (options.page - 1) * options.pageSize;
    const paginatedData = combinedData.slice(skip, skip + options.pageSize);

    console.log(`[API-COMBINED] Total records found: ${total}`);
    console.log(`[API-COMBINED] Incoming count: ${incomingData.length}`);
    console.log(`[API-COMBINED] Outgoing count: ${outgoingData.length}`);
    console.log(`[API-COMBINED] Data array length: ${paginatedData.length}`);

    res.json({
      success: true,
      data: paginatedData,
      total: total,
      page: parseInt(options.page),
      pageSize: parseInt(options.pageSize),
      totalPages: Math.ceil(total / options.pageSize),
      incomingCount: incomingData.length,
      outgoingCount: outgoingData.length
    });
  } catch (error) {
    console.error('Error in /api/call-logs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch combined call logs',
      data: [],
      total: 0,
      incomingCount: 0,
      outgoingCount: 0
    });
  }
};