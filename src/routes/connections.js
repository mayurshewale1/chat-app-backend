const { Router } = require('express');
const { acceptRequest, listConnections, listPendingRequests, listSentRequests, rejectRequest, sendRequest } = require('../controllers/connectionsController');
const { authJwt } = require('../middlewares/authJwt');

const router = Router();

router.post('/request', authJwt, sendRequest);
router.post('/accept', authJwt, acceptRequest);
router.post('/reject', authJwt, rejectRequest);
router.get('/requests', authJwt, listPendingRequests);
router.get('/sent', authJwt, listSentRequests);
router.get('/', authJwt, listConnections);

module.exports = router;
