const { MongoClient } = require('mongodb');

// Configuration for expected data distribution
const EXPECTED_COUNTS = {
  total: 42787,
  today: 395,
  last30Days: 32927,  // includes today
  last90Days: 42786   // includes last 30 days
};

// Calculate distribution
const DISTRIBUTION = {
  today: 395,
  last1to30Days: 32927 - 395,  // 32,532
  last31to90Days: 42786 - 32927,  // 9,859
  older: 42787 - 42786  // 1 record older than 90 days
};

function generatePhoneNumber() {
  const areaCodes = ['212', '310', '415', '312', '202', '713', '404', '305', '617', '206'];
  const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
  const exchange = Math.floor(Math.random() * 900) + 100;
  const number = Math.floor(Math.random() * 9000) + 1000;
  return `${areaCode}${exchange}${number}`;
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

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function generateDatesForRange(count, startDaysAgo, endDaysAgo) {
  const dates = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.random() * (endDaysAgo - startDaysAgo) + startDaysAgo;
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    
    // Add random time of day
    date.setHours(Math.floor(Math.random() * 24));
    date.setMinutes(Math.floor(Math.random() * 60));
    date.setSeconds(Math.floor(Math.random() * 60));
    date.setMilliseconds(Math.floor(Math.random() * 1000));
    
    dates.push(date);
  }
  
  return dates;
}

async function generateTestData() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    // Create database and collections
    const db = client.db('3CXCallLogs');
    
    // Drop existing collections if they exist
    try {
      await db.collection('tblIncomingCalls').drop();
      console.log('Dropped existing tblIncomingCalls collection');
    } catch (e) {
      // Collection doesn't exist, that's fine
    }
    
    try {
      await db.collection('tblOutgoingCalls').drop();
      console.log('Dropped existing tblOutgoingCalls collection');
    } catch (e) {
      // Collection doesn't exist, that's fine
    }
    
    const incomingColl = db.collection('tblIncomingCalls');
    const outgoingColl = db.collection('tblOutgoingCalls');
    
    console.log('\n========================================');
    console.log('GENERATING TEST DATA');
    console.log('========================================');
    console.log(`Total records to generate: ${EXPECTED_COUNTS.total}`);
    console.log(`  - Today: ${DISTRIBUTION.today}`);
    console.log(`  - Last 1-30 days: ${DISTRIBUTION.last1to30Days}`);
    console.log(`  - Last 31-90 days: ${DISTRIBUTION.last31to90Days}`);
    console.log(`  - Older than 90 days: ${DISTRIBUTION.older}`);
    
    // Generate dates for each range
    const todayDates = generateDatesForRange(DISTRIBUTION.today, 0, 0.99);
    const last30Dates = generateDatesForRange(DISTRIBUTION.last1to30Days, 1, 30);
    const last90Dates = generateDatesForRange(DISTRIBUTION.last31to90Days, 31, 90);
    const olderDates = generateDatesForRange(DISTRIBUTION.older, 91, 100);
    
    const allDates = [...todayDates, ...last30Dates, ...last90Dates, ...olderDates];
    
    // Shuffle dates
    allDates.sort(() => Math.random() - 0.5);
    
    // Split between incoming and outgoing (60% incoming, 40% outgoing)
    const incomingCount = Math.floor(allDates.length * 0.6);
    const outgoingCount = allDates.length - incomingCount;
    
    const incomingRecords = [];
    const outgoingRecords = [];
    
    console.log('\nGenerating records...');
    
    // Generate incoming records
    for (let i = 0; i < incomingCount; i++) {
      incomingRecords.push(generateCallRecord(allDates[i], true));
      
      if ((i + 1) % 1000 === 0) {
        console.log(`  Generated ${i + 1} incoming records...`);
      }
    }
    
    // Generate outgoing records
    for (let i = 0; i < outgoingCount; i++) {
      outgoingRecords.push(generateCallRecord(allDates[incomingCount + i], false));
      
      if ((i + 1) % 1000 === 0) {
        console.log(`  Generated ${i + 1} outgoing records...`);
      }
    }
    
    console.log('\nInserting records into MongoDB...');
    
    // Insert in batches
    const batchSize = 1000;
    
    // Insert incoming records
    for (let i = 0; i < incomingRecords.length; i += batchSize) {
      const batch = incomingRecords.slice(i, Math.min(i + batchSize, incomingRecords.length));
      await incomingColl.insertMany(batch);
      console.log(`  Inserted ${Math.min(i + batchSize, incomingRecords.length)} / ${incomingRecords.length} incoming records`);
    }
    
    // Insert outgoing records
    for (let i = 0; i < outgoingRecords.length; i += batchSize) {
      const batch = outgoingRecords.slice(i, Math.min(i + batchSize, outgoingRecords.length));
      await outgoingColl.insertMany(batch);
      console.log(`  Inserted ${Math.min(i + batchSize, outgoingRecords.length)} / ${outgoingRecords.length} outgoing records`);
    }
    
    // Create indexes for better performance
    console.log('\nCreating indexes...');
    await incomingColl.createIndex({ CallTime: -1 });
    await incomingColl.createIndex({ Status: 1 });
    await incomingColl.createIndex({ Extension: 1 });
    
    await outgoingColl.createIndex({ CallTime: -1 });
    await outgoingColl.createIndex({ Status: 1 });
    await outgoingColl.createIndex({ Extension: 1 });
    
    console.log('Indexes created successfully');
    
    // Verify the data
    console.log('\n========================================');
    console.log('VERIFICATION');
    console.log('========================================');
    
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    
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
    
    console.log('Database: 3CXCallLogs');
    console.log(`  tblIncomingCalls: ${totalIncoming} documents`);
    console.log(`  tblOutgoingCalls: ${totalOutgoing} documents`);
    console.log(`  Total: ${totalIncoming + totalOutgoing} documents`);
    
    console.log('\nDate Range Counts:');
    console.log(`  Today: ${todayIncoming + todayOutgoing} (Expected: ${EXPECTED_COUNTS.today})`);
    console.log(`  Last 30 days: ${last30Incoming + last30Outgoing} (Expected: ${EXPECTED_COUNTS.last30Days})`);
    console.log(`  Last 90 days: ${last90Incoming + last90Outgoing} (Expected: ${EXPECTED_COUNTS.last90Days})`);
    console.log(`  All time: ${totalIncoming + totalOutgoing} (Expected: ${EXPECTED_COUNTS.total})`);
    
    // Show sample records
    console.log('\n========================================');
    console.log('SAMPLE RECORDS');
    console.log('========================================');
    
    const todaySample = await incomingColl.findOne({
      CallTime: { $gte: todayStart, $lte: todayEnd }
    });
    
    if (todaySample) {
      console.log('\nSample record from today:');
      console.log(JSON.stringify(todaySample, null, 2));
    }
    
    console.log('\n✅ Test data generation complete!');
    console.log('The database now contains the expected data distribution.');
    
  } catch (error) {
    console.error('Error generating test data:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the generator
generateTestData().catch(console.error);