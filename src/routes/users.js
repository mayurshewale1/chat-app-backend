const { Router } = require('express');
const { getByUid, getMe, updateProfile, uploadAvatar, uploadAppLogo, registerDeviceToken, removeDeviceToken, updateNotificationsEnabled, updateReadReceiptsEnabled, deleteAccount, changePassword } = require('../controllers/userController');
const { authJwt } = require('../middlewares/authJwt');
const uploadAvatarMiddleware = require('../middlewares/uploadAvatar');
const uploadAppLogoMiddleware = require('../middlewares/uploadAppLogo');

const router = Router();

router.get('/me', authJwt, getMe);
router.post('/device-token', authJwt, registerDeviceToken);
router.delete('/device-token', authJwt, removeDeviceToken);
router.patch('/me/notifications', authJwt, updateNotificationsEnabled);
router.patch('/me/read-receipts', authJwt, updateReadReceiptsEnabled);
router.patch('/me/password', authJwt, changePassword);
router.patch('/me', authJwt, updateProfile);
router.post('/avatar', authJwt, uploadAvatarMiddleware, uploadAvatar);
router.post('/app-logo', authJwt, uploadAppLogoMiddleware, uploadAppLogo);
router.get('/:uid', getByUid);
router.delete('/me', authJwt, deleteAccount);

module.exports = router;
