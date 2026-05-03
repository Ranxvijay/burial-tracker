# Burial Tracker - Live Deployment Guide

## Option 1: Using ngrok (Quickest - 5 minutes)

**Best for:** Testing, demos, temporary access  
**Cost:** FREE (with limitations)  
**How long it lasts:** Until you stop ngrok

### Step 1: Install ngrok
```bash
# On macOS
brew install ngrok

# On Windows (download from https://ngrok.com/download)
# On Linux
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.zip
unzip ngrok-v3-stable-linux-amd64.zip
sudo mv ngrok /usr/local/bin
```

### Step 2: Create Free ngrok Account
1. Go to https://dashboard.ngrok.com/sign-up
2. Sign up with email
3. Copy your **Authtoken** from dashboard
4. In terminal, run: `ngrok config add-authtoken YOUR_AUTHTOKEN`

### Step 3: Expose Backend (Port 3001)
```bash
ngrok http 3001
```
You'll see something like:
```
Forwarding https://abc123def456.ngrok.io -> http://localhost:3001
```
**Copy the URL** - this is your backend address

### Step 4: Update Frontend to Use ngrok Backend
1. In a new terminal, edit `frontend/src/api.ts`
2. Find the line with `fetch('/api/...` 
3. Replace with: `fetch('https://abc123def456.ngrok.io/api/...`

Or set an environment variable in `frontend/.env`:
```
VITE_API_URL=https://abc123def456.ngrok.io
```

Then update `api.ts` to use: `const API_URL = import.meta.env.VITE_API_URL || ''`

### Step 5: Build & Deploy Frontend
```bash
cd frontend
npm run build
```

### Step 6: Serve Frontend with a Simple Server
```bash
# Use any of these:
# Option A: Python
python -m http.server 5173 --directory dist

# Option B: Node
npx serve -s dist -l 5173

# Option C: Using http-server globally
npm install -g http-server
http-server dist -p 5173
```

### Step 7: Share the URL
- Backend: `https://abc123def456.ngrok.io`
- Frontend: `http://localhost:5173` (or use another ngrok tunnel for frontend too)

**Limitations:**
- Free tier has ~1000 requests/month
- URL changes every 24 hours (unless you buy paid plan)
- Disconnects if you're idle for 1 hour

---

## Option 2: Railway (Better - 15 minutes)

**Best for:** Long-term free hosting  
**Cost:** FREE tier (5GB storage, limited compute)  
**How long it lasts:** As long as you need

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub (easiest)
3. Connect your GitHub account

### Step 2: Prepare Backend for Deployment
Edit `backend/package.json` - ensure it has:
```json
{
  "engines": {
    "node": "18"
  },
  "scripts": {
    "start": "node dist/index.js",
    "build": "tsc",
    "dev": "tsx watch src/index.js"
  }
}
```

### Step 3: Deploy Backend to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# In backend folder
cd backend
railway init
railway up
```

Follow prompts - select "Node.js" as the service

### Step 4: Set Environment Variables on Railway
In Railway dashboard:
1. Click on your service
2. Go to "Variables"
3. Add your `.env` variables (like GROQ_API_KEY if used)

### Step 5: Get Backend URL
In Railway dashboard, you'll see a public URL like:
```
https://burial-tracker-backend.railway.app
```

### Step 6: Deploy Frontend
**Option A: Use Vercel (Easiest)**
```bash
# Install Vercel CLI
npm install -g vercel

cd frontend

# Set environment variable
echo "VITE_API_URL=https://burial-tracker-backend.railway.app" > .env.production

# Deploy
vercel
```

**Option B: Deploy to Railway too**
```bash
cd frontend
npm run build

# In Railway, create a new service and upload the `dist` folder
railway init
# Select "Static Site" or "Nginx"
railway up
```

### Step 7: Access Your App
- Frontend: `https://your-app-name.vercel.app` (or Railway URL)
- Share the frontend URL with anyone

**Advantages:**
- Free for testing
- URL is permanent
- Better performance than ngrok
- Easy to update code

