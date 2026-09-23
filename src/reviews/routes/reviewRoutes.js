import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  getPublicReviews,
  postReview,
  getReviews,
  patchReview,
  postApproveReview,
  removeReview,
} from '../controllers/reviewController.js';
import {
  createReviewRules,
  updateReviewRules,
  listReviewsRules,
  reviewIdRules,
} from '../validators/reviewValidator.js';
import { requireAuth } from '../../auth/middleware/requireAuth.js';

const router = express.Router();

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Снаружи открыты два запроса: список опубликованных отзывов и отправка
 * нового. Новый отзыв всегда ложится в «pending» и на сайт не попадает, пока
 * его не подтвердят в админке.
 */
router.get('/', getPublicReviews);
router.post('/', submitLimiter, createReviewRules, postReview);

router.get('/admin', requireAuth, listReviewsRules, getReviews);
router.patch('/:id', requireAuth, updateReviewRules, patchReview);
router.post('/:id/approve', requireAuth, reviewIdRules, postApproveReview);
router.delete('/:id', requireAuth, reviewIdRules, removeReview);

export default router;
