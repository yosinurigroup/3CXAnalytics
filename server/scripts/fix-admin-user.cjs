const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function fixAdminUser() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db(process.env.MONGODB_DATABASE || '3cx');
    const collection = db.collection(process.env.MONGODB_USERS_COLLECTION || 'tblUsers');
    
    const email = 'admin@y2kgrouphosting.com';
    const password = 'Appsheet2024!';
    
    console.log(`\nChecking for user with email: ${email}`);
    
    // Check if user exists
    const existingUser = await collection.findOne({
      Email: email.toLowerCase()
    });
    
    if (existingUser) {
      console.log('User found! Updating password...');
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Update the user's password and ensure Admin role
      const updateResult = await collection.updateOne(
        { Email: email.toLowerCase() },
        {
          $set: {
            Password: hashedPassword,
            Role: 'Admin',
            updatedAt: new Date()
          }
        }
      );
      
      console.log('✅ Password updated successfully!');
      console.log(`   Modified ${updateResult.modifiedCount} document(s)`);
      
    } else {
      console.log('User not found. Creating new admin user...');
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create new user
      const newUser = {
        FirstName: 'Admin',
        LastName: 'User',
        Email: email.toLowerCase(),
        Role: 'Admin',
        Password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const insertResult = await collection.insertOne(newUser);
      
      console.log('✅ Admin user created successfully!');
      console.log(`   Inserted with ID: ${insertResult.insertedId}`);
    }
    
    // Verify the user can be found and password works
    console.log('\n🔍 Verifying user setup...');
    const verifyUser = await collection.findOne({
      Email: email.toLowerCase()
    });
    
    if (verifyUser) {
      console.log('✅ User exists in database');
      console.log(`   Name: ${verifyUser.FirstName} ${verifyUser.LastName}`);
      console.log(`   Email: ${verifyUser.Email}`);
      console.log(`   Role: ${verifyUser.Role}`);
      
      // Test password
      const passwordMatch = await bcrypt.compare(password, verifyUser.Password);
      if (passwordMatch) {
        console.log('✅ Password verification successful!');
      } else {
        console.log('❌ Password verification failed!');
      }
    } else {
      console.log('❌ User not found after creation/update!');
    }
    
    console.log('\n✨ Setup complete! You can now log in with:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the fix
fixAdminUser().catch(console.error);