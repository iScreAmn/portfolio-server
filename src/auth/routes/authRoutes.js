import express from 'express';
import rateLimit from 'express-rate-limit';
import { login, refresh, logout, me, changePassword } from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

/** Защита от перебора паролей. Считается по IP — работает только при trust proxy. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message: 'Слишком много попыток входа. Попробуйте позже.',
    }),
});

router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);

router.get('/me', requireAuth, me);
router.post('/change-password', requireAuth, changePassword);

export default router;
