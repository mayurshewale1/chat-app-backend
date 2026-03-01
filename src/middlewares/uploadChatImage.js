const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { nanoid } = require('nanoid');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'chat-images');
const MAX_SIZE = 25 * 1024 * 1024; // 25MB

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (file.mimetype === 'image/png') ? '.png' : '.jpg';
    cb(null, `${nanoid(16)}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, PNG, WebP) are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});

module.exports = upload.single('image');
