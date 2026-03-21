const { Router } = require('express');
const {
  getMessages,
  listChats,
  searchChats,
  sendMessage,
  startChat,
  uploadChatImage,
  clearChat,
  deleteChat,
  archiveChat,
  unarchiveChat,
} = require('../controllers/chatsController');
const { authJwt } = require('../middlewares/authJwt');
const uploadChatImageMw = require('../middlewares/uploadChatImage');

const router = Router();

router.get('/', authJwt, listChats);
router.get('/search', authJwt, searchChats);
router.post('/start', authJwt, startChat);
router.get('/:chatId/messages', authJwt, getMessages);
router.post('/:chatId/messages', authJwt, sendMessage);
router.post('/:chatId/images', authJwt, uploadChatImageMw, uploadChatImage);
router.post('/:chatId/clear', authJwt, clearChat);
router.post('/:chatId/archive', authJwt, archiveChat);
router.post('/:chatId/unarchive', authJwt, unarchiveChat);
router.delete('/:chatId', authJwt, deleteChat);

module.exports = router;
