const { MongoClient } = require('mongodb');

async function checkAllDatabases() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB\n');
    
    // List all databases
    const adminDb = client.db().admin();
    const dbList = await adminDb.listDatabases();
    
    console.log('========================================');
    console.log('ALL DATABASES IN MONGODB');
    console.log('========================================');
    
    for (const dbInfo of dbList.databases) {
      console.log(`\nDatabase: ${dbInfo.name}`);
      console.log(`  Size: ${(dbInfo.sizeOnDisk / 1024 / 1024).toFixed(2)} MB`);
      
      // Skip system databases
      if (dbInfo.name === 'admin' || dbInfo.name === 'config' || dbInfo.name === 'local') {
        console.log('  (System database - skipping)');
        continue;
      }
      
      // Check collections in this database
      const db = client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();
      
      if (collections.length > 0) {
        console.log('  Collections:');
        for (const coll of collections) {
          const collection = db.collection(coll.name);
          const count = await collection.countDocuments();
          console.log(`    - ${coll.name}: ${count} documents`);
          
          // If it looks like a call log collection, show sample
          if (coll.name.toLowerCase().includes('call') || 
              coll.name.toLowerCase().includes('incoming') || 
              coll.name.toLowerCase().includes('outgoing')) {
            
            const sample = await collection.findOne();
            if (sample) {
              console.log(`      Sample fields: ${Object.keys(sample).slice(0, 5).join(', ')}...`);
              if (sample.CallTime) {
                console.log(`      CallTime sample: ${new Date(sample.CallTime).toISOString()}`);
              }
            }
          }
        }
      } else {
        console.log('  (No collections)');
      }
    }
    
    // Specifically check for 3CX related data
    console.log('\n========================================');
    console.log('SEARCHING FOR 3CX CALL DATA');
    console.log('========================================');
    
    const possibleDbNames = ['3CXCallLogs', '3cx', 'callLogs', 'calls', 'test'];
    const possibleCollNames = ['tblIncomingCalls', 'tblOutgoingCalls', 'incomingCalls', 'outgoingCalls', 'calls'];
    
    for (const dbName of possibleDbNames) {
      try {
        const db = client.db(dbName);
        const collections = await db.listCollections().toArray();
        
        if (collections.length > 0) {
          console.log(`\nFound database: ${dbName}`);
          
          for (const collName of possibleCollNames) {
            try {
              const collection = db.collection(collName);
              const count = await collection.countDocuments();
              if (count > 0) {
                console.log(`  ✓ ${collName}: ${count} documents`);
                
                // Show date range
                const earliest = await collection.findOne({}, { sort: { CallTime: 1 } });
                const latest = await collection.findOne({}, { sort: { CallTime: -1 } });
                
                if (earliest?.CallTime && latest?.CallTime) {
                  console.log(`    Date range: ${new Date(earliest.CallTime).toISOString().split('T')[0]} to ${new Date(latest.CallTime).toISOString().split('T')[0]}`);
                }
              }
            } catch (e) {
              // Collection doesn't exist, skip
            }
          }
        }
      } catch (e) {
        // Database doesn't exist, skip
      }
    }
    
  } catch (error) {
    console.error('Error checking databases:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the check
checkAllDatabases().catch(console.error);