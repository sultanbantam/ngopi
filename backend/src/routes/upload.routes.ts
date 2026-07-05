import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { uploadFile } from '../controllers/upload.controller';

const router = Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Store files in backend/uploads directory
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

const upload = multer({ storage });

router.post('/', upload.single('file'), uploadFile);

export default router;
