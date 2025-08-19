const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function testDateFiltering() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(process.env.MONGODB_DATABASE || '3cx');
    const incomingCollection = db.collection(process.env.MONGODB_COLLECTION || 'tblIncomingCalls');
    const outgoingCollection = db.collection(process.env.MONGODB_OUT_COLLECTION || 'tblOutgoingCalls');
    
    // Get a sample document to check CallTime field type
    console.log('\n========== CHECKING DATA STRUCTURE ==========');
    const sampleIncoming = await incomingCollection.findOne();
    const sampleOutgoing = await outgoingCollection.findOne();
    
    console.log('Incoming CallTime sample:', sampleIncoming?.CallTime);
    console.log('Incoming CallTime type:', typeof sampleIncoming?.CallTime);
    console.log('Incoming CallTime is Date?', sampleIncoming?.CallTime instanceof Date);
    
    console.log('\nOutgoing CallTime sample:', sampleOutgoing?.CallTime);
    console.log('Outgoing CallTime type:', typeof sampleOutgoing?.CallTime);
    console.log('Outgoing CallTime is Date?', sampleOutgoing?.CallTime instanceof Date);
    
    // Test date filtering
    console.log('\n========== TESTING DATE FILTERS ==========');
    
    // Today's date range
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log('Today start:', today.toISOString());
    console.log('Today end:', tomorrow.toISOString());
    
    // Count records for today
    const todayQueryDate = { CallTime: { $gte: today, $lt: tomorrow } };
    const todayCountIncoming = await incomingCollection.countDocuments(todayQueryDate);
    const todayCountOutgoing = await outgoingCollection.countDocuments(todayQueryDate);
    
    console.log('\nToday\'s records (using Date objects):');
    console.log('  Incoming:', todayCountIncoming);
    console.log('  Outgoing:', todayCountOutgoing);
    console.log('  Total:', todayCountIncoming + todayCountOutgoing);
    
    // Try with string dates (YYYY-MM-DD format)
    const todayString = today.toISOString().split('T')[0];
    const tomorrowString = tomorrow.toISOString().split('T')[0];
    
    console.log('\nTrying with string dates:', todayString, 'to', tomorrowString);
    
    // If CallTime is stored as string, try string comparison
    const todayQueryString = { 
      CallTime: { 
        $gte: todayString, 
        $lt: tomorrowString 
      } 
    };
    
    const todayCountIncomingString = await incomingCollection.countDocuments(todayQueryString);
    const todayCountOutgoingString = await outgoingCollection.countDocuments(todayQueryString);
    
    console.log('\nToday\'s records (using string dates):');
    console.log('  Incoming:', todayCountIncomingString);
    console.log('  Outgoing:', todayCountOutgoingString);
    console.log('  Total:', todayCountIncomingString + todayCountOutgoingString);
    
    // Last 30 days
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);
    
    const last30Query = { CallTime: { $gte: last30Days, $lte: today } };
    const last30CountIncoming = await incomingCollection.countDocuments(last30Query);
    const last30CountOutgoing = await outgoingCollection.countDocuments(last30Query);
    
    console.log('\nLast 30 days records:');
    console.log('  Incoming:', last30CountIncoming);
    console.log('  Outgoing:', last30CountOutgoing);
    console.log('  Total:', last30CountIncoming + last30CountOutgoing);
    
    // All time (no filter)
    const allCountIncoming = await incomingCollection.countDocuments({});
    const allCountOutgoing = await outgoingCollection.countDocuments({});
    
    console.log('\nAll time records:');
    console.log('  Incoming:', allCountIncoming);
    console.log('  Outgoing:', allCountOutgoing);
    console.log('  Total:', allCountIncoming + allCountOutgoing);
    
    // Check if we need to convert string dates to Date objects
    if (typeof sampleIncoming?.CallTime === 'string') {
      console.log('\n⚠️  WARNING: CallTime is stored as STRING, not Date object!');
      console.log('This is likely causing the date filtering issues.');
      
      // Try to parse the string format
      console.log('\nAttempting to parse CallTime string format...');
      const parsedDate = new Date(sampleIncoming.CallTime);
      console.log('Parsed date:', parsedDate);
      console.log('Is valid date?', !isNaN(parsedDate.getTime()));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

testDateFiltering();