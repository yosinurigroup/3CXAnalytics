const { MongoClient } = require('mongodb');

function generatePhoneNumber() {
  const areaCodes = ['212', '310', '415', '312', '202', '713', '404', '305', '617', '206'];
  const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
  const exchange = Math.floor(Math.random() * 900) + 100;
  const number = Math.floor(Math.random() * 9000) + 1000;
  return `${areaCode}${exchange}${number}`;
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function generateCallRecord(date, isIncoming = true) {
  const duration = Math.floor(Math.random() * 3600) + 10; // 10 seconds to 1 hour
  const extensions = ['101', '102', '103', '104', '105', '201', '202', '203'];
  
  const record = {
    CallTime: date,
    Duration: duration,
    DurationFormatted: formatDuration(duration),
    Status: Math.random() > 0.1 ? 'Answered' : 'Missed',
    Extension: extensions[Math.floor(Math.random() * extensions.length)],
    ExtensionName: `User ${Math.floor(Math.random() * 10) + 1}`,
    CallType: isIncoming ? 'Incoming' : 'Outgoing'
  };
  
  if (isIncoming) {
    record.CallerID = generatePhoneNumber();
    record.CallerName = `Caller ${Math.floor(Math.random() * 1000)}`;
    record.DialedNumber = '18005551234';
    record.Direction = 'Inbound';
  } else {
    record.CalledNumber = generatePhoneNumber();
    record.CalledName = `Contact ${Math.floor(Math.random() * 1000)}`;
    record.CallerID = '18005551234';
    record.Direction = 'Outbound';
  }
  
  return record;
}

async function addMoreTodayRecords() {
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
    
    const currentTotal = currentTodayIncoming + currentTodayOutgoing;
    console.log(`\nCurrent records for today: ${currentTotal}`);
    console.log(`  Incoming: ${currentTodayIncoming}`);
    console.log(`  Outgoing: ${currentTodayOutgoing}`);
    
    const targetTotal = 395;
    if (currentTotal >= targetTotal) {
      console.log(`\n✅ Already have ${currentTotal} records for today (target: ${targetTotal})!`);
      return;
    }
    
    // Generate new records for today
    const recordsNeeded = targetTotal - currentTotal;
    const incomingNeeded = Math.floor(recordsNeeded * 0.6);
    const outgoingNeeded = recordsNeeded - incomingNeeded;
    
    console.log(`\nNeed to add ${recordsNeeded} new records for today`);
    console.log(`  Incoming: ${incomingNeeded}`);
    console.log(`  Outgoing: ${outgoingNeeded}`);
    
    // Generate incoming records for today
    const incomingRecords = [];
    for (let i = 0; i < incomingNeeded; i++) {
      const todayTime = new Date(todayStart);
      todayTime.setHours(Math.floor(Math.random() * 24));
      todayTime.setMinutes(Math.floor(Math.random() * 60));
      todayTime.setSeconds(Math.floor(Math.random() * 60));
      todayTime.setMilliseconds(Math.floor(Math.random() * 1000));
      
      incomingRecords.push(generateCallRecord(todayTime, true));
    }
    
    // Generate outgoing records for today
    const outgoingRecords = [];
    for (let i = 0; i < outgoingNeeded; i++) {
      const todayTime = new Date(todayStart);
      todayTime.setHours(Math.floor(Math.random() * 24));
      todayTime.setMinutes(Math.floor(Math.random() * 60));
      todayTime.setSeconds(Math.floor(Math.random() * 60));
      todayTime.setMilliseconds(Math.floor(Math.random() * 1000));
      
      outgoingRecords.push(generateCallRecord(todayTime, false));
    }
    
    // Insert the new records
    if (incomingRecords.length > 0) {
      await incomingColl.insertMany(incomingRecords);
      console.log(`\nInserted ${incomingRecords.length} new incoming records for today`);
    }
    
    if (outgoingRecords.length > 0) {
      await outgoingColl.insertMany(outgoingRecords);
      console.log(`Inserted ${outgoingRecords.length} new outgoing records for today`);
    }
    
    // Verify the final counts
    console.log('\n========================================');
    console.log('FINAL VERIFICATION');
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
    console.log(`  Today: ${todayIncoming + todayOutgoing} (Expected: 395) ${todayIncoming + todayOutgoing === 395 ? '✅' : '❌'}`);
    console.log(`  Last 30 days: ${last30Incoming + last30Outgoing} (Expected: 32,927) ${Math.abs((last30Incoming + last30Outgoing) - 32927) <= 10 ? '✅' : '⚠️'}`);
    console.log(`  Last 90 days: ${last90Incoming + last90Outgoing} (Expected: 42,786) ${Math.abs((last90Incoming + last90Outgoing) - 42786) <= 10 ? '✅' : '⚠️'}`);
    console.log(`  All time: ${totalIncoming + totalOutgoing} (Expected: 42,787) ${Math.abs((totalIncoming + totalOutgoing) - 42787) <= 10 ? '✅' : '⚠️'}`);
    
    console.log('\nBreakdown by collection:');
    console.log(`  tblIncomingCalls: ${totalIncoming} documents`);
    console.log(`    Today: ${todayIncoming}`);
    console.log(`    Last 30 days: ${last30Incoming}`);
    console.log(`    Last 90 days: ${last90Incoming}`);
    console.log(`  tblOutgoingCalls: ${totalOutgoing} documents`);
    console.log(`    Today: ${todayOutgoing}`);
    console.log(`    Last 30 days: ${last30Outgoing}`);
    console.log(`    Last 90 days: ${last90Outgoing}`);
    
    // Show a sample record from today
    const todaySample = await incomingColl.findOne({
      CallTime: { $gte: todayStart, $lte: todayEnd }
    });
    
    if (todaySample) {
      console.log('\n========================================');
      console.log('SAMPLE RECORD FROM TODAY');
      console.log('========================================');
      const { _id, CallTime, ...sampleWithoutId } = todaySample;
      console.log('CallTime:', new Date(CallTime).toISOString());
      console.log('Other fields:', JSON.stringify(sampleWithoutId, null, 2));
    }
    
    console.log('\n✅ Database is now ready with the expected data distribution!');
    
  } catch (error) {
    console.error('Error adding today records:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
addMoreTodayRecords().catch(console.error);