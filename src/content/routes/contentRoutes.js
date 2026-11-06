import express from 'express';
import { getContent, getContentImage, putContent } from '../controllers/contentController.js';
import { contentKeyRules, saveContentRules } from '../validators/contentValidator.js';
import { requireAuth } from '../../auth/middleware/requireAuth.js';

const router = express.Router();

/**
 * Редактируемый контент сайта. Читать может кто угодно — его рендерит
 * публичная страница, менять — только из админки.
 */
router.get('/:key', contentKeyRules, getContent);
router.get('/:key/image', contentKeyRules, getContentImage);
router.put('/:key', requireAuth, contentKeyRules, saveContentRules, putContent);

export default router;
