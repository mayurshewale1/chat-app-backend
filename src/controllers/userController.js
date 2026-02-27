const userRepo = require('../db/userRepository');

exports.getMe = async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  return res.json({
    uid: user.uid,
    username: user.username,
    displayName: user.display_name,
    avatar: user.avatar || '👤',
    appLogo: user.app_logo || null,
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
