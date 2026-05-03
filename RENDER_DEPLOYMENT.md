# Deploy Everything to Render - Complete Guide

Render allows you to deploy both backend and frontend in one place for **completely FREE** ✓

---

## Step 1: Push Your Code to GitHub

If not already done:

```bash
cd ~/Projects/"Burial Tracker"

# Initialize git if needed
git init

# Add everything
git add .

# Commit
git commit -m "Initial commit - Burial Tracker app"

# Create repo on GitHub at https://github.com/new
# Then push (follow GitHub instructions)

git remote add origin https://github.com/YOUR_USERNAME/burial-tracker.git
git branch -M main
git push -u origin main
```

---

## Step 2: Prepare Your Project Structure

Your project should look like:
```
burial-tracker/
├── backend/
│   ├── src/
│   ├── package.json
│   ├── tsconfig.json
│   └── dist/
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── dist/
├── data/
└── uploads/
```

### Check Backend Files

**backend/package.json** - Add this if missing:
```json
{
  "name": "burial-tracker-backend",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  },
  "engines": {
    "node": "18"
  },
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.0.0",
    "cors": "^2.8.5"
  }
}
```

**backend/tsconfig.json** - Should include:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### Check Frontend Files

**frontend/package.json** - Add this if missing:
```json
{
  "scripts": {
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

---

## Step 3: Create render.yaml Configuration

Create a file called `render.yaml` in your **root directory**:

```yaml
services:
  # Backend Service
  - type: web
    name: burial-tracker-backend
    env: node
    plan: free
    buildCommand: cd backend && npm install && npm run build
    startCommand: cd backend && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
    routes:
      - type: http
        path: /api
        rewrite: /api

  # Frontend Service (Static Site)
  - type: static_site
    name: burial-tracker-frontend
    plan: free
    buildCommand: cd frontend && npm install && npm run build
    staticPublishPath: frontend/dist
    envVars:
      - key: VITE_API_URL
        fromService:
          name: burial-tracker-backend
          property: url
        suffixPath: /api
```

---

## Step 4: Connect GitHub to Render

1. Go to https://render.com
2. Click **Sign Up** → Choose **GitHub**
3. Authorize Render to access GitHub
4. On Render dashboard, click **New** → **Web Service**
5. Select **Public Git Repository**
6. Paste your GitHub repo URL:
   ```
   https://github.com/YOUR_USERNAME/burial-tracker.git
   ```
7. Click **Connect**

---

## Step 5: Configure the Services

### If Using render.yaml (Recommended)

1. After connecting repo, Render will auto-detect `render.yaml`
2. Click **Deploy** → It will create both services automatically
3. Skip to Step 6

### If Creating Manually

**Create Backend Service:**
1. Click **New** → **Web Service**
2. Select your repo
3. Fill in:
   - **Name:** `burial-tracker-backend`
   - **Branch:** `main`
   - **Build Command:** `cd backend && npm install && npm run build`
   - **Start Command:** `cd backend && npm start`
   - **Plan:** Free
4. Click **Create Web Service**

**Create Frontend Service:**
1. Click **New** → **Static Site**
2. Select your repo
3. Fill in:
   - **Name:** `burial-tracker-frontend`
   - **Branch:** `main`
   - **Build Command:** `cd frontend && npm install && npm run build`
   - **Publish directory:** `frontend/dist`
   - **Plan:** Free
4. Click **Create Static Site**

---

## Step 6: Set Environment Variables

### For Backend Service:

1. Go to **burial-tracker-backend** service
2. Click **Environment**
3. Add variables:
   ```
   NODE_ENV = production
   PORT = 3001
   ```

### For Frontend Service:

1. Go to **burial-tracker-frontend** service
2. Click **Environment**
3. Add variable:
   ```
   VITE_API_URL = https://burial-tracker-backend.onrender.com
   ```
   (Replace with your actual backend URL from Render)

---

## Step 7: Update Frontend API Code

Edit **frontend/src/api.ts**:

```typescript
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const api = {
  getDashboard: (params: DashboardParams): Promise<DashboardData> => {
    const p = new URLSearchParams();
    if (params.period) p.set('period', params.period);
    if (params.start) p.set('start', params.start);
    if (params.end) p.set('end', params.end);
    if (params.jobsPage) p.set('jobsPage', params.jobsPage.toString());
    if (params.filterTech) p.set('filterTech', params.filterTech);
    if (params.jobSearch) p.set('jobSearch', params.jobSearch);
    
    return fetch(`${API_BASE}/dashboard?${p}`)
      .then(r => r.json());
  },
  // ... other API calls, add ${API_BASE} prefix to all routes
};
```

---

## Step 8: Deploy!

1. **Push code to GitHub:**
   ```bash
   git add .
   git commit -m "Deploy to Render"
   git push origin main
   ```

2. **Render will auto-deploy** when it detects new commits
3. Watch the deploy logs in Render dashboard
4. When complete, you'll get URLs:
   - Backend: `https://burial-tracker-backend.onrender.com`
   - Frontend: `https://burial-tracker-frontend.onrender.com`

