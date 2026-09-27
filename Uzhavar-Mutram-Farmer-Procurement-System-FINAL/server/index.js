require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
  console.error('❌ FATAL: JWT_SECRET environment variable is missing.');
  console.error('Please copy .env.example to .env and set a random JWT_SECRET before starting the server.');
  process.exit(1);
}

const http = require('http');
const db = require('./db');
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const { initWebSocket } = require('./websocket');

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check API
app.get('/api/health', (req, res) => {
  try {
    const check = db.prepare('SELECT 1 as alive').get();
    if (check && check.alive === 1) {
      return res.json({
        success: true,
        database: 'connected'
      });
    }
    return res.status(500).json({
      success: false,
      database: 'unhealthy'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      database: 'disconnected',
      message: err.message
    });
  }
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api', dataRoutes);

// Generic API 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.originalUrl} not found.`
  });
});

// Centralized error handling
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: 'An unexpected internal server error occurred.'
  });
});

// Serve frontend static files from project root
const projectRoot = path.resolve(__dirname, '..');
app.use(express.static(projectRoot));

// Fallback to index.html for client routes
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(projectRoot, 'index.html'));
  }
  next();
});

// Create HTTP Server & attach WebSockets
const server = http.createServer(app);
initWebSocket(server);

// Start Server
server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🌾 Uzhavar Mutram Procurement System Server Active`);
  console.log(`🌐 Web UI & API: http://localhost:${PORT}`);
  console.log(`🩺 Health API:   http://localhost:${PORT}/api/health`);
  console.log('====================================================');
});
