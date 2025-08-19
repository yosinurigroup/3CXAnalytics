const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function createAdminUser() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(process.env.MONGODB_DATABASE || '3cx');
    const collection = db.collection(process.env.MONGODB_USERS_COLLECTION || 'tblUsers');
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Create admin user
    const adminUser = {
      FirstName: 'Admin',
      LastName: 'User',
      EmailAddress: 'admin@3cx.com',
      Password: hashedPassword,
      Role: 'Admin',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Check if user already exists
    const existingUser = await collection.findOne({ EmailAddress: 'admin@3cx.com' });
    
    if (existingUser) {
      // Update existing user
      await collection.updateOne(
        { EmailAddress: 'admin@3cx.com' },
        { 
          $set: {
            FirstName: 'Admin',
            LastName: 'User',
            Password: hashedPassword,
            Role: 'Admin',
            updatedAt: new Date()
          }
        }
      );
      console.log('✅ Updated existing admin user: admin@3cx.com / admin123');
    } else {
      // Insert new user
      await collection.insertOne(adminUser);
      console.log('✅ Created new admin user: admin@3cx.com / admin123');
    }
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await client.close();
  }
}

createAdminUser();