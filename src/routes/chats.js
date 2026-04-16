const { Router } = require('express');
const {
  getMessages,
  listChats,
  searchChats,
  sendMessage,
  startChat,
  uploadChatImage,
  uploadChatDocument,
  clearChat,
  deleteChat,
  deleteViewOnceMessages,
} = require('../controllers/chatsController');
const { authJwt } = require('../middlewares/authJwt');
const uploadChatImageMw = require('../middlewares/uploadChatImage');
const uploadDocumentMw = require('../middlewares/uploadDocument');

const router = Router();

router.get('/', authJwt, listChats);
router.get('/search', authJwt, searchChats);
router.post('/start', authJwt, startChat);
router.get('/:chatId/messages', authJwt, getMessages);
router.post('/:chatId/messages', authJwt, sendMessage);
router.post('/:chatId/images', authJwt, uploadChatImageMw, uploadChatImage);
router.post('/:chatId/documents', authJwt, uploadDocumentMw, uploadChatDocument);
router.post('/:chatId/clear', authJwt, clearChat);
router.delete('/:chatId', authJwt, deleteChat);
router.post('/:chatId/leave-view-once', authJwt, deleteViewOnceMessages);

module.exports = router;
