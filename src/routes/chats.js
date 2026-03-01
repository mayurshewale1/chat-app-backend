const { Router } = require('express');
const { getMessages, listChats, sendMessage, startChat, uploadChatImage, deleteChat } = require('../controllers/chatsController');
const { authJwt } = require('../middlewares/authJwt');
const uploadChatImageMw = require('../middlewares/uploadChatImage');

const router = Router();

router.get('/', authJwt, listChats);
router.post('/start', authJwt, startChat);
router.get('/:chatId/messages', authJwt, getMessages);
router.post('/:chatId/messages', authJwt, sendMessage);
router.post('/:chatId/images', authJwt, uploadChatImageMw, uploadChatImage);
router.delete('/:chatId', authJwt, deleteChat);

module.exports = router;
