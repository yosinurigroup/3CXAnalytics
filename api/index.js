// Vercel serverless function handler for 3CX Analytics API
// This file imports the Express app from ../server/index.cjs and exports it as a serverless function

let app;

// Lazy load the app to handle any import issues
const getApp = () => {
  if (!app) {
    try {
      app = require('../server/index.cjs');
    } catch (error) {
      console.error('Failed to load Express app:', error);
      throw error;
    }
  }
  return app;
};

// Export the handler function that Vercel expects
module.exports = (req, res) => {
  try {
    const expressApp = getApp();
    return expressApp(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};