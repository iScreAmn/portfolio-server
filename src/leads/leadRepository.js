import { prisma } from '../config/prisma.js';

export const LEAD_STATUSES = ['new', 'in_progress', 'promotion', 'done'];

/**
 * Наружу `type` уходит как `source`: админке важно откуда пришёл клиент, а не
 * какой контроллер его записал. contact — это форма контактов на сайте.
 */
const TYPE_TO_SOURCE = { contact: 'form', calculator: 'calculator', manual: 'manual' };
const SOURCE_TO_TYPE = { form: 'contact', calculator: 'calculator', manual: 'manual' };

export const LEAD_SOURCES = Object.keys(SOURCE_TO_TYPE);

/**
 * Строка БД -> клиент CRM. `ip` и `userAgent` намеренно не отдаём: в списке
 * они не нужны, а утечь наружу могут.
 */
const toClient = (lead) => ({
  id: lead.id,
  name: lead.name,
  company: lead.company || null,
  contactMethod: lead.method || null,
  contactValue: lead.contact,
  message: lead.message || null,
  payload: lead.payload || null,
  status: lead.status,
  note: lead.note || null,
  source: TYPE_TO_SOURCE[lead.type] || lead.type,
  createdAt: lead.createdAt,
  updatedAt: lead.updatedAt,
});

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

/* --------------------------------------------------------------- мини-CRM */

/**
 * Список клиентов для админки.
 *
 * `counts` считается по всей таблице, а не по выборке: иначе счётчик рядом с
 * фильтром «новые» показывал бы то же число, что и сам отфильтрованный список.
 */
export const listLeads = async ({ status, source, limit = 200 } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (source) where.type = SOURCE_TO_TYPE[source];

  const [rows, total, grouped] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.lead.count({ where }),
    prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const counts = Object.fromEntries(LEAD_STATUSES.map((key) => [key, 0]));
  grouped.forEach((row) => {
    counts[row.status] = row._count._all;
  });

  return { items: rows.map(toClient), total, counts };
};

/** Клиент, заведённый руками из админки. Письма и телеграма по нему нет. */
export const createManualLead = async ({
  name,
  company,
  contactMethod,
  contactValue,
  message,
  note,
}) =>
  toClient(
    await prisma.lead.create({
      data: {
        type: 'manual',
        name,
        company: company || null,
        contact: contactValue,
        method: contactMethod || null,
        message: message || null,
        note: note || null,
      },
    }),
  );

/** Меняет только переданные поля: PATCH без note не должен стирать заметку. */
export const updateLead = async (id, { status, note, company, contactValue, message, name }) => {
  const data = {};
  if (status !== undefined) data.status = status;
  if (note !== undefined) data.note = note || null;
  if (company !== undefined) data.company = company || null;
  if (message !== undefined) data.message = message || null;
  // Наружу поле зовётся contactValue, в базе это колонка contact.
  if (contactValue !== undefined) data.contact = contactValue;
  if (name !== undefined) data.name = name;

  if (Object.keys(data).length === 0) {
    const existing = await prisma.lead.findUnique({ where: { id } });
    return existing ? toClient(existing) : null;
  }

  try {
    return toClient(await prisma.lead.update({ where: { id }, data }));
  } catch (error) {
    // P2025 — записи нет; контроллер отдаёт по этому 404, а не 500.
    if (error.code === 'P2025') return null;
    throw error;
  }
};

export const deleteLead = async (id) => {
  try {
    await prisma.lead.delete({ where: { id } });
    return true;
  } catch (error) {
    if (error.code === 'P2025') return false;
    throw error;
  }
};
