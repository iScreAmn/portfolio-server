import { prisma } from '../config/prisma.js';

export const REVIEW_STATUSES = ['pending', 'approved'];

const toPublic = (review) => ({
  id: review.id,
  name: review.name,
  company: review.company || null,
  text: review.text,
  photo: review.photo || null,
  logo: review.logo || null,
});

const toAdmin = (review) => ({
  ...toPublic(review),
  status: review.status,
  approvedAt: review.approvedAt,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
});

export const createReview = async ({ name, company, text, photo, logo, ip, userAgent }) =>
  toAdmin(
    await prisma.review.create({
      data: {
        name,
        company: company || null,
        text,
        photo: photo || null,
        logo: logo || null,
        ip: ip || null,
        userAgent: userAgent ? String(userAgent).slice(0, 255) : null,
      },
    }),
  );

export const listApprovedReviews = async () =>
  (
    await prisma.review.findMany({
      where: { status: 'approved' },
      orderBy: { approvedAt: 'desc' },
    })
  ).map(toPublic);

export const listReviews = async ({ status } = {}) => {
  const where = status ? { status } : {};
  const [rows, grouped] = await Promise.all([
    prisma.review.findMany({ where, orderBy: { createdAt: 'desc' } }),
    prisma.review.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const counts = Object.fromEntries(REVIEW_STATUSES.map((key) => [key, 0]));
  grouped.forEach((row) => {
    counts[row.status] = row._count._all;
  });

  return { items: rows.map(toAdmin), counts };
};

const updateById = async (id, data) => {
  try {
    return toAdmin(await prisma.review.update({ where: { id }, data }));
  } catch (error) {
    if (error.code === 'P2025') return null;
    throw error;
  }
};

export const updateReview = (id, { name, company, text, photo, logo }) => {
  const data = {};
  if (name !== undefined) data.name = name;
  if (company !== undefined) data.company = company || null;
  if (text !== undefined) data.text = text;
  // null — явное «убрать картинку», undefined — «не трогать».
  if (photo !== undefined) data.photo = photo || null;
  if (logo !== undefined) data.logo = logo || null;
  return updateById(id, data);
};

export const approveReview = (id) =>
  updateById(id, { status: 'approved', approvedAt: new Date() });

export const deleteReview = async (id) => {
  try {
    await prisma.review.delete({ where: { id } });
    return true;
  } catch (error) {
    if (error.code === 'P2025') return false;
    throw error;
  }
};
