const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const userRepo = require('../db/userRepository');
const firebaseAuth = require('../services/firebaseAuth');
const blockedWords = require('../services/blockedWords');

const signToken = (userId) => {
  if (process.env.NODE_ENV === 'test') return `testtoken-${userId}`;
  return jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: config.ACCESS_TOKEN_EXPIRES_IN });
};

const toUserResponse = (row) => ({
  id: row.id,
  uid: row.uid,
  username: row.username,
  displayName: row.display_name,
  avatar: row.avatar || '👤',
  recoveryEmail: row.recovery_email,
  mobile: row.mobile,
  createdAt: row.created_at,
});

exports.register = async (req, res) => {
  const { username, password, displayName, firebaseIdToken } = req.body;
  if (!username || !password || !firebaseIdToken) {
    return res.status(400).json({ message: 'username, password and firebaseIdToken required' });
  }

  const verified = await firebaseAuth.verifyPhoneToken(firebaseIdToken);
  if (!verified) return res.status(400).json({ message: 'Invalid or expired phone verification. Please verify your mobile again.' });

  const normalizedMobile = firebaseAuth.normalizePhone(verified.phoneNumber);
  if (normalizedMobile.length < 10) return res.status(400).json({ message: 'Invalid mobile number' });

  const normalizedUsername = String(username).trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,30}$/i.test(normalizedUsername)) return res.status(400).json({ message: 'Invalid username format' });

  const usernameError = blockedWords.validateUserContent(normalizedUsername);
  if (usernameError) return res.status(400).json({ message: usernameError });
  const displayNameStr = displayName ? String(displayName).trim() : '';
  if (displayNameStr) {
    const displayError = blockedWords.validateUserContent(displayNameStr);
    if (displayError) return res.status(400).json({ message: displayError });
  }

  try {
    const existing = await userRepo.findByUsernameOrMobile(normalizedUsername, normalizedMobile);
    if (existing) {
      if (existing.username === normalizedUsername) return res.status(409).json({ message: 'Username already taken' });
      return res.status(409).json({ message: 'Mobile number already registered' });
    }

    const user = await userRepo.create({ username: normalizedUsername, password, displayName, mobile: normalizedMobile });
    const token = signToken(user.id);
    return res.status(201).json({ uid: user.uid, accessToken: token, user: toUserResponse(user), mobile: user.mobile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.checkUsernameAvailability = async (req, res) => {
  const { username } = req.params;
  if (!username || typeof username !== 'string') return res.status(400).json({ available: false, message: 'Username is required' });
  const trimmed = username.trim().toLowerCase();
  if (!trimmed) return res.status(400).json({ available: false, message: 'Username cannot be empty' });
  if (!/^[a-z0-9_-]{3,30}$/i.test(trimmed)) return res.status(400).json({ available: false, message: 'Username must be 3-30 characters' });
  const usernameError = blockedWords.validateUserContent(trimmed);
  if (usernameError) return res.status(400).json({ available: false, message: usernameError });
  try {
    const existing = await userRepo.findByUsername(trimmed);
    return res.json({ available: !existing, username: trimmed });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ available: false, message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'username and password required' });

  try {
    const user = await userRepo.findByUsername(username);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const match = await userRepo.comparePassword(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });
    const token = signToken(user.id);
    return res.json({ uid: user.uid, accessToken: token, user: toUserResponse(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.forgotPasswordRequest = async (req, res) => {
  return res.json({
    message: 'Use Firebase Phone Auth on the client. Send firebaseIdToken with newPassword to /reset-password.',
  });
};

exports.resetPassword = async (req, res) => {
  const { firebaseIdToken, newPassword } = req.body;
  if (!firebaseIdToken || !newPassword) {
    return res.status(400).json({ message: 'firebaseIdToken and newPassword required' });
  }
  if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

  const verified = await firebaseAuth.verifyPhoneToken(firebaseIdToken);
  if (!verified) return res.status(400).json({ message: 'Invalid or expired phone verification. Please verify your mobile again.' });

  const normalizedMobile = firebaseAuth.normalizePhone(verified.phoneNumber);
  const user = await userRepo.findByMobile(normalizedMobile);
  if (!user) return res.status(404).json({ message: 'No account found with this mobile number' });

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepo.updatePassword(user.id, hashedPassword);
    return res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};
