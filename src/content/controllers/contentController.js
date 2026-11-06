import { validationResult } from 'express-validator';
import { findContent, findContentImage, saveContent } from '../contentRepository.js';
import { SECTIONS } from '../validators/contentValidator.js';

const badRequest = (res, errors) =>
  res.status(400).json({
    success: false,
    message: errors.array()[0]?.msg || 'Validation failed',
    errors: errors.array().map((e) => ({ path: e.path || e.param, msg: e.msg })),
  });

const notFound = (res) => res.status(404).json({ success: false, message: 'Content not found' });

/**
 * Пока блок ни разу не сохраняли, отдаём data: null — сайт тогда берёт
 * тексты из своих статичных файлов, а админка подставляет их же в форму.
 */
export const getContent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return notFound(res);

  try {
    return res.json({ success: true, data: await findContent(req.params.key) });
  } catch (error) {
    console.error('[content] не удалось получить блок:', error.message || error);
    return res.status(500).json({ success: false, message: 'Failed to load content' });
  }
};

export const getContentImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return notFound(res);

  try {
    const image = await findContentImage(req.params.key);
    if (!image) return notFound(res);

    // Адрес картинки меняется с каждым сохранением (?v=updatedAt), поэтому
    // её можно кэшировать навсегда.
    res.set('Content-Type', image.type);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(image.buffer);
  } catch (error) {
    console.error('[content] не удалось отдать картинку:', error.message || error);
    return res.status(500).json({ success: false, message: 'Failed to load image' });
  }
};

export const putContent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return badRequest(res, errors);

  try {
    const { pick } = SECTIONS[req.params.key];
    const data = await saveContent(req.params.key, pick(req.body));
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[content] не удалось сохранить блок:', error.message || error);
    return res.status(500).json({ success: false, message: 'Failed to save content' });
  }
};
