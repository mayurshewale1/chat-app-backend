const { Router } = require('express');
const {
  acceptRequest,
  addByCode,
  blockUser,
  generateConnectionCode,
  listBlocked,
  listConnections,
  listMyCodes,
  listPendingRequests,
  listSentRequests,
  rejectRequest,
  removeConnection,
  sendRequest,
  unblockUser,
} = require('../controllers/connectionsController');
const { authJwt } = require('../middlewares/authJwt');

const router = Router();

router.post('/request', authJwt, sendRequest);
router.post('/request-by-code', authJwt, addByCode);
router.post('/accept', authJwt, acceptRequest);
router.post('/reject', authJwt, rejectRequest);
router.post('/generate-code', authJwt, generateConnectionCode);
router.get('/my-codes', authJwt, listMyCodes);
router.get('/requests', authJwt, listPendingRequests);
router.get('/sent', authJwt, listSentRequests);
router.get('/', authJwt, listConnections);
router.post('/remove', authJwt, removeConnection);
router.post('/block', authJwt, blockUser);
router.post('/unblock', authJwt, unblockUser);
router.get('/blocked', authJwt, listBlocked);

module.exports = router;
