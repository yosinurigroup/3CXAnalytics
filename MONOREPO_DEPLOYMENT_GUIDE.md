# 3CX Analytics - Monorepo Deployment Guide

## Overview

This project has been restructured as a monorepo for unified Vercel deployment. The application now deploys as a single project that serves both the React frontend and Express.js API backend.

## Project Structure

```
3CXAnalyticsMDB/
├── vercel.json                 # Root Vercel configuration
├── package.json               # Root package.json for monorepo
├── .vercelignore             # Files to ignore during deployment
├── client/                   # React frontend
│   ├── dist/                # Built frontend assets (generated)
│   ├── package.json         # Client dependencies
│   └── vite.config.ts       # Vite build configuration
└── server/                  # Express.js backend
    ├── api/
    │   └── index.js         # Vercel serverless function entry
    ├── index.cjs            # Main Express application
    ├── package.json         # Server dependencies
    └── vercel.json          # Server-specific Vercel config
```

## Deployment Architecture

### Single Vercel Project
- **Frontend**: Served from `/client/dist/` as static files
- **API**: Served from `/server/api/index.js` as serverless functions
- **Routes**:
  - `/` → React app (index.html)
  - `/api/*` → Express.js API endpoints
  - `/health` → Health check endpoint
  - Static assets → Cached with appropriate headers

### Build Process
1. **Root level**: `npm run build`
2. **Client build**: `cd client && npm ci && npm run build`
3. **Server build**: Server files are used as-is (no build step needed)
4. **Static serving**: Server serves client/dist/ files for frontend routes

## Key Configuration Files

### Root `vercel.json`
- Defines monorepo deployment strategy
- Routes API calls to server functions
- Routes static assets to client build
- Handles SPA routing fallback

### Root `package.json`
- Coordinates build process
- Defines workspace structure
- Manages monorepo scripts

### Server Configuration
- `server/index.cjs`: Updated static file paths for deployment
- `server/vercel.json`: Simplified to only define function config
- `server/api/index.js`: Serverless function wrapper

## Environment Variables

Set these in Vercel dashboard:
- `MONGODB_URI`: MongoDB connection string
- `MONGODB_DATABASE`: Database name (default: 3cx)
- `NODE_ENV`: Set to "production"
- Any other environment variables your app needs

## Deployment Steps

1. **Connect to Vercel**:
   ```bash
   vercel --prod
   ```

2. **Configure Build Settings** (in Vercel dashboard):
   - Build Command: `npm run build`
   - Install Command: `npm install && cd client && npm install && cd ../server && npm install`
   - Output Directory: Leave empty (uses default)

3. **Set Environment Variables** in Vercel dashboard

4. **Deploy**:
   - Push to main branch for automatic deployment
   - Or use `vercel --prod` for manual deployment

## Local Development

```bash
# Install all dependencies
npm run install:all

# Run both client and server in development
npm run dev

# Or run separately:
npm run dev:client  # Client on port 8080
npm run dev:server  # Server on port 3001
```

## Troubleshooting

### Common Issues

1. **404 on API routes**: Check that routes start with `/api/`
2. **Static files not loading**: Verify client build completed successfully
3. **Environment variables**: Ensure they're set in Vercel dashboard
4. **Build failures**: Check that all dependencies are properly installed

### Verification Steps

1. Check health endpoint: `https://your-app.vercel.app/health`
2. Test API endpoint: `https://your-app.vercel.app/api/record-counts`
3. Verify frontend loads: `https://your-app.vercel.app/`
4. Check browser console for errors

## Migration from Separate Deployments

If migrating from separate frontend/backend deployments:

1. Delete old Vercel projects
2. Deploy this monorepo as a single project
3. Update any external references to the new single domain
4. Update CORS settings if needed (should be automatic)

## Performance Optimizations

- Static assets cached for 1 year
- HTML files not cached (always fresh)
- Gzip compression enabled
- Optimized bundle splitting in Vite config
- Serverless functions with 30s timeout