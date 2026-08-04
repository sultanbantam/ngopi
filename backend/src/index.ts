import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import http from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.routes';
import bmcRoutes from './routes/bmc.routes';
import messageRoutes from './routes/message.routes';
import groupRoutes from './routes/group.routes';
import uploadRoutes from './routes/upload.routes';
import settingsRoutes from './routes/settings.routes';
import platformRoutes from './routes/platform.routes';
import faqRoutes from './routes/faq.routes';
import aiRoutes from './routes/ai.routes';
import ticketRoutes from './routes/ticket.routes';
import adminRoutes from './routes/admin.routes';
import { setupSocket } from './sockets';
import { apiLimiter } from './middleware/rateLimiter';
import { corsOrigin, encodeJsonResponse, sanitizeRequest } from './middleware/security.middleware';
import path from 'path';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'https://www.bamboochat.click', 'https://bamboochat.click', 'wss://api.bamboochat.click'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'data:', 'blob:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: corsOrigin, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(sanitizeRequest);
app.use(encodeJsonResponse);
app.use('/api', apiLimiter);

// Serve static files from uploads folder with long-term cache headers
// Files are uniquely named (timestamp-based) so immutable caching is safe
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '365d',
  immutable: true,
  etag: true,
  lastModified: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
  },
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bmc', bmcRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/platforms', platformRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  maxHttpBufferSize: 1e8, // 100 MB
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

// Setup Socket.IO logic
setupSocket(io);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});