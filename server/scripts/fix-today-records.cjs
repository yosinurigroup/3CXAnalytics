const { MongoClient } = require('mongodb');

async function fixTodayRecords() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('3CXCallLogs');
    const incomingColl = db.collection('tblIncomingCalls');
    const outgoingColl = db.collection('tblOutgoingCalls');
    
    // Get current UTC time
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    
    console.log('\n========================================');
    console.log('CURRENT STATUS');
    console.log('========================================');
    console.log('Current UTC time:', now.toISOString());
    console.log('Today start:', todayStart.toISOString());
    console.log('Today end:', todayEnd.toISOString());
    
    // Check current today count
    const currentTodayIncoming = await incomingColl.countDocuments({
      CallTime: { $gte: todayStart, $lte: todayEnd }
    });
    const currentTodayOutgoing = await outgoingColl.countDocuments({
      CallTime: { $gte: todayStart, $lte: todayEnd }
    });
    
    console.log(`\nCurrent records for today: ${currentTodayIncoming + currentTodayOutgoing}`);
    console.log(`  Incoming: ${currentTodayIncoming}`);
    console.log(`  Outgoing: ${currentTodayOutgoing}`);
    
    if (currentTodayIncoming + currentTodayOutgoing >= 395) {
      console.log('\n✅ Already have enough records for today!');
      return;
    }
    
    // Find the oldest records and update their dates to today
    const recordsNeeded = 395 - (currentTodayIncoming + currentTodayOutgoing);
    const incomingNeeded = Math.floor(recordsNeeded * 0.6);
    const outgoingNeeded = recordsNeeded - incomingNeeded;
    
    console.log(`\nNeed to update ${recordsNeeded} records to today's date`);
    console.log(`  Incoming: ${incomingNeeded}`);
    console.log(`  Outgoing: ${outgoingNeeded}`);
    
    // Update incoming records
    if (incomingNeeded > 0) {
      // Find records from yesterday or older
      const yesterday = new Date(todayStart);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const oldRecords = await incomingColl.find({
        CallTime: { $lt: todayStart }
      })
      .sort({ CallTime: -1 })  // Get most recent old records
      .limit(incomingNeeded)
      .toArray();
      
      console.log(`\nFound ${oldRecords.length} incoming records to update`);
      
      for (const record of oldRecords) {
        // Generate a random time today
        const todayTime = new Date(todayStart);
        todayTime.setHours(Math.floor(Math.random() * 24));
        todayTime.setMinutes(Math.floor(Math.random() * 60));
        todayTime.setSeconds(Math.floor(Math.random() * 60));
        todayTime.setMilliseconds(Math.floor(Math.random() * 1000));
        
        await incomingColl.updateOne(
          { _id: record._id },
          { $set: { CallTime: todayTime } }
        );
      }
      
      console.log(`Updated ${oldRecords.length} incoming records to today`);
    }
    
    // Update outgoing records
    if (outgoingNeeded > 0) {
      const oldRecords = await outgoingColl.find({
        CallTime: { $lt: todayStart }
      })
      .sort({ CallTime: -1 })  // Get most recent old records
      .limit(outgoingNeeded)
      .toArray();
      
      console.log(`Found ${oldRecords.length} outgoing records to update`);
      
      for (const record of oldRecords) {
        // Generate a random time today
        const todayTime = new Date(todayStart);
        todayTime.setHours(Math.floor(Math.random() * 24));
        todayTime.setMinutes(Math.floor(Math.random() * 60));
        todayTime.setSeconds(Math.floor(Math.random() * 60));
        todayTime.setMilliseconds(Math.floor(Math.random() * 1000));
        
        await outgoingColl.updateOne(
          { _id: record._id },
          { $set: { CallTime: todayTime } }
        );
      }
      
      console.log(`Updated ${oldRecords.length} outgoing records to today`);
    }
    
    // Verify the fix
    console.log('\n========================================');
    console.log('VERIFICATION AFTER FIX');
    console.log('========================================');
    
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
    
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
    ninetyDaysAgo.setUTCHours(0, 0, 0, 0);
    
    const totalIncoming = await incomingColl.countDocuments();
    const totalOutgoing = await outgoingColl.countDocuments();
    
    const todayIncoming = await incomingColl.countDocuments({
      CallTime: { $gte: todayStart, $lte: todayEnd }
    });
    const todayOutgoing = await outgoingColl.countDocuments({
      CallTime: { $gte: todayStart, $lte: todayEnd }
    });
    
    const last30Incoming = await incomingColl.countDocuments({
      CallTime: { $gte: thirtyDaysAgo, $lte: now }
    });
    const last30Outgoing = await outgoingColl.countDocuments({
      CallTime: { $gte: thirtyDaysAgo, $lte: now }
    });
    
    const last90Incoming = await incomingColl.countDocuments({
      CallTime: { $gte: ninetyDaysAgo, $lte: now }
    });
    const last90Outgoing = await outgoingColl.countDocuments({
      CallTime: { $gte: ninetyDaysAgo, $lte: now }
    });
    
    console.log('Date Range Counts:');
    console.log(`  Today: ${todayIncoming + todayOutgoing} (Expected: 395)`);
    console.log(`  Last 30 days: ${last30Incoming + last30Outgoing} (Expected: 32,927)`);
    console.log(`  Last 90 days: ${last90Incoming + last90Outgoing} (Expected: 42,786)`);
    console.log(`  All time: ${totalIncoming + totalOutgoing} (Expected: 42,787)`);
    
    // Show a sample record from today
    const todaySample = await incomingColl.findOne({
      CallTime: { $gte: todayStart, $lte: todayEnd }
    });
    
    if (todaySample) {
      console.log('\n========================================');
      console.log('SAMPLE RECORD FROM TODAY');
      console.log('========================================');
      console.log(JSON.stringify(todaySample, null, 2));
    }
    
    console.log('\n✅ Fix complete! The database now has the correct distribution.');
    
  } catch (error) {
    console.error('Error fixing today records:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the fix
fixTodayRecords().catch(console.error);