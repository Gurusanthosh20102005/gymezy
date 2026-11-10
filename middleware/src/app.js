import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { ENV } from './config/env.js';
import apiRouter from './routes/index.js';
import { notFound } from './middlewares/notFound.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';

const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration supporting credentials (cookies)
const configuredOrigins = (ENV.CLIENT_URL || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5001',
  'http://localhost:5002',
  'http://localhost:3000',
];

const allowedOrigins = new Set([...configuredOrigins, ...defaultOrigins]);

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // Mobile apps, curl, Postman
  if (allowedOrigins.has(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.endsWith('.local') ||
      hostname === 'gymezy.com' ||
      hostname.endsWith('.gymezy.com')
    ) {
      return true;
    }
  } catch {
    // ignore invalid URL
  }
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// Request body parsers (50mb to allow high-res base64 media uploads before compression)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie parser for reading HTTP-only JWT cookies
app.use(cookieParser());

// Request logging in development
if (!ENV.IS_PRODUCTION) {
  app.use(morgan('dev'));
}

// Root welcome route
app.get('/', (_req, res) => {
  res.json({
    status: 'online',
    platform: 'GYMEZY Backend Middleware API',
    version: '1.0.0',
    documentation: '/api/v1/health',
  });
});

// Mount API v1 Routes
app.use('/api/v1', apiRouter);

// Catch-all 404 handler for undefined routes
app.use(notFound);

// Centralized Global Error Handler
app.use(errorHandler);

export default app;
