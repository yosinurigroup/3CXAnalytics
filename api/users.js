// Simple users endpoint for testing Vercel serverless functions
export default function handler(req, res) {
  res.status(200).json({ 
    success: true,
    message: 'Users API endpoint is working!',
    data: [],
    total: 0
  });
}