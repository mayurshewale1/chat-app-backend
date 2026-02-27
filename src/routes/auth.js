const { Router } = require('express');
const { login, register, checkUsernameAvailability } = require('../controllers/authController');

const router = Router();

router.get('/check-username/:username', checkUsernameAvailability);
router.post('/register', register);
router.post('/login', login);

module.exports = router;
