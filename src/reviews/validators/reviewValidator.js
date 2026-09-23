import { body, param, query } from 'express-validator';
import { REVIEW_STATUSES } from '../reviewRepository.js';

const IMAGE_MAX_LENGTH = 110_000;
const IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

const imageRule = (field) =>
  body(field)
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ max: IMAGE_MAX_LENGTH })
    .withMessage('Картинка слишком большая')
    .matches(IMAGE_PATTERN)
    .withMessage('Нужна картинка PNG, JPEG или WebP');

export const reviewIdRules = [param('id').isUUID().withMessage('Некорректный id')];

export const createReviewRules = [
  body('name').isString().trim().notEmpty().withMessage('Укажите имя').isLength({ max: 100 }),
  body('company').optional({ values: 'falsy' }).isString().trim().isLength({ max: 120 }),
  body('text')
    .isString()
    .trim()
    .isLength({ min: 10 })
    .withMessage('Отзыв слишком короткий')
    .isLength({ max: 1000 })
    .withMessage('Отзыв слишком длинный'),
  imageRule('photo'),
  imageRule('logo'),
];

export const updateReviewRules = [
  ...reviewIdRules,
  body('name').optional().isString().trim().notEmpty().withMessage('Укажите имя').isLength({ max: 100 }),
  body('company').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('text')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Отзыв не может быть пустым')
    .isLength({ max: 1000 }),
  imageRule('photo'),
  imageRule('logo'),
];

export const listReviewsRules = [
  query('status').optional({ values: 'falsy' }).isIn(REVIEW_STATUSES),
];
