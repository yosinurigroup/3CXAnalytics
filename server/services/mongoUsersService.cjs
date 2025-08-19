const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

class MongoUsersService {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected && this.client) {
      return;
    }

    try {
      const uri = process.env.MONGODB_URI;
      if (!uri) {
        throw new Error('MONGODB_URI environment variable is not set');
      }

      console.log('[MONGO-USERS] Connecting to MongoDB...');
      this.client = new MongoClient(uri);
      await this.client.connect();
      
      this.db = this.client.db(process.env.MONGODB_DATABASE || '3cx');
      this.collection = this.db.collection(process.env.MONGODB_USERS_COLLECTION || 'tblUsers');
      this.isConnected = true;
      
      console.log('[MONGO-USERS] Connected to MongoDB - tblUsers collection');
      
      // Create indexes for better performance
      await this.createIndexes();
    } catch (error) {
      console.error('[MONGO-USERS] Connection error:', error);
      throw error;
    }
  }

  async createIndexes() {
    try {
      // Create indexes for users
      await this.collection.createIndex({ Email: 1 }, { name: 'idx_email', unique: true });
      await this.collection.createIndex({ FirstName: 1, LastName: 1 }, { name: 'idx_fullname' });
      await this.collection.createIndex({ Role: 1 }, { name: 'idx_role' });
      
      console.log('[MONGO-USERS] Indexes created successfully');
    } catch (error) {
      console.error('[MONGO-USERS] Error creating indexes:', error);
    }
  }

  async fetchUsers(params = {}) {
    await this.connect();
    
    try {
      const {
        page = 1,
        pageSize = 50,
        search = '',
        sortBy = 'FirstName',
        sortOrder = 'ASC',
        ...filters
      } = params;

      console.log('[MONGO-USERS] Fetching with params:', params);

      // Build query
      const query = {};

      // Search filter
      if (search) {
        query.$or = [
          { FirstName: { $regex: search, $options: 'i' } },
          { LastName: { $regex: search, $options: 'i' } },
          { Email: { $regex: search, $options: 'i' } },
          { Role: { $regex: search, $options: 'i' } }
        ];
      }

      // Column filters
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          if (Array.isArray(filters[key])) {
            query[key] = { $in: filters[key] };
          } else {
            query[key] = { $regex: filters[key], $options: 'i' };
          }
        }
      });

      // Sort configuration
      const sortConfig = {};
      sortConfig[sortBy] = sortOrder === 'ASC' ? 1 : -1;

      // Execute query with pagination
      const skip = (page - 1) * pageSize;
      const [data, total] = await Promise.all([
        this.collection
          .find(query, { projection: { Password: 0 } }) // Exclude password from results
          .sort(sortConfig)
          .skip(skip)
          .limit(parseInt(pageSize))
          .toArray(),
        this.collection.countDocuments(query)
      ]);

      console.log(`[MONGO-USERS] Found ${total} total records, returning ${data.length} for page ${page}`);

      return {
        success: true,
        data: data,
        total: total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      console.error('[MONGO-USERS] Fetch error:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        total: 0
      };
    }
  }

  async createUser(userData) {
    await this.connect();
    
    try {
      console.log('[MONGO-USERS] Creating new user:', { ...userData, Password: '[HIDDEN]' });

      // Validate required fields
      const { FirstName, LastName, EmailAddress, Email, Role, Password } = userData;
      const emailToUse = Email || EmailAddress; // Support both field names
      if (!FirstName || !LastName || !emailToUse || !Role || !Password) {
        throw new Error('All fields are required: FirstName, LastName, Email, Role, Password');
      }

      // Check if email already exists
      const existingUser = await this.collection.findOne({ Email: emailToUse.toLowerCase() });
      if (existingUser) {
        throw new Error('A user with this email address already exists');
      }

      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(Password, saltRounds);

      // Prepare the document
      const doc = {
        FirstName: FirstName.trim(),
        LastName: LastName.trim(),
        Email: emailToUse.trim().toLowerCase(),
        Role: Role.trim(),
        Password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await this.collection.insertOne(doc);
      
      console.log('[MONGO-USERS] User created successfully with ID:', result.insertedId);
      
      // Return the created user without password
      const createdUser = await this.collection.findOne(
        { _id: result.insertedId },
        { projection: { Password: 0 } }
      );

      return {
        success: true,
        data: createdUser,
        message: 'User created successfully'
      };
    } catch (error) {
      console.error('[MONGO-USERS] Create user error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateUser(userId, userData) {
    await this.connect();
    
    try {
      console.log('[MONGO-USERS] Updating user:', userId, { ...userData, Password: userData.Password ? '[HIDDEN]' : undefined });

      // Validate ObjectId
      if (!ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format');
      }

      // Check if user exists
      const existingUser = await this.collection.findOne({ _id: new ObjectId(userId) });
      if (!existingUser) {
        throw new Error('User not found');
      }

      // If email is being updated, check for duplicates
      const newEmail = userData.Email || userData.EmailAddress;
      if (newEmail && newEmail !== existingUser.Email) {
        const emailExists = await this.collection.findOne({
          Email: newEmail.trim().toLowerCase(),
          _id: { $ne: new ObjectId(userId) }
        });
        if (emailExists) {
          throw new Error('A user with this email address already exists');
        }
      }

      // Prepare update document
      const updateDoc = {
        updatedAt: new Date()
      };

      // Only update provided fields
      if (userData.FirstName) updateDoc.FirstName = userData.FirstName.trim();
      if (userData.LastName) updateDoc.LastName = userData.LastName.trim();
      if (userData.Email || userData.EmailAddress) {
        updateDoc.Email = (userData.Email || userData.EmailAddress).trim().toLowerCase();
      }
      if (userData.Role) updateDoc.Role = userData.Role.trim();
      if (userData.Password) {
        // Hash the password before storing
        const saltRounds = 10;
        updateDoc.Password = await bcrypt.hash(userData.Password, saltRounds);
      }

      const result = await this.collection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: updateDoc }
      );

      if (result.matchedCount === 0) {
        throw new Error('User not found');
      }

      console.log('[MONGO-USERS] User updated successfully');
      
      // Return the updated user without password
      const updatedUser = await this.collection.findOne(
        { _id: new ObjectId(userId) },
        { projection: { Password: 0 } }
      );

      return {
        success: true,
        data: updatedUser,
        message: 'User updated successfully'
      };
    } catch (error) {
      console.error('[MONGO-USERS] Update user error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteUser(userId) {
    await this.connect();
    
    try {
      console.log('[MONGO-USERS] Deleting user:', userId);

      // Validate ObjectId
      if (!ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format');
      }

      const result = await this.collection.deleteOne({ _id: new ObjectId(userId) });

      if (result.deletedCount === 0) {
        throw new Error('User not found');
      }

      console.log('[MONGO-USERS] User deleted successfully');

      return {
        success: true,
        message: 'User deleted successfully'
      };
    } catch (error) {
      console.error('[MONGO-USERS] Delete user error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getUserById(userId) {
    await this.connect();
    
    try {
      console.log('[MONGO-USERS] Fetching user by ID:', userId);

      // Validate ObjectId
      if (!ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format');
      }

      const user = await this.collection.findOne(
        { _id: new ObjectId(userId) },
        { projection: { Password: 0 } } // Exclude password
      );

      if (!user) {
        throw new Error('User not found');
      }

      return {
        success: true,
        data: user
      };
    } catch (error) {
      console.error('[MONGO-USERS] Get user by ID error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get user by email with password (for authentication)
  async getUserByEmailWithPassword(email) {
    await this.connect();
    
    try {
      console.log('[MONGO-USERS] Finding user by email for authentication:', email);

      const user = await this.collection.findOne(
        { Email: email.trim().toLowerCase() },
        { projection: {} } // Include all fields including password
      );

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      console.log('[MONGO-USERS] User found for authentication:', user.FirstName, user.LastName);

      return {
        success: true,
        user: user
      };
    } catch (error) {
      console.error('[MONGO-USERS] Get user by email error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getCollectionStats() {
    await this.connect();
    
    try {
      const stats = await this.db.command({ collStats: 'tblUsers' });
      const count = await this.collection.countDocuments();
      
      return {
        success: true,
        stats: {
          count,
          size: stats.size,
          avgObjSize: stats.avgObjSize,
          storageSize: stats.storageSize,
          indexes: stats.nindexes
        }
      };
    } catch (error) {
      console.error('[MONGO-USERS] Stats error:', error);
      return { success: false, error: error.message };
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log('[MONGO-USERS] Disconnected from MongoDB');
    }
  }
}

// Create service instance
const mongoUsersService = new MongoUsersService();

// Helper functions for easier access
const fetchUsers = (params) => mongoUsersService.fetchUsers(params);
const createUser = (userData) => mongoUsersService.createUser(userData);
const updateUser = (userId, userData) => mongoUsersService.updateUser(userId, userData);
const deleteUser = (userId) => mongoUsersService.deleteUser(userId);
const getUserById = async (userId) => {
  const result = await mongoUsersService.getUserById(userId);
  return result.success ? result.data : null;
};
const getUserByEmailWithPassword = async (email) => {
  const result = await mongoUsersService.getUserByEmailWithPassword(email);
  return result.success ? result.user : null;
};
const updateUserProfile = (userId, profileData) => mongoUsersService.updateUser(userId, profileData);
const getCollectionStats = () => mongoUsersService.getCollectionStats();

module.exports = {
  MongoUsersService,
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserById,
  getUserByEmailWithPassword,
  updateUserProfile,
  getCollectionStats
};