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
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    const collection = db.collection(process.env.MONGODB_COLLECTION || 'tblIncomingCalls');

    console.log('[API] Fetching fresh real-time data from MongoDB (no cache)...');
    
    // Build query
    const query = {};

    // Date range filter
    if (options.startDate || options.endDate) {
      query.CallTime = {};
      if (options.startDate) {
        query.CallTime.$gte = options.startDate;
      }
      if (options.endDate) {
        query.CallTime.$lt = options.endDate;
      }
    }

    // Search filter
    if (options.search) {
      query.$or = [
        { CallerID: { $regex: options.search, $options: 'i' } },
        { Destination: { $regex: options.search, $options: 'i' } },
        { Trunk: { $regex: options.search, $options: 'i' } },
        { Status: { $regex: options.search, $options: 'i' } },
        { CallType: { $regex: options.search, $options: 'i' } },
        { Sentiment: { $regex: options.search, $options: 'i' } }
      ];
    }

    // Column filters
    Object.keys(options.filters).forEach(key => {
      if (options.filters[key] !== undefined && options.filters[key] !== null && options.filters[key] !== '') {
        if (Array.isArray(options.filters[key])) {
          query[key] = { $in: options.filters[key] };
        } else {
          query[key] = { $regex: options.filters[key], $options: 'i' };
        }
      }
    });

    // Sort configuration
    const sortConfig = {};
    sortConfig[options.sortBy] = options.sortOrder === 'ASC' ? 1 : -1;

    // Execute query with pagination
    const skip = (options.page - 1) * options.pageSize;
    const [data, total] = await Promise.all([
      collection
        .find(query)
        .sort(sortConfig)
        .skip(skip)
        .limit(parseInt(options.pageSize))
        .toArray(),
      collection.countDocuments(query)
    ]);

    console.log(`[API] Found ${total} total records, returning ${data.length} for page ${options.page}`);

    res.json({
      success: true,
      data: data,
      total: total,
      page: parseInt(options.page),
      pageSize: parseInt(options.pageSize),
      totalPages: Math.ceil(total / options.pageSize)
    });
  } catch (error) {
    console.error('Error in /api/inbound-calls:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch inbound calls',
      data: [],
      total: 0
    });
  }
};