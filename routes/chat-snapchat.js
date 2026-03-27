const express = require('express');
const chatController = require('../controllers/chatController-snapchat');
const messageController = require('../controllers/messageController-snapchat');
const auth = require('../middleware/auth-snapchat');

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

// Chat routes
router.post('/find-or-create', chatController.findOrCreateChat);
router.get('/', chatController.getUserChats);
router.get('/:chatId', chatController.getChatDetails);

// Message routes
router.get('/:chatId/messages', messageController.getMessages);
router.post('/:chatId/messages', messageController.sendMessage);
router.delete('/:chatId/view-once', messageController.deleteViewOnceMessages);

// Chat settings
router.get('/:chatId/setting', messageController.getChatSetting);
router.put('/:chatId/setting', messageController.updateChatSetting);

module.exports = router;
