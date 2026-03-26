const { Router } = require('express');
const { authJwt } = require('../middlewares/authJwt');
const { markRead, saveMessage, unsaveMessage } = require('../controllers/messagesController');

const router = Router();

router.post('/:id/read', authJwt, markRead);
router.post('/:messageId/save', authJwt, saveMessage);
router.delete('/:messageId/save', authJwt, unsaveMessage);

module.exports = router;
