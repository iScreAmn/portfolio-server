import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import { pingDB, disconnectDB } from './src/config/prisma.js';
import contactRoutes from './src/contacts/routes/contactRoutes.js';
import calculatorRoutes from './src/calculator/routes/calculatorRoutes.js';
import analyticsRoutes from './src/analytics/routes/analyticsRoutes.js';
import authRoutes from './src/auth/routes/authRoutes.js';
import leadRoutes from './src/leads/routes/leadRoutes.js';
import reviewRoutes from './src/reviews/routes/reviewRoutes.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5050);
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Приложение всегда стоит за nginx, поэтому реальный IP приходит в
 * X-Forwarded-For. Без этого express-rate-limit считал бы всех посетителей
 * одним клиентом (IP прокси), а гео определялось бы по адресу контейнера.
 * 1 — доверяем ровно одному прокси, нашему nginx.
 */
app.set('trust proxy', 1);

/**
 * Белый список источников. В проде — только сам сайт; для разработки
 * добавляется localhost. Никаких «разрешить всё» даже в dev: правила
 * должны совпадать с боевыми, иначе CORS ломается только после деплоя.
 */
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
      // Запросы без Origin — это curl, healthcheck и серверные вызовы.
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

/** Healthcheck для docker compose: проверяет и процесс, и связь с БД. */
app.get('/api/health', async (req, res) => {
  try {
    await pingDB();
    res.json({ status: 'ok', db: 'up', timestamp: new Date().toISOString() });
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
});

/**
 * Docker шлёт SIGTERM при `compose up -d` с новым образом. Дожидаемся
 * текущих запросов и закрываем пул Postgres, иначе в логах копятся
 * оборванные соединения.
 */
const shutdown = (signal) => async () => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
  // Если за 10 секунд не закрылись — выходим принудительно.
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT', shutdown('SIGINT'));

export default app;
