import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { pingDB, disconnectDB } from './src/config/prisma.js';
import contactRoutes from './src/contacts/routes/contactRoutes.js';
import calculatorRoutes from './src/calculator/routes/calculatorRoutes.js';
import packageRoutes from './src/packages/routes/packageRoutes.js';
import analyticsRoutes from './src/analytics/routes/analyticsRoutes.js';
import authRoutes from './src/auth/routes/authRoutes.js';
import leadRoutes from './src/leads/routes/leadRoutes.js';
import reviewRoutes from './src/reviews/routes/reviewRoutes.js';
import {
  getTelegramHealthDetails,
  verifyTelegramConfig,
} from './src/telegram/services/telegramClient.js';
import {
  flushTelegramLogs,
  installTelegramLogForwarder,
  logToTelegram,
} from './src/telegram/services/logForwarder.js';

dotenv.config();
installTelegramLogForwarder();

const app = express();
const PORT = Number(process.env.PORT || 5050);
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

const DEV_ORIGINS = ['http://localhost:3333', 'http://127.0.0.1:3333'];
const allowedOrigins = new Set([
  ...String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  ...(isProduction ? [] : DEV_ORIGINS),
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      callback(null, allowedOrigins.has(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }),
);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/calculator', calculatorRoutes);
app.use('/api/packages', packageRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await pingDB();
    res.json({
      status: 'ok',
      db: 'up',
      telegram: getTelegramHealthDetails(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[health] БД недоступна:', error.message || error);
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error. Please try again later.',
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  const telegram = getTelegramHealthDetails();
  if (!telegram.enabled) {
    console.warn('[telegram] выключен: нет TELEGRAM_BOT_TOKEN или TELEGRAM_CHATS_ID', telegram);
  } else {
    verifyTelegramConfig().then((ok) => {
      console.log(`[telegram] ${ok ? 'бот доступен' : 'бот НЕ доступен'}`, telegram);
    });
  }
  logToTelegram('info', `Сервер запущен на порту ${PORT}`);
});

const shutdown = (signal) => async () => {
  console.log(`${signal} received, shutting down`);
  logToTelegram('info', `${signal}: сервер останавливается`);
  server.close(async () => {
    await disconnectDB();
    await flushTelegramLogs();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT', shutdown('SIGINT'));

// Падаем как и раньше, но сначала успеваем отправить причину в Telegram.
const crash = (label) => async (error) => {
  console.error(`[${label}]`, error);
  await flushTelegramLogs();
  process.exit(1);
};

process.on('uncaughtException', crash('uncaughtException'));
process.on('unhandledRejection', crash('unhandledRejection'));

export default app;
