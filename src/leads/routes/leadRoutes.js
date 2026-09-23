import express from 'express';
import {
  getLeads,
  postLead,
  patchLead,
  patchLeadsOrder,
  removeLead,
} from '../controllers/leadController.js';
import {
  createLeadRules,
  updateLeadRules,
  reorderLeadsRules,
  listLeadsRules,
  leadIdRules,
} from '../validators/leadValidator.js';
import { requireAuth } from '../../auth/middleware/requireAuth.js';

const router = express.Router();

/**
 * Мини-CRM целиком закрыта: наружу торчит только POST /api/contact, который
 * заявку создаёт. Рейт-лимита здесь нет намеренно — за куку уже отвечает
 * requireAuth, а админ ходит по списку часто.
 */
router.use(requireAuth);

router.get('/', listLeadsRules, getLeads);
router.post('/', createLeadRules, postLead);
// Строго до '/:id': иначе Express разберёт 'reorder' как id и валидатор
// завернёт запрос на isUUID.
router.patch('/reorder', reorderLeadsRules, patchLeadsOrder);
router.patch('/:id', updateLeadRules, patchLead);
router.delete('/:id', leadIdRules, removeLead);

export default router;
