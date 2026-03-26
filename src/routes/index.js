const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./auth');
const chatsRoutes = require('./chats');
const connectionsRoutes = require('./connections');
const userRoutes = require('./users');
const callsRoutes = require('./calls');
const messagesRoutes = require('./messages');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.use('/auth', authLimiter, authRoutes);
router.use('/users', userRoutes);
router.use('/connections', connectionsRoutes);
router.use('/chats', chatsRoutes);
router.use('/calls', callsRoutes);
router.use('/messages', messagesRoutes);

module.exports = router;
