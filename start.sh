#!/bin/bash
set -e

# Install dependencies if needed
if [ ! -d "backend/node_modules" ]; then
  echo "Installing backend dependencies..."
  cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  cd frontend && npm install && cd ..
fi

# Create .env if missing
if [ ! -f "backend/.env" ]; then
  cp backend/.env.example backend/.env
  echo "Created backend/.env — add your GROQ_API_KEY for AI features"
fi

echo ""
echo "Starting Tech Performance Tracker..."
echo "  Backend:  http://localhost:3001"
echo "  Frontend: http://localhost:5173"
echo ""

# Start both servers
cd backend && npm run dev &
BACKEND_PID=$!

cd frontend && npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

wait
