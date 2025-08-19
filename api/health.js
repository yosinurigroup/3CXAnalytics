// Simple health check endpoint for Vercel serverless functions
export default function handler(req, res) {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'API is working!'
  });
}