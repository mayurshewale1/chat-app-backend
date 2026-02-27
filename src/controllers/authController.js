const jwt = require('jsonwebtoken');
const config = require('../config');
const userRepo = require('../db/userRepository');

const signToken = (userId) => {
  if (process.env.NODE_ENV === 'test') return `testtoken-${userId}`;
  return jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: config.ACCESS_TOKEN_EXPIRES_IN });
};

const toUserResponse = (row) => ({
  id: row.id,
  uid: row.uid,
  username: row.username,
  displayName: row.display_name,
  recoveryEmail: row.recovery_email,
  createdAt: row.created_at,
});

exports.register = async (req, res) => {
  const { username, password, displayName, recoveryEmail } = req.body;
  if (!username || !password || !recoveryEmail)
    return res.status(400).json({ message: 'username, password and recoveryEmail required' });

  const isValidEmail = (email) => !!email && /^\S+@\S+\.\S+$/.test(email);
  if (!isValidEmail(recoveryEmail)) return res.status(400).json({ message: 'Invalid recoveryEmail' });

  const normalizedUsername = String(username).trim().toLowerCase();
  try {
    const existing = await userRepo.findByUsernameOrEmail(normalizedUsername, recoveryEmail.toLowerCase().trim());
    if (existing) {
      if (existing.username === normalizedUsername) return res.status(409).json({ message: 'Username already taken' });
      return res.status(409).json({ message: 'Recovery email already in use' });
    }

    const user = await userRepo.create({ username: normalizedUsername, password, displayName, recoveryEmail });
    const token = signToken(user.id);
    return res.status(201).json({ uid: user.uid, accessToken: token, user: toUserResponse(user), recoveryEmail: user.recovery_email });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.checkUsernameAvailability = async (req, res) => {
  const { username } = req.params;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ available: false, message: 'Username is required' });
  }
  const trimmed = username.trim().toLowerCase();
  if (!trimmed) {
    return res.status(400).json({ available: false, message: 'Username cannot be empty' });
  }
  if (!/^[a-z0-9_-]{3,30}$/i.test(trimmed)) {
    return res.status(400).json({ available: false, message: 'Username must be 3-30 characters, letters, numbers, underscore or hyphen only' });
  }
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
    const userObj = toUserResponse(user);
    return res.json({ uid: user.uid, accessToken: token, user: userObj });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};
