const { Router } = require('express');
const { getHistory } = require('../controllers/callsController');
const { authJwt } = require('../middlewares/authJwt');

const router = Router();

router.get('/history', authJwt, getHistory);

module.exports = router;
