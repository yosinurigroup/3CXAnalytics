# Vercel Deployment Guide for 3CX Analytics Backend

## Overview
This guide provides step-by-step instructions for deploying the 3CX Analytics backend to Vercel with proper serverless function configuration.

## Prerequisites
- Vercel account
- MongoDB Atlas cluster with connection string
- GitHub repository connected to Vercel

## Environment Variables Required

### MongoDB Configuration
```
MONGODB_URI=mongodb+srv://y2kgrouphosting:appsheet2025@cluster1.q4nlvh2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1
MONGODB_DATABASE=3cx
MONGODB_COLLECTION=tblIncomingCalls
MONGODB_OUT_COLLECTION=tblOutgoingCalls
MONGODB_AREACODES_COLLECTION=tblAreaCodes
MONGODB_USERS_COLLECTION=tblUsers
```

### Server Configuration
```
NODE_ENV=production
API_PORT=3001
```

### Authentication (Optional - for future use)
```
NEXTAUTH_SECRET=your-nextauth-secret-key-change-this-in-production
NEXTAUTH_URL=https://3-cx-analytics-back.vercel.app
```

## Deployment Steps

### 1. Configure Environment Variables in Vercel Dashboard

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each environment variable listed above:
   - **Name**: Variable name (e.g., `MONGODB_URI`)
   - **Value**: Variable value
   - **Environment**: Select `Production`, `Preview`, and `Development`
4. Click **Save** for each variable

### 2. Verify Project Structure

Ensure your project has the following structure:
```
server/
├── index.cjs                 # Main server file
├── vercel.json              # Vercel configuration (updated)
├── package.json             # Dependencies
├── services/                # MongoDB services
├── config/                  # Configuration files
├── routes/                  # API routes
├── utils/                   # Utility functions
└── uploads/                 # Upload directory
```

### 3. Deploy to Vercel

#### Option A: Automatic Deployment (Recommended)
1. Push your changes to the main branch of your GitHub repository
2. Vercel will automatically detect changes and deploy

#### Option B: Manual Deployment
1. Install Vercel CLI: `npm i -g vercel`
2. Navigate to the server directory: `cd server`
3. Run: `vercel --prod`
4. Follow the prompts

### 4. Verify Deployment

After deployment, test the following endpoints:

#### Health Check
```bash
curl https://3-cx-analytics-back.vercel.app/health
```
Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-18T04:53:00.000Z"
}
```

#### API Endpoints
```bash
# Test inbound calls endpoint
curl https://3-cx-analytics-back.vercel.app/api/inbound-calls?page=1&pageSize=10

# Test combined call logs
curl https://3-cx-analytics-back.vercel.app/api/call-logs?page=1&pageSize=10
```

## Configuration Details

### vercel.json Configuration
The updated `vercel.json` includes:
- **Runtime**: Node.js 20.x for better performance
- **Max Duration**: 30 seconds for complex queries
- **Include Files**: All necessary service and config files
- **Proper Routing**: Handles health checks and API routes correctly

### Frontend Integration
The frontend API service automatically detects the environment:
- **Development**: Uses `http://localhost:3001/api`
- **Production**: Uses `https://3-cx-analytics-back.vercel.app/api`

## Troubleshooting

### Common Issues

#### 1. FUNCTION_INVOCATION_FAILED
**Cause**: Missing environment variables or incorrect configuration
**Solution**: 
- Verify all environment variables are set in Vercel dashboard
- Check MongoDB connection string is correct
- Ensure database and collections exist

#### 2. Timeout Errors
**Cause**: Function execution exceeds time limit
**Solution**:
- Increase `maxDuration` in vercel.json (current: 30s)
- Optimize database queries
- Add proper indexes to MongoDB collections

#### 3. Module Not Found Errors
**Cause**: Missing files in serverless function
**Solution**:
- Verify `includeFiles` in vercel.json includes all necessary directories
- Check that all dependencies are listed in package.json

#### 4. CORS Errors
**Cause**: Frontend domain not allowed in CORS configuration
**Solution**:
- Update CORS origins in index.cjs to include your frontend domain
- Current configuration includes Vercel frontend URL

### Debug Steps

1. **Check Vercel Function Logs**:
   - Go to Vercel dashboard → Functions tab
   - Click on a function to view logs
   - Look for error messages and stack traces

2. **Test MongoDB Connection**:
   ```bash
   # Test connection string locally
   node -e "
   const { MongoClient } = require('mongodb');
   const client = new MongoClient('YOUR_MONGODB_URI');
   client.connect().then(() => {
     console.log('Connected successfully');
     client.close();
   }).catch(console.error);
   "
   ```

3. **Verify Environment Variables**:
   - Add temporary logging in index.cjs to verify env vars are loaded
   - Check Vercel dashboard for correct variable names and values

## Performance Optimization

### Database Indexes
Ensure these indexes exist in MongoDB:
```javascript
// Inbound calls collection
db.tblIncomingCalls.createIndex({ "CallTime": -1 })
db.tblIncomingCalls.createIndex({ "CallerID": 1 })
db.tblIncomingCalls.createIndex({ "Status": 1 })

// Outgoing calls collection
db.tblOutgoingCalls.createIndex({ "CallTime": -1 })
db.tblOutgoingCalls.createIndex({ "CallerID": 1 })

// Area codes collection
db.tblAreaCodes.createIndex({ "AreaCode": 1 })

// Users collection
db.tblUsers.createIndex({ "Email": 1 }, { unique: true })
```

### Function Configuration
- **Memory**: 1024 MB (default)
- **Timeout**: 30 seconds (configured)
- **Runtime**: Node.js 20.x (latest stable)

## Security Considerations

1. **Environment Variables**: Never commit sensitive data to repository
2. **MongoDB Access**: Use MongoDB Atlas IP whitelist (0.0.0.0/0 for Vercel)
3. **Rate Limiting**: Configured for 100 requests per minute per IP
4. **CORS**: Restricted to specific frontend domains
5. **Input Validation**: All endpoints validate input parameters

## Next Steps After Deployment

1. **Monitor Performance**: Use Vercel Analytics to track function performance
2. **Set Up Alerts**: Configure alerts for function failures
3. **Database Monitoring**: Monitor MongoDB Atlas metrics
4. **Update Frontend**: Ensure frontend points to production backend
5. **Test All Features**: Verify CSV import, filtering, and data retrieval work correctly

## Support

If you encounter issues:
1. Check Vercel function logs for detailed error messages
2. Verify MongoDB Atlas connection and permissions
3. Test endpoints individually to isolate problems
4. Review this guide for common solutions

## Deployment Checklist

- [ ] All environment variables configured in Vercel
- [ ] MongoDB Atlas cluster accessible (IP whitelist: 0.0.0.0/0)
- [ ] Database and collections exist with proper indexes
- [ ] vercel.json configuration updated
- [ ] Frontend API configuration updated for production
- [ ] Health check endpoint responds correctly
- [ ] Main API endpoints return data
- [ ] CSV import functionality works
- [ ] Authentication endpoints functional (if using)
- [ ] CORS configuration allows frontend domain
- [ ] Function logs show no critical errors