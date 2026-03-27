const jwt = require('jsonwebtoken');
const User = require('../models/User-snapchat');

class AuthController {
  // Register user
  async register(req, res) {
    try {
      const { username, email, password } = req.body;

      // Validate
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Check if user exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Create user
      const user = new User({ username, email, password });
      await user.save();

      // Generate token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar
        },
        token
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Failed to register user' });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validate
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Find user and check password
      const user = await User.findByCredentials(email, password);

      // Generate token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar
        },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({ error: error.message });
    }
  }

  // Get current user
  async getCurrentUser(req, res) {
    try {
      const user = req.user;
      
      res.json({
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  }
}

module.exports = new AuthController();
