require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');

// Import routes and socket handler
const authRoutes = require('./src/routes/auth');
const chatRoutes = require('./src/routes/chat');
const messageRoutes = require('./src/routes/messages');
const { initializeSocket } = require('./src/sockets/index');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "*",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize Socket.IO
initializeSocket(server);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/messages', messageRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'Neon PostgreSQL Connected'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Database connection
const connectDB = async () => {
  try {
    const { connectDB: dbConnect } = require('./src/config/db');
    await dbConnect();
    console.log('✅ Neon PostgreSQL Database Connected Successfully');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 Database: Neon PostgreSQL`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

startServer().catch(console.error);