---

## Step 9: Test Your App

1. Open the **frontend URL** in browser
2. You should see your app live! 🎉
3. Share the frontend URL with anyone

---

## Database Setup (Important)

By default, your database is in the `/data/` folder. Since Render's file system is temporary, the database will be **reset on redeploy**.

### Option A: Use Render's Postgres (FREE tier available)

1. In Render dashboard, click **New** → **PostgreSQL**
2. Choose **Free** plan
3. Get the connection string
4. Update `backend/src/db.ts` to use PostgreSQL instead of SQLite

### Option B: Keep SQLite Local (Simpler)

```bash
# Before deploying, seed your database locally
npm run seed

# Commit the database file
git add data/burial.db
git commit -m "Add database"
git push origin main
```

The data will persist unless you redeploy with rebuild.

### Option C: Use MongoDB Atlas (Completely Free)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create free cluster
4. Get connection string
5. Update backend to use MongoDB

---

## Full Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] `render.yaml` created in root directory
- [ ] Backend `package.json` has correct scripts
- [ ] Frontend `package.json` has correct scripts
- [ ] Backend `/src/index.ts` exports `app` or starts server
- [ ] Environment variables set in Render
- [ ] `frontend/src/api.ts` uses `VITE_API_URL`
- [ ] Database strategy decided (local/Postgres/MongoDB)

---

## Common Issues & Fixes

**Q: "Build failed - node_modules not found"**
A: Make sure each folder (backend, frontend) has `package.json` and `package-lock.json`

**Q: "Backend URL not found"**
A: Wait 5-10 minutes for Render to fully deploy. Then update frontend env var.

**Q: "CORS errors from frontend"**
A: Add to `backend/src/index.ts`:
```typescript
import cors from 'cors';
app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://burial-tracker-frontend.onrender.com' 
    : '*'
}));
```

**Q: "Database errors after redeploy"**
A: Either:
1. Use persistent database (Postgres/MongoDB)
2. Or commit `data/burial.db` to Git so it persists

**Q: "Still shows "Connecting..."**
A: Make sure backend SSE endpoint (`/api/events`) is accessible from frontend URL

---

## Getting Your Live URLs

Once deployed:

1. **Frontend URL:** https://burial-tracker-frontend.onrender.com
2. **Backend URL:** https://burial-tracker-backend.onrender.com
3. **API:** https://burial-tracker-backend.onrender.com/api

**Share the frontend URL with anyone!** They can use it on any device.

---

## Update Your App Later

1. Make changes locally
2. Push to GitHub: `git push origin main`
3. Render auto-deploys! (check logs in dashboard)

---

## Cost

- **Frontend:** Completely FREE ✓
- **Backend:** Completely FREE ✓
- **Database:** FREE for Postgres/MongoDB free tier ✓

**Total: $0/month** 🎉

---

## Next Steps

1. Create GitHub account if you don't have one
2. Push your code to GitHub (follow Step 1 above)
3. Sign up for Render.com with GitHub
4. Upload `render.yaml` to your repo
5. Render will auto-deploy everything!

Questions? The Render docs are at https://render.com/docs
