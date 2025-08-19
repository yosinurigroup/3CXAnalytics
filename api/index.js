// Vercel serverless function handler for 3CX Analytics API
// This file imports the Express app from ../server/index.cjs and exports it as a serverless function

const app = require('../server/index.cjs');

// Export the handler function that Vercel expects
// This follows the pattern: (req, res) => app(req, res)
module.exports = (req, res) => {
  return app(req, res);
};