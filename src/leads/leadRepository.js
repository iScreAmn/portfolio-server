import { prisma } from '../config/prisma.js';

export const LEAD_STATUSES = ['new', 'in_progress', 'promotion', 'done'];

const TYPE_TO_SOURCE = {
  contact: 'form',
  calculator: 'calculator',
  package: 'package',
  manual: 'manual',
};
const SOURCE_TO_TYPE = {
  form: 'contact',
  calculator: 'calculator',
  package: 'package',
  manual: 'manual',
};

export const LEAD_SOURCES = Object.keys(SOURCE_TO_TYPE);

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


export const listLeads = async ({ status, source, limit = 200 } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (source) where.type = SOURCE_TO_TYPE[source];

  const [rows, total, grouped] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
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

export const updateLead = async (id, { status, note, company, contactValue, message, name }) => {
  const data = {};
  if (status !== undefined) data.status = status;
  if (note !== undefined) data.note = note || null;
  if (company !== undefined) data.company = company || null;
  if (message !== undefined) data.message = message || null;
  if (contactValue !== undefined) data.contact = contactValue;
  if (name !== undefined) data.name = name;

  if (Object.keys(data).length === 0) {
    const existing = await prisma.lead.findUnique({ where: { id } });
    return existing ? toClient(existing) : null;
  }

  try {
    return toClient(await prisma.lead.update({ where: { id }, data }));
  } catch (error) {
    if (error.code === 'P2025') return null;
    throw error;
  }
};

export const reorderLeads = async (ids) => {
  const rows = await prisma.lead.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    select: { id: true, sortOrder: true },
  });

  const known = new Map(rows.map((row) => [row.id, row.sortOrder]));
  const queue = [...new Set(ids)].filter((id) => known.has(id));
  if (queue.length === 0) return false;

  const moving = new Set(queue);
  let cursor = 0;

  const updates = [];
  rows.forEach((row, index) => {
    const id = moving.has(row.id) ? queue[cursor++] : row.id;
    const sortOrder = index + 1;
    if (known.get(id) !== sortOrder) {
      updates.push(prisma.lead.update({ where: { id }, data: { sortOrder } }));
    }
  });

  if (updates.length > 0) await prisma.$transaction(updates);
  return true;
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
