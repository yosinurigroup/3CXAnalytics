const { MongoClient } = require('mongodb');

async function analyzeDateDistribution() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('3CXCallLogs');
    
    // Get current date in UTC
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    
    // Calculate date ranges
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
    
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
    ninetyDaysAgo.setUTCHours(0, 0, 0, 0);
    
    console.log('\n========================================');
    console.log('CURRENT TIME INFORMATION');
    console.log('========================================');
    console.log('Current UTC time:', now.toISOString());
    console.log('Today start (UTC):', todayStart.toISOString());
    console.log('Today end (UTC):', todayEnd.toISOString());
    console.log('30 days ago:', thirtyDaysAgo.toISOString());
    console.log('90 days ago:', ninetyDaysAgo.toISOString());
    
    // Analyze both collections
    const collections = ['tblIncomingCalls', 'tblOutgoingCalls'];
    
    for (const collectionName of collections) {
      console.log('\n========================================');
      console.log(`ANALYZING: ${collectionName}`);
      console.log('========================================');
      
      const collection = db.collection(collectionName);
      
      // Get total count
      const totalCount = await collection.countDocuments();
      console.log(`Total documents: ${totalCount}`);
      
      if (totalCount === 0) {
        console.log('No documents found in this collection');
        continue;
      }
      
      // Get date range (earliest and latest)
      const earliestDoc = await collection.findOne({}, { sort: { CallTime: 1 } });
      const latestDoc = await collection.findOne({}, { sort: { CallTime: -1 } });
      
      console.log('\n--- Date Range ---');
      if (earliestDoc && earliestDoc.CallTime) {
        const earliestDate = new Date(earliestDoc.CallTime);
        const daysAgoEarliest = Math.floor((now - earliestDate) / (1000 * 60 * 60 * 24));
        console.log('Earliest CallTime:', earliestDate.toISOString(), `(${daysAgoEarliest} days ago)`);
      }
      if (latestDoc && latestDoc.CallTime) {
        const latestDate = new Date(latestDoc.CallTime);
        const daysAgoLatest = Math.floor((now - latestDate) / (1000 * 60 * 60 * 24));
        console.log('Latest CallTime:', latestDate.toISOString(), `(${daysAgoLatest} days ago)`);
      }
      
      // Count records for specific date ranges
      console.log('\n--- Date Range Counts ---');
      
      // Today
      const todayCount = await collection.countDocuments({
        CallTime: {
          $gte: todayStart,
          $lte: todayEnd
        }
      });
      console.log(`Today (${todayStart.toISOString().split('T')[0]}): ${todayCount} records`);
      
      // Last 30 days
      const last30Count = await collection.countDocuments({
        CallTime: {
          $gte: thirtyDaysAgo,
          $lte: now
        }
      });
      console.log(`Last 30 days: ${last30Count} records`);
      
      // Last 90 days
      const last90Count = await collection.countDocuments({
        CallTime: {
          $gte: ninetyDaysAgo,
          $lte: now
        }
      });
      console.log(`Last 90 days: ${last90Count} records`);
      
      // Sample some records to see actual dates
      console.log('\n--- Sample Records (first 10) ---');
      const sampleRecords = await collection.find({}, { 
        projection: { CallTime: 1, _id: 0 } 
      }).limit(10).toArray();
      
      sampleRecords.forEach((record, index) => {
        if (record.CallTime) {
          const date = new Date(record.CallTime);
          const daysAgo = Math.floor((now - date) / (1000 * 60 * 60 * 24));
          console.log(`  ${index + 1}. ${date.toISOString()} (${daysAgo} days ago)`);
        }
      });
      
      // Analyze date distribution by day
      console.log('\n--- Date Distribution (last 7 days) ---');
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(now);
        dayStart.setUTCDate(dayStart.getUTCDate() - i);
        dayStart.setUTCHours(0, 0, 0, 0);
        
        const dayEnd = new Date(now);
        dayEnd.setUTCDate(dayEnd.getUTCDate() - i);
        dayEnd.setUTCHours(23, 59, 59, 999);
        
        const dayCount = await collection.countDocuments({
          CallTime: {
            $gte: dayStart,
            $lte: dayEnd
          }
        });
        console.log(`  ${dayStart.toISOString().split('T')[0]}: ${dayCount} records`);
      }
      
      // Check for records with invalid or missing dates
      const invalidDateCount = await collection.countDocuments({
        $or: [
          { CallTime: null },
          { CallTime: { $exists: false } },
          { CallTime: { $type: 'string' } }
        ]
      });
      console.log(`\nRecords with invalid/missing CallTime: ${invalidDateCount}`);
      
      // Check data types of CallTime field
      console.log('\n--- CallTime Field Analysis ---');
      const sampleForType = await collection.findOne({ CallTime: { $exists: true, $ne: null } });
      if (sampleForType && sampleForType.CallTime) {
        console.log('CallTime field type:', typeof sampleForType.CallTime);
        console.log('CallTime value sample:', sampleForType.CallTime);
        if (sampleForType.CallTime instanceof Date) {
          console.log('CallTime is a proper Date object ✓');
        } else {
          console.log('WARNING: CallTime is not a Date object!');
        }
      }
    }
    
    // Combined analysis
    console.log('\n========================================');
    console.log('COMBINED ANALYSIS (Both Collections)');
    console.log('========================================');
    
    const incomingColl = db.collection('tblIncomingCalls');
    const outgoingColl = db.collection('tblOutgoingCalls');
    
    const totalIncoming = await incomingColl.countDocuments();
    const totalOutgoing = await outgoingColl.countDocuments();
    const grandTotal = totalIncoming + totalOutgoing;
    
    console.log(`Total Incoming: ${totalIncoming}`);
    console.log(`Total Outgoing: ${totalOutgoing}`);
    console.log(`Grand Total: ${grandTotal}`);
    
    // Combined date range counts
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
    
    console.log('\n--- Combined Date Range Counts ---');
    console.log(`Today: ${todayIncoming + todayOutgoing} (Incoming: ${todayIncoming}, Outgoing: ${todayOutgoing})`);
    console.log(`Last 30 days: ${last30Incoming + last30Outgoing} (Incoming: ${last30Incoming}, Outgoing: ${last30Outgoing})`);
    console.log(`Last 90 days: ${last90Incoming + last90Outgoing} (Incoming: ${last90Incoming}, Outgoing: ${last90Outgoing})`);
    
    console.log('\n========================================');
    console.log('EXPECTED vs ACTUAL COMPARISON');
    console.log('========================================');
    console.log('Expected by user:');
    console.log('  All Time: 42,787 records');
    console.log('  Today: 395 records');
    console.log('  Last 30 days: 32,927 records');
    console.log('  Last 90 days: 42,786 records');
    console.log('\nActual in database:');
    console.log(`  All Time: ${grandTotal} records`);
    console.log(`  Today: ${todayIncoming + todayOutgoing} records`);
    console.log(`  Last 30 days: ${last30Incoming + last30Outgoing} records`);
    console.log(`  Last 90 days: ${last90Incoming + last90Outgoing} records`);
    
    // Identify the issue
    console.log('\n========================================');
    console.log('ISSUE IDENTIFICATION');
    console.log('========================================');
    
    if (todayIncoming + todayOutgoing === 0) {
      console.log('❌ No records found for today.');
      console.log('   This suggests the data is from a different time period.');
      
      // Find the most recent date with data
      const latestIncoming = await incomingColl.findOne({}, { sort: { CallTime: -1 } });
      const latestOutgoing = await outgoingColl.findOne({}, { sort: { CallTime: -1 } });
      
      let mostRecentDate = null;
      if (latestIncoming?.CallTime && latestOutgoing?.CallTime) {
        const dateIn = new Date(latestIncoming.CallTime);
        const dateOut = new Date(latestOutgoing.CallTime);
        mostRecentDate = dateIn > dateOut ? dateIn : dateOut;
      } else if (latestIncoming?.CallTime) {
        mostRecentDate = new Date(latestIncoming.CallTime);
      } else if (latestOutgoing?.CallTime) {
        mostRecentDate = new Date(latestOutgoing.CallTime);
      }
      
      if (mostRecentDate) {
        const daysAgo = Math.floor((now - mostRecentDate) / (1000 * 60 * 60 * 24));
        console.log(`   Most recent data is from: ${mostRecentDate.toISOString().split('T')[0]}`);
        console.log(`   That's ${daysAgo} days ago`);
        console.log('\n   RECOMMENDATION: The data needs to be updated with current dates');
        console.log('   or test data needs to be generated for today.');
      }
    } else {
      console.log(`✅ Found ${todayIncoming + todayOutgoing} records for today`);
    }
    
    if (Math.abs(grandTotal - 42787) > 100) {
      console.log(`❌ Total record count mismatch (Expected: 42,787, Actual: ${grandTotal})`);
    } else {
      console.log(`✅ Total record count matches approximately (Expected: 42,787, Actual: ${grandTotal})`);
    }
    
    // Year distribution analysis
    console.log('\n========================================');
    console.log('YEAR DISTRIBUTION ANALYSIS');
    console.log('========================================');
    
    const yearPipeline = [
      {
        $match: { CallTime: { $exists: true, $ne: null } }
      },
      {
        $group: {
          _id: { $year: "$CallTime" },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: -1 }
      }
    ];
    
    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      const yearDistribution = await collection.aggregate(yearPipeline).toArray();
      
      console.log(`\n${collectionName} - Records by Year:`);
      yearDistribution.forEach(item => {
        console.log(`  Year ${item._id}: ${item.count} records`);
      });
    }
    
  } catch (error) {
    console.error('Error analyzing date distribution:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the analysis
analyzeDateDistribution().catch(console.error);