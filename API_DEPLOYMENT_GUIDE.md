# 3CX Analytics API Deployment Guide

## Overview
The API functions have been successfully converted to Vercel serverless functions. Here's what was implemented:

## ✅ Implemented API Endpoints

### Core Endpoints
- **`/api/health`** - Health check with MongoDB connection test
- **`/api/auth/login`** - User authentication
- **`/api/users`** - User management (GET)
- **`/api/inbound-calls`** - Inbound calls data (GET)
- **`/api/call-logs`** - Combined call logs (incoming + outgoing) (GET)
- **`/api/record-counts`** - Dashboard statistics (GET)

### Architecture Changes
- ❌ **Removed**: `api/index.js` (was trying to import entire Express server)
- ✅ **Added**: Individual serverless functions for each endpoint
- ✅ **Added**: `api/_lib/mongodb.js` - Shared MongoDB connection utility
- ✅ **Updated**: Root `package.json` with required dependencies

## 🔧 Required Environment Variables

You **MUST** set these environment variables in your Vercel dashboard:

### MongoDB Configuration
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority&appName=YourApp
MONGODB_DATABASE=3cx
MONGODB_COLLECTION=tblIncomingCalls
MONGODB_OUT_COLLECTION=tblOutgoingCalls
MONGODB_AREACODES_COLLECTION=tblAreaCodes
MONGODB_USERS_COLLECTION=tblUsers
```

### Application Configuration
```
NODE_ENV=production
```

## 🚀 Deployment Steps

### 1. Set Environment Variables in Vercel
1. Go to your Vercel dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add all the MongoDB variables listed above
5. Make sure to set them for **Production**, **Preview**, and **Development**

### 2. Deploy the Updated Code
```bash
# The code is ready to deploy
git add .
git commit -m "Convert server to Vercel serverless functions"
git push
```

### 3. Verify Deployment
After deployment, test these endpoints:
- `https://your-app.vercel.app/api/health` - Should return database connection status
- `https://your-app.vercel.app/api/record-counts` - Should return collection counts
- `https://your-app.vercel.app/api/users` - Should return users data

## 🔍 Frontend Configuration

The frontend is already configured to use the correct API endpoints:
- **Production**: Uses `/api` (relative URLs)
- **Development**: Uses `http://localhost:3001/api`

## 📊 Expected Functionality

Once deployed with proper environment variables:

1. **Login Page** (`/login`) - Should authenticate users
2. **Dashboard** (`/`) - Should show record counts and statistics
3. **Call Logs** (`/call-logs`) - Should display combined incoming/outgoing calls
4. **Users** (`/users`) - Should display user management interface

## 🐛 Troubleshooting

### If API returns 500 errors:
1. Check Vercel function logs in dashboard
2. Verify all environment variables are set correctly
3. Ensure MongoDB URI is accessible from Vercel

### If API returns 404 errors:
1. Verify the serverless functions are deployed
2. Check that the API routes match the frontend calls
3. Ensure no caching issues by adding `?_t=${Date.now()}` to requests

### If MongoDB connection fails:
1. Verify MongoDB URI format and credentials
2. Check MongoDB Atlas network access (allow all IPs: 0.0.0.0/0)
3. Ensure database and collection names match your MongoDB setup

## 📝 Next Steps

1. **Set environment variables in Vercel dashboard**
2. **Deploy the updated code**
3. **Test all API endpoints**
4. **Verify full application functionality**

The application should now be fully functional with working API endpoints!