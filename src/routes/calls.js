const { Router } = require('express');
const { getHistory, getIceServers, deleteCall, deleteAllCalls } = require('../controllers/callsController');
const { authJwt } = require('../middlewares/authJwt');

const router = Router();

router.get('/ice-servers', authJwt, getIceServers);
router.get('/history', authJwt, getHistory);
router.delete('/all', authJwt, deleteAllCalls);
router.delete('/:id', authJwt, deleteCall);

module.exports = router;
