const { Router } = require('express');
const { getByUid, getMe, updateProfile, uploadAvatar, uploadAppLogo } = require('../controllers/userController');
const { authJwt } = require('../middlewares/authJwt');
const uploadAvatarMiddleware = require('../middlewares/uploadAvatar');
const uploadAppLogoMiddleware = require('../middlewares/uploadAppLogo');

const router = Router();

router.get('/me', authJwt, getMe);
router.patch('/me', authJwt, updateProfile);
router.post('/avatar', authJwt, uploadAvatarMiddleware, uploadAvatar);
router.post('/app-logo', authJwt, uploadAppLogoMiddleware, uploadAppLogo);
router.get('/:uid', getByUid);

module.exports = router;
