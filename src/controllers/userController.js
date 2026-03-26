const userRepo = require('../db/userRepository');
const deviceTokenRepo = require('../db/deviceTokenRepository');
const firebaseAuth = require('../services/firebaseAuth');

exports.getMe = async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  const full = await userRepo.findById(user.id, true);
  return res.json({
    id: full?.id,
    uid: user.uid,
    username: user.username,
    displayName: user.display_name,
    avatar: user.avatar || '👤',
    appLogo: user.app_logo || null,
    hasSecurityQuestion: !!(full && full.security_question),
    /** Question text only (for UI); answer is never returned */
    securityQuestion: full?.security_question || null,
    privacyMaskCaller: !!(full && full.privacy_mask_caller),
  });
};

exports.updateProfile = async (req, res) => {
  const { displayName, avatar } = req.body;
  try {
    const updated = await userRepo.updateProfile(req.user.id, { displayName, avatar });
    if (!updated) return res.status(404).json({ message: 'User not found' });
    return res.json({
      uid: updated.uid,
      username: updated.username,
      displayName: updated.display_name,
      avatar: updated.avatar || '👤',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.uploadAvatar = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image file provided' });
  }
  try {
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    const updated = await userRepo.updateProfile(req.user.id, { avatar: avatarPath });
    if (!updated) return res.status(404).json({ message: 'User not found' });
    return res.json({
      uid: updated.uid,
      username: updated.username,
      displayName: updated.display_name,
      avatar: avatarPath,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to update avatar' });
  }
};

exports.uploadAppLogo = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image file provided' });
  }
  try {
    const appLogoPath = `/uploads/app-logos/${req.file.filename}`;
    const updated = await userRepo.updateProfile(req.user.id, { app_logo: appLogoPath });
    if (!updated) return res.status(404).json({ message: 'User not found' });
    return res.json({
      uid: updated.uid,
      username: updated.username,
      displayName: updated.display_name,
      avatar: updated.avatar || '👤',
      appLogo: appLogoPath,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to update app logo' });
  }
};

exports.registerDeviceToken = async (req, res) => {
  const { fcmToken, platform } = req.body;
  if (!fcmToken || typeof fcmToken !== 'string') {
    return res.status(400).json({ message: 'fcmToken required' });
  }
  try {
    await deviceTokenRepo.upsert(req.user.id, fcmToken.trim(), platform || null);
    return res.json({ message: 'Device token registered' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.removeDeviceToken = async (req, res) => {
  try {
    await deviceTokenRepo.removeAllForUser(req.user.id);
    return res.json({ message: 'Device tokens removed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.updateNotificationsEnabled = async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'enabled (boolean) required' });
  }
  try {
    await userRepo.updateNotificationsEnabled(req.user.id, enabled);
    if (!enabled) {
      await deviceTokenRepo.removeAllForUser(req.user.id);
    }
    return res.json({ message: enabled ? 'Notifications enabled' : 'Notifications disabled' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.updateReadReceiptsEnabled = async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'enabled (boolean) required' });
  }
  try {
    await userRepo.updateReadReceiptsEnabled(req.user.id, enabled);
    return res.json({ message: enabled ? 'Read receipts enabled' : 'Read receipts disabled' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.getByUid = async (req, res) => {
  const { uid } = req.params;
  const user = await userRepo.findByUid(uid);
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({
    uid: user.uid,
    username: user.username,
    displayName: user.display_name,
    avatar: user.avatar || '👤',
  });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'currentPassword and newPassword required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }
  try {
    const user = await userRepo.findById(req.user.id, false);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const match = await userRepo.comparePassword(currentPassword, user.password);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect' });
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepo.updatePassword(req.user.id, hashedPassword);
    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const ok = await userRepo.deleteUserPermanently(req.user.id);
    if (!ok) return res.status(404).json({ message: 'User not found' });
    return res.json({
      message: 'Account permanently deleted. All chats, calls, and connection data tied to this account have been removed.',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.setSecurityQuestion = async (req, res) => {
  const { question, answer } = req.body;
  try {
    await userRepo.setSecurityQuestion(req.user.id, question, answer);
    return res.json({ message: 'Security question saved' });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ message: err.message });
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.setPrivacyMaskCaller = async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'enabled (boolean) required' });
  }
  try {
    await userRepo.updatePrivacyMaskCaller(req.user.id, enabled);
    return res.json({ message: enabled ? 'Caller ID masked for outgoing calls' : 'Caller ID visible' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * After Firebase phone OTP, verify security answer so PIN reset is not OTP-only.
 * Client clears local PIN only after success.
 */
exports.verifyPinReset = async (req, res) => {
  const { firebaseIdToken, securityAnswer } = req.body;
  if (!firebaseIdToken || securityAnswer == null || String(securityAnswer).trim() === '') {
    return res.status(400).json({ message: 'firebaseIdToken and securityAnswer required' });
  }
  try {
    const user = await userRepo.findById(req.user.id, true);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.mobile) {
      return res.status(400).json({
        message: 'Add a verified phone number to your account before resetting PIN with OTP.',
      });
    }
    const verified = await firebaseAuth.verifyPhoneToken(firebaseIdToken);
    if (!verified) {
      return res.status(401).json({ message: 'Invalid or expired OTP session' });
    }
    const norm = firebaseAuth.normalizePhone(verified.phoneNumber);
    const userMobile = String(user.mobile || '').replace(/\D/g, '').slice(-10);
    if (!userMobile || userMobile !== norm) {
      return res.status(403).json({ message: 'Phone number does not match this account' });
    }
    const ok = await userRepo.verifySecurityAnswer(req.user.id, securityAnswer);
    if (!ok) {
      return res.status(401).json({ message: 'Wrong security answer' });
    }
    return res.json({ ok: true, message: 'You can set a new PIN on this device' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};
