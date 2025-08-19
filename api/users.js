// Simple users endpoint for testing Vercel serverless functions
module.exports = function handler(req, res) {
  res.status(200).json({
    success: true,
    message: 'Users API endpoint is working!',
    data: [],
    total: 0
  });
};