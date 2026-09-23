import { body, param, query } from 'express-validator';
import { LEAD_STATUSES, LEAD_SOURCES } from '../leadRepository.js';

/**
 * id в базе — uuid. Без этой проверки кривой id уходит в Prisma и вылетает
 * не как 404, а как 500.
 */
export const leadIdRules = [param('id').isUUID().withMessage('Некорректный id')];

/**
 * Клиент заводится администратором, а не посетителем, поэтому проверки мягче,
 * чем в contactValidator: без капчи, без обязательного сообщения и без
 * ограничения имени латиницей — в админку вносят и русские имена.
 */
export const createLeadRules = [
  body('name').trim().notEmpty().withMessage('Укажите имя').isLength({ max: 100 }),
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
];

export const listLeadsRules = [
  query('status').optional({ values: 'falsy' }).isIn(LEAD_STATUSES),
  query('source').optional({ values: 'falsy' }).isIn(LEAD_SOURCES),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 500 }).toInt(),
];
