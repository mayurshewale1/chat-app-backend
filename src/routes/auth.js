const { Router } = require('express');
const {
  login,
  register,
  checkUsernameAvailability,
  forgotPasswordRequest,
  resetPassword,
} = require('../controllers/authController');

const router = Router();

router.get('/check-username/:username', checkUsernameAvailability);
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPasswordRequest);
router.post('/reset-password', resetPassword);

module.exports = router;
