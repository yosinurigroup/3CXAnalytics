const { connectToMongoDB } = require('../config/mongodb.cjs');

/**
 * Create indexes for optimal query performance in MongoDB
 */
async function createIndexes() {
  try {
    console.log('Creating indexes for MongoDB inbound_calls collection...');
    
    const { db } = await connectToMongoDB();
    const collection = db.collection(process.env.MONGODB_COLLECTION || 'inbound_calls');
    
    // Create indexes for MongoDB optimization
    console.log('Creating CallTime index (descending for recent calls first)...');
    await collection.createIndex({ CallTime: -1 });
    
    console.log('Creating CallerID index...');
    await collection.createIndex({ CallerID: 1 });
    
    console.log('Creating Status index...');
    await collection.createIndex({ Status: 1 });
    
    console.log('Creating Destination index...');
    await collection.createIndex({ Destination: 1 });
    
    console.log('Creating compound unique index on CallTime_CallerID...');
    await collection.createIndex({ "CallTime_CallerID": 1 }, { unique: true });
    
    console.log('Creating compound index on CallTime and CallerID...');
    await collection.createIndex({ CallTime: -1, CallerID: 1 });
    
    console.log('Creating text index for search functionality...');
    await collection.createIndex({ 
      CallerID: "text", 
      Destination: "text", 
      Status: "text" 
    });
    
    console.log('MongoDB indexes created successfully!');
    
    console.log('\nMongoDB Optimization Tips:');
    console.log('1. Collection is indexed by CallTime for efficient date-range queries');
    console.log('2. Compound indexes support efficient filtering by multiple fields');
    console.log('3. Use the compound key (CallTime + CallerID) for deduplication');
    console.log('4. Text indexes enable full-text search across multiple fields');
    console.log('5. Consider using aggregation pipelines for complex queries');
    
  } catch (error) {
    console.error('Error in index creation:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  createIndexes().then(() => {
    console.log('Index creation process completed');
    process.exit(0);
  }).catch(error => {
    console.error('Failed to create indexes:', error);
    process.exit(1);
  });
}

module.exports = { createIndexes };