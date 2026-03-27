const express = require('express');
const authController = require('../controllers/authController-snapchat');
const auth = require('../middleware/auth-snapchat');

const router = express.Router();

// Register
router.post('/register', authController.register);

// Login
router.post('/login', authController.login);

// Get current user (protected)
router.get('/me', auth, authController.getCurrentUser);

module.exports = router;
