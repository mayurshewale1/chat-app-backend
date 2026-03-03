const { Router } = require('express');
const { getHistory, deleteCall, deleteAllCalls } = require('../controllers/callsController');
const { authJwt } = require('../middlewares/authJwt');

const router = Router();

router.get('/history', authJwt, getHistory);
router.delete('/all', authJwt, deleteAllCalls);
router.delete('/:id', authJwt, deleteCall);

module.exports = router;
