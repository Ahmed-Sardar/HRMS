const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const ALLOWED_MIME_TYPES = {
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  spreadsheets: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/csv',
  ],
  images: ['image/jpeg', 'image/png', 'image/webp'],
};

const ALL_ALLOWED = [...ALLOWED_MIME_TYPES.documents, ...ALLOWED_MIME_TYPES.spreadsheets, ...ALLOWED_MIME_TYPES.images];

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const resolveUploadDir = (folder = 'misc') => {
  const safeFolder = String(folder).replace(/[^a-z0-9-_]/gi, '');
  const dir = path.join(env.uploadsRoot, safeFolder);
  ensureDir(dir);
  return { dir, safeFolder };
};

const makeStorage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const { dir } = resolveUploadDir(folder);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase().slice(0, 10);
      const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
      cb(null, unique);
    },
  });

const buildUploader = ({ folder = 'misc', allowed = ALL_ALLOWED, maxSizeMb = env.maxFileSizeMb } = {}) =>
  multer({
    storage: makeStorage(folder),
    limits: { fileSize: maxSizeMb * 1024 * 1024, files: 5 },
    fileFilter: (req, file, cb) => {
      if (!allowed.includes(file.mimetype)) {
        return cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
      }
      return cb(null, true);
    },
  });

const uploadDocument = buildUploader({ folder: 'documents' });
const uploadSpreadsheet = buildUploader({
  folder: 'spreadsheets',
  allowed: [...ALLOWED_MIME_TYPES.spreadsheets, ...ALLOWED_MIME_TYPES.documents],
});
const uploadImage = buildUploader({ folder: 'images', allowed: ALLOWED_MIME_TYPES.images, maxSizeMb: 5 });
const uploadReportAttachment = buildUploader({
  folder: 'reports',
  allowed: [...ALLOWED_MIME_TYPES.spreadsheets, ...ALLOWED_MIME_TYPES.documents],
});
const uploadResume = buildUploader({
  folder: 'resumes',
  allowed: [...ALLOWED_MIME_TYPES.documents, ...ALLOWED_MIME_TYPES.images],
});

const toStoredFile = (file, folder) => ({
  originalName: file.originalname,
  fileName: file.filename,
  path: path.join(folder, file.filename).replace(/\\/g, '/'),
  mimetype: file.mimetype,
  size: file.size,
});

const deleteStoredFile = (relativePath) => {
  if (!relativePath) return;
  const absolute = path.resolve(env.uploadsRoot, relativePath);
  if (!absolute.startsWith(path.resolve(env.uploadsRoot))) return;
  fs.promises.unlink(absolute).catch(() => {});
};

module.exports = {
  uploadDocument,
  uploadSpreadsheet,
  uploadImage,
  uploadReportAttachment,
  uploadResume,
  toStoredFile,
  deleteStoredFile,
  resolveUploadDir,
  ALLOWED_MIME_TYPES,
};
