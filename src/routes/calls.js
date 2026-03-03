const { Router } = require('express');
const { getHistory, deleteCall } = require('../controllers/callsController');
const { authJwt } = require('../middlewares/authJwt');

const router = Router();

router.get('/history', authJwt, getHistory);
router.delete('/:id', authJwt, deleteCall);

module.exports = router;
