import { body, param, query } from 'express-validator';
import { LEAD_STATUSES, LEAD_SOURCES } from '../leadRepository.js';

export const leadIdRules = [param('id').isUUID().withMessage('Некорректный id')];

export const createLeadRules = [
  body('name').trim().notEmpty().withMessage('Укажите имя').isLength({ max: 100 }),
  body('company').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('contactMethod')
    .trim()
    .notEmpty()
    .withMessage('Выберите способ связи')
    .isIn(['Telegram', 'WhatsApp', 'Email', 'Phone'])
    .withMessage('Неизвестный способ связи'),
  body('contactValue')
    .trim()
    .notEmpty()
    .withMessage('Укажите контакт')
    .isLength({ max: 200 }),
  body('message').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
  body('note').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
];

export const updateLeadRules = [
  ...leadIdRules,
  body('status').optional().isIn(LEAD_STATUSES).withMessage('Неизвестный статус'),
  body('note').optional({ nullable: true }).isLength({ max: 2000 }),
  body('company').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('message').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('contactValue')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Укажите контакт')
    .isLength({ max: 200 }),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Укажите имя')
    .isLength({ max: 100 }),
];

export const reorderLeadsRules = [
  body('ids').isArray({ min: 1, max: 500 }).withMessage('Нужен список id'),
  body('ids.*').isUUID().withMessage('Некорректный id'),
];

export const listLeadsRules = [
  query('status').optional({ values: 'falsy' }).isIn(LEAD_STATUSES),
  query('source').optional({ values: 'falsy' }).isIn(LEAD_SOURCES),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 500 }).toInt(),
];
