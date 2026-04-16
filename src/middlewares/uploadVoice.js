const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { nanoid } = require('nanoid/non-secure');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'voice-notes');
const MAX_SIZE = 25 * 1024 * 1024; // 25MB

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // Use m4a extension for AAC encoded audio
    cb(null, `${nanoid(16)}.m4a`);
  },
});

const fileFilter = (_req, file, cb) => {
  // Allow common audio formats
  const allowed = [
    'audio/mp4',
    'audio/m4a',
    'audio/aac',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/x-m4a',
    'audio/x-aac',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files (MP4, M4A, AAC, MP3, WAV) are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});

module.exports = upload.single('voice');
