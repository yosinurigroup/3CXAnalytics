const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://y2kgrouphosting:appsheet2025@cluster1.q4nlvh2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1';
const DATABASE_NAME = process.env.MONGODB_DATABASE || '3cx';

async function hashExistingPasswords() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    const collection = db.collection('tblUsers');
    
    // Get all users
    const users = await collection.find({}).toArray();
    console.log(`Found ${users.length} users to update`);
    
    for (const user of users) {
      // Check if password is already hashed (bcrypt hashes start with $2b$)
      if (!user.Password || user.Password.startsWith('$2b$')) {
        console.log(`Skipping ${user.Email} - password already hashed or empty`);
        continue;
      }
      
      // Hash the plain text password
      const hashedPassword = await bcrypt.hash(user.Password, 10);
      
      // Update the user with hashed password
      await collection.updateOne(
        { _id: user._id },
        { $set: { Password: hashedPassword } }
      );
      
      console.log(`Updated password for ${user.Email}`);
    }
    
    console.log('Password hashing completed successfully');
    
  } catch (error) {
    console.error('Error hashing passwords:', error);
  } finally {
    await client.close();
  }
}

hashExistingPasswords();