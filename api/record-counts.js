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
    console.log('[API-RECORD-COUNTS] Fetching record counts from all collections...');

    // NO CACHING - Set headers to prevent any caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    // Connect to MongoDB
    const { db } = await connectToDatabase();
    
    // Get all collections
    const incomingCollection = db.collection(process.env.MONGODB_COLLECTION || 'tblIncomingCalls');
    const outgoingCollection = db.collection(process.env.MONGODB_OUT_COLLECTION || 'tblOutgoingCalls');
    const areaCodesCollection = db.collection(process.env.MONGODB_AREACODES_COLLECTION || 'tblAreaCodes');
    const usersCollection = db.collection(process.env.MONGODB_USERS_COLLECTION || 'tblUsers');

    // Fetch counts from all collections in parallel
    const [
      incomingCount,
      outgoingCount,
      areaCodesCount,
      usersCount
    ] = await Promise.allSettled([
      incomingCollection.countDocuments(),
      outgoingCollection.countDocuments(),
      areaCodesCollection.countDocuments(),
      usersCollection.countDocuments()
    ]);

    // Extract counts from results
    const counts = {
      incoming: incomingCount.status === 'fulfilled' ? incomingCount.value : 0,
      outgoing: outgoingCount.status === 'fulfilled' ? outgoingCount.value : 0,
      areaCodes: areaCodesCount.status === 'fulfilled' ? areaCodesCount.value : 0,
      users: usersCount.status === 'fulfilled' ? usersCount.value : 0,
      callLogs: (incomingCount.status === 'fulfilled' ? incomingCount.value : 0) + 
                (outgoingCount.status === 'fulfilled' ? outgoingCount.value : 0)
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
};