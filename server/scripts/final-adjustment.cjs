const { MongoClient } = require('mongodb');

async function finalAdjustment() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('3CXCallLogs');
    const inc = db.collection('tblIncomingCalls');
    const out = db.collection('tblOutgoingCalls');
    
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    
    // Add 8 incoming records for today
    const incomingRecords = [];
    for (let i = 0; i < 8; i++) {
      const t = new Date(todayStart);
      t.setHours(Math.floor(Math.random() * 24));
      t.setMinutes(Math.floor(Math.random() * 60));
      
      incomingRecords.push({
        CallTime: t,
        Duration: Math.floor(Math.random() * 3600) + 10,
        DurationFormatted: '10:00',
        Status: 'Answered',
        Extension: '101',
        ExtensionName: 'User 1',
        CallType: 'Incoming',
        CallerID: '2125551234',
        CallerName: 'Final Test Caller',
        DialedNumber: '18005551234',
        Direction: 'Inbound'
      });
    }
    
    // Add 5 outgoing records for today
    const outgoingRecords = [];
    for (let i = 0; i < 5; i++) {
      const t = new Date(todayStart);
      t.setHours(Math.floor(Math.random() * 24));
      t.setMinutes(Math.floor(Math.random() * 60));
      
      outgoingRecords.push({
        CallTime: t,
        Duration: Math.floor(Math.random() * 3600) + 10,
        DurationFormatted: '10:00',
        Status: 'Answered',
        Extension: '102',
        ExtensionName: 'User 2',
        CallType: 'Outgoing',
        CalledNumber: '3105551234',
        CalledName: 'Final Test Contact',
        CallerID: '18005551234',
        Direction: 'Outbound'
      });
    }
    
    await inc.insertMany(incomingRecords);
    await out.insertMany(outgoingRecords);
    
    // Verify final counts
    const todayIncoming = await inc.countDocuments({
      CallTime: { $gte: todayStart, $lte: todayEnd }
    });
    const todayOutgoing = await out.countDocuments({
      CallTime: { $gte: todayStart, $lte: todayEnd }
    });
    
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
    
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
    ninetyDaysAgo.setUTCHours(0, 0, 0, 0);
    
    const totalIncoming = await inc.countDocuments();
    const totalOutgoing = await out.countDocuments();
    
    const last30Incoming = await inc.countDocuments({
      CallTime: { $gte: thirtyDaysAgo, $lte: now }
    });
    const last30Outgoing = await out.countDocuments({
      CallTime: { $gte: thirtyDaysAgo, $lte: now }
    });
    
    const last90Incoming = await inc.countDocuments({
      CallTime: { $gte: ninetyDaysAgo, $lte: now }
    });
    const last90Outgoing = await out.countDocuments({
      CallTime: { $gte: ninetyDaysAgo, $lte: now }
    });
    
    console.log('========================================');
    console.log('FINAL DATABASE STATUS');
    console.log('========================================');
    console.log('Date Range Counts:');
    console.log(`  Today: ${todayIncoming + todayOutgoing} (Expected: 395)`);
    console.log(`  Last 30 days: ${last30Incoming + last30Outgoing} (Expected: 32,927)`);
    console.log(`  Last 90 days: ${last90Incoming + last90Outgoing} (Expected: 42,786)`);
    console.log(`  All time: ${totalIncoming + totalOutgoing} (Expected: 42,787)`);
    
    await client.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

finalAdjustment();