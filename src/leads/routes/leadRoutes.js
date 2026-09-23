import express from 'express';
import { getLeads, postLead, patchLead, removeLead } from '../controllers/leadController.js';
import {
  createLeadRules,
  updateLeadRules,
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
router.patch('/:id', updateLeadRules, patchLead);
router.delete('/:id', leadIdRules, removeLead);

export default router;
