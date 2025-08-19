const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// MongoDB connection configuration
const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DATABASE || '3cx';
const COLLECTION_NAME = process.env.MONGODB_COLLECTION || 'tblIncomingCalls';

// MongoDB client instance
let mongoClient = null;
let database = null;
let collection = null;

// Mongoose connection
let isMongooseConnected = false;

/**
 * Initialize MongoDB connection
 */
async function initializeMongoDB() {
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    // Initialize native MongoDB client
    mongoClient = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    await mongoClient.connect();
    database = mongoClient.db(DATABASE_NAME);
    collection = database.collection(COLLECTION_NAME);

    console.log(`✅ MongoDB connected to database: ${DATABASE_NAME}`);
    console.log(`📋 Using collection: ${COLLECTION_NAME}`);

    // Initialize Mongoose connection for schema-based operations
    if (!isMongooseConnected) {
      await mongoose.connect(MONGODB_URI, {
        dbName: DATABASE_NAME,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
      });
      isMongooseConnected = true;
      console.log('✅ Mongoose connected successfully');
    }

    // Create indexes for better performance
    await createIndexes();

    return { mongoClient, database, collection };
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
}

/**
 * Create indexes for optimal query performance
 */
async function createIndexes() {
  try {
    if (!collection) {
      throw new Error('Collection not initialized');
    }

    // Create compound index for CallTime and CallerID (primary query pattern)
    await collection.createIndex(
      { CallTime: -1, CallerID: 1 },
      { name: 'calltime_callerid_idx', background: true }
    );

    // Create index for CallTime (for date range queries)
    await collection.createIndex(
      { CallTime: -1 },
      { name: 'calltime_idx', background: true }
    );

    // Create text index for search functionality
    await collection.createIndex(
      {
        CallerID: 'text',
        Destination: 'text',
        Trunk: 'text',
        Status: 'text',
        CallType: 'text',
        Sentiment: 'text'
      },
      { name: 'search_text_idx', background: true }
    );

    // Create indexes for common filter fields
    await collection.createIndex({ Status: 1 }, { name: 'status_idx', background: true });
    await collection.createIndex({ CallType: 1 }, { name: 'calltype_idx', background: true });
    await collection.createIndex({ Sentiment: 1 }, { name: 'sentiment_idx', background: true });
    await collection.createIndex({ Trunk: 1 }, { name: 'trunk_idx', background: true });

    console.log('✅ MongoDB indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    // Don't throw error here as indexes are not critical for basic functionality
  }
}

/**
 * Get MongoDB collection instance
 */
function getCollection() {
  if (!collection) {
    throw new Error('MongoDB not initialized. Call initializeMongoDB() first.');
  }
  return collection;
}

/**
 * Get MongoDB database instance
 */
function getDatabase() {
  if (!database) {
    throw new Error('MongoDB not initialized. Call initializeMongoDB() first.');
  }
  return database;
}

/**
 * Get MongoDB client instance
 */
function getClient() {
  if (!mongoClient) {
    throw new Error('MongoDB not initialized. Call initializeMongoDB() first.');
  }
  return mongoClient;
}

/**
 * Close MongoDB connections
 */
async function closeMongoDB() {
  try {
    if (mongoClient) {
      await mongoClient.close();
      console.log('✅ MongoDB client connection closed');
    }
    
    if (isMongooseConnected) {
      await mongoose.connection.close();
      isMongooseConnected = false;
      console.log('✅ Mongoose connection closed');
    }
  } catch (error) {
    console.error('❌ Error closing MongoDB connections:', error);
  }
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  await closeMongoDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeMongoDB();
  process.exit(0);
});

module.exports = {
  initializeMongoDB,
  getCollection,
  getDatabase,
  getClient,
  closeMongoDB,
  DATABASE_NAME,
  COLLECTION_NAME
};