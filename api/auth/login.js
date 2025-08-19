const { connectToDatabase } = require('../_lib/mongodb');
const bcrypt = require('bcrypt');

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, Accept, Expires');
  res.setHeader('Access-Control-Allow-Credentials', 'false');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    console.log('[AUTH] Login attempt for email:', email);
    
    // Connect to MongoDB
    const { db } = await connectToDatabase();
    const collection = db.collection(process.env.MONGODB_USERS_COLLECTION || 'tblUsers');
    
    // Find user by email (including password for verification)
    const user = await collection.findOne(
      { Email: email.trim().toLowerCase() },
      { projection: {} } // Include all fields including password
    );
    
    if (!user) {
      console.log('[AUTH] User not found:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.Password);
    
    if (!isValidPassword) {
      console.log('[AUTH] Invalid password for user:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    console.log('[AUTH] Login successful for user:', email);
    
    // Return user data without password
    const { Password, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      user: userWithoutPassword,
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
};