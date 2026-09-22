import { prisma } from '../../config/prisma.js';

/** Email — логин, поэтому регистр не должен создавать двух разных учёток. */
export const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

/** Наружу уходит всё, кроме хеша пароля. */
const PUBLIC_FIELDS = {
  id: true,
  email: true,
  role: true,
  passwordUpdatedAt: true,
  createdAt: true,
};

export const findByEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return prisma.user.findUnique({ where: { email: normalized } });
};

export const findById = (id) => {
  const normalized = String(id || '').trim();
  if (!normalized) return null;
  return prisma.user.findUnique({ where: { id: normalized } });
};

export const findPublicById = (id) => {
  const normalized = String(id || '').trim();
  if (!normalized) return null;
  return prisma.user.findUnique({ where: { id: normalized }, select: PUBLIC_FIELDS });
};

/**
 * Смена пароля двигает passwordUpdatedAt — эта метка лежит в access-токене,
 * поэтому все ранее выданные токены сразу перестают проходить проверку.
 */
export const updatePassword = (id, passwordHash) =>
  prisma.user.update({
    where: { id },
    data: { passwordHash, passwordUpdatedAt: new Date() },
    select: PUBLIC_FIELDS,
  });

export const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role,
});
