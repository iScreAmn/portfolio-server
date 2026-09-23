import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  trackEvents,
  getSummary,
  getDevices,
  getSessions,
  getSessionEvents,
  deleteAllEvents,
} from '../controllers/analyticsController.js';
import { requireAuth } from '../../auth/middleware/requireAuth.js';

const router = express.Router();

/**
 * Приём событий открыт наружу, поэтому лимит щедрый, но конечный: трекер
 * шлёт батч раз в 8 секунд или на каждые 10 событий, так что живому
 * посетителю 120 запросов за 15 минут хватает с запасом.
 */
const ingestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, message: 'Too many requests' }),
});

router.post('/', ingestLimiter, trackEvents);

// Всё ниже — только для вошедшего пользователя админки.
router.use(requireAuth);

router.get('/summary', getSummary);
router.get('/devices', getDevices);
router.get('/sessions', getSessions);
router.get('/sessions/:sessionId/events', getSessionEvents);
router.delete('/', deleteAllEvents);

export default router;
