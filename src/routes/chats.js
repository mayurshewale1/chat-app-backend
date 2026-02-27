const { Router } = require('express');
const { getMessages, listChats, sendMessage, startChat } = require('../controllers/chatsController');
const { authJwt } = require('../middlewares/authJwt');

const router = Router();

router.get('/', authJwt, listChats);
router.post('/start', authJwt, startChat);
router.get('/:chatId/messages', authJwt, getMessages);
router.post('/:chatId/messages', authJwt, sendMessage);

module.exports = router;
