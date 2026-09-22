import { prisma } from '../config/prisma.js';

/**
 * Заявки лежат в БД как страховка: письмо и телеграм могут не дойти оба
 * сразу (упал SMTP, отозван токен бота), и тогда обращение теряется совсем.
 *
 * Сбой записи намеренно не ломает отправку формы — посетитель не должен
 * получать ошибку из-за проблем с нашей БД, поэтому ошибка только логируется.
 */
export const saveLead = async (data) => {
  try {
    return await prisma.lead.create({
      data: {
        type: data.type,
        name: data.name,
        contact: data.contact,
        method: data.method || null,
        message: data.message || null,
        payload: data.payload || null,
        ip: data.ip || null,
        userAgent: data.userAgent ? String(data.userAgent).slice(0, 255) : null,
      },
    });
  } catch (error) {
    console.error('[leads] не удалось сохранить заявку:', error.message || error);
    return null;
  }
};
