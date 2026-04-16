const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { nanoid } = require('nanoid/non-secure');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'documents');
const MAX_SIZE = 25 * 1024 * 1024; // 25MB

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${nanoid(16)}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  // Allow common document types
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only documents (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, ZIP) are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});

module.exports = upload.single('document');
