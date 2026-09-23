import { validationResult } from 'express-validator';
import {
  createReview,
  listApprovedReviews,
  listReviews,
  updateReview,
  approveReview,
  deleteReview,
} from '../reviewRepository.js';
import { isSpamMessage } from '../../contacts/middlewares/spamGuard.js';
import { sendReviewTelegramNotification } from '../../telegram/services/notifications.js';

const badRequest = (res, errors) =>
  res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: errors.array().map((e) => ({ path: e.path || e.param, msg: e.msg })),
  });

const notFound = (res) => res.status(404).json({ success: false, message: 'Review not found' });

const trimOrEmpty = (value) => (typeof value === 'string' ? value.trim() : '');

export const getPublicReviews = async (req, res) => {
  try {
    return res.json({ success: true, data: await listApprovedReviews() });
  } catch (error) {
    console.error('[reviews] не удалось получить опубликованные:', error.message || error);
    return res.status(500).json({ success: false, message: 'Failed to load reviews' });
  }
};

export const postReview = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, errors);

  const text = req.body.text.trim();
  if (isSpamMessage({ message: text })) {
    return res.status(400).json({
      success: false,
      message: 'Spam detected. Please revise your review.',
    });
  }

  try {
    const review = await createReview({
      name: req.body.name.trim(),
      company: trimOrEmpty(req.body.company),
      text,
      photo: req.body.photo,
      logo: req.body.logo,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Уведомление — не часть ответа: упавший телеграм не должен ронять отзыв.
    sendReviewTelegramNotification(review).catch((error) => {
      console.error('[reviews] телеграм-уведомление не ушло:', error.message || error);
    });

    // Посетителю отдаём только факт приёма: до модерации отзыв ничей.
    return res.status(201).json({ success: true, data: { id: review.id } });
  } catch (error) {
    console.error('[reviews] не удалось сохранить отзыв:', error.message || error);
    return res.status(500).json({ success: false, message: 'Failed to save review' });
  }
};

export const getReviews = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, errors);

  try {
    const data = await listReviews({ status: req.query.status || undefined });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[reviews] не удалось получить список:', error.message || error);
    return res.status(500).json({ success: false, message: 'Failed to load reviews' });
  }
};

export const patchReview = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, errors);

  const { name, company, text, photo, logo } = req.body;
  try {
    const review = await updateReview(req.params.id, {
      name: typeof name === 'string' ? name.trim() : undefined,
      company: company === null ? null : typeof company === 'string' ? company.trim() : undefined,
      text: typeof text === 'string' ? text.trim() : undefined,
      photo,
      logo,
    });
    if (!review) return notFound(res);
    return res.json({ success: true, data: review });
  } catch (error) {
    console.error('[reviews] не удалось обновить отзыв:', error.message || error);
    return res.status(500).json({ success: false, message: 'Failed to update review' });
  }
};

export const postApproveReview = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, errors);

  try {
    const review = await approveReview(req.params.id);
    if (!review) return notFound(res);
    return res.json({ success: true, data: review });
  } catch (error) {
    console.error('[reviews] не удалось подтвердить отзыв:', error.message || error);
    return res.status(500).json({ success: false, message: 'Failed to approve review' });
  }
};

export const removeReview = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, errors);

  try {
    const deleted = await deleteReview(req.params.id);
    if (!deleted) return notFound(res);
    return res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('[reviews] не удалось удалить отзыв:', error.message || error);
    return res.status(500).json({ success: false, message: 'Failed to delete review' });
  }
};
