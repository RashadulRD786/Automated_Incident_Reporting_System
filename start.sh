#!/bin/bash
# Start DHL Incident Management System

echo "Starting DHL Incident Management System..."

# Backend
cd "$(dirname "$0")/backend"
node server.js &
BACKEND_PID=$!
echo "✓ Backend started (PID $BACKEND_PID) on http://localhost:5000"

# Frontend
cd "$(dirname "$0")/frontend"
npx vite --port 3000 &
FRONTEND_PID=$!
echo "✓ Frontend started (PID $FRONTEND_PID) on http://localhost:3000"

echo ""
echo "App ready at http://localhost:3000"
echo "Login: admin@dhl.com / Admin@1234"
echo ""
echo "Press Ctrl+C to stop both servers."

wait