---

## Option 3: Render (Alternative - 15 minutes)

**Best for:** Full-stack hosting  
**Cost:** FREE tier available  
**How long it lasts:** Permanent (with free tier limits)

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up with GitHub

### Step 2: Deploy Backend
1. Click "New" → "Web Service"
2. Connect GitHub repo
3. Set:
   - **Environment:** Node
   - **Build command:** `cd backend && npm install && npm run build`
   - **Start command:** `cd backend && npm start`
   - **Publish directory:** backend (leave blank unless needed)

### Step 3: Copy Backend URL
```
https://burial-tracker-backend.onrender.com
```

### Step 4: Deploy Frontend
1. Click "New" → "Static Site"
2. Connect same GitHub repo
3. Set:
   - **Build command:** `cd frontend && npm install && npm run build`
   - **Publish directory:** `frontend/dist`

4. Before deploying, set environment variable:
   - Go to service settings → "Environment"
   - Add: `VITE_API_URL=https://burial-tracker-backend.onrender.com`

### Step 5: Access Your App
Frontend URL will be shown in Render dashboard

---

## Option 4: Simple Port Forwarding (For Local Network Only)

**Best for:** Accessing from devices on same WiFi  
**Cost:** FREE  
**How long it lasts:** As long as your computer is on

### Step 1: Find Your Computer's IP Address
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig

# Look for IPv4 address like 192.168.x.x
```

### Step 2: Access from Another Device
On another device connected to same WiFi:
```
http://192.168.x.x:5174
```

Replace `192.168.x.x` with your computer's IP

### Step 3: (Optional) Enable Internet Access
In your router settings:
1. Open router admin (usually 192.168.1.1)
2. Find "Port Forwarding"
3. Forward port 5173/3001 to your computer's IP
4. Use your public IP from https://whatismyipaddress.com

**Note:** This exposes your computer to the internet - use with caution!

---

## Quick Comparison

| Option | Setup Time | Cost | Permanence | Speed | Ease |
|--------|-----------|------|-----------|-------|------|
| ngrok | 5 min | Free | Temporary (24h) | Fast | Very Easy |
| Railway | 15 min | Free | Permanent | Good | Easy |
| Render | 15 min | Free | Permanent | Good | Easy |
| Vercel | 5 min | Free | Permanent | Very Fast | Very Easy |
| Port Forward | 5 min | Free | Permanent | Fast | Medium |

---

## Recommended: Use Vercel + Railway

**Best combination for minimal effort:**

1. **Backend:** Deploy to Railway (keep local if testing)
2. **Frontend:** Deploy to Vercel
3. **Total time:** 10 minutes
4. **Cost:** FREE
5. **URL:** Permanent and shareable

## Step-by-Step Simplified (Vercel + Railway)

```bash
# 1. Deploy backend to Railway
cd backend
npm install -g @railway/cli
railway login
railway init
railway up

# Note the URL shown, e.g., https://burial-tracker-backend.railway.app

# 2. Update frontend
cd ../frontend
echo "VITE_API_URL=https://burial-tracker-backend.railway.app" > .env.production

# 3. Deploy frontend to Vercel
npm install -g vercel
vercel

# Done! You'll get a URL like https://burial-tracker.vercel.app
```

Then share: **https://burial-tracker.vercel.app**

---

## Troubleshooting

**Q: "CORS errors when accessing from another device?"**
A: Make sure backend has CORS enabled. In `backend/src/index.ts`:
```typescript
const cors = require('cors');
app.use(cors({ origin: '*' }));
```

**Q: "Database not found on Railway?"**
A: Railway uses ephemeral storage. Either:
- Use a free tier database service (MongoDB Atlas, PlanetScale)
- Or keep database local and tunnel it

**Q: "My ngrok URL expired?"**
A: ngrok free tier URLs expire after 24h. Get a new one and update frontend URL.

**Q: "Still want it local but accessible?"**
A: Use ngrok (Option 1) - simplest temporary solution!
