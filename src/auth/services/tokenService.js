import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma.js';

/**
 * Access-токен — короткоживущий JWT в httpOnly-куке.
 * Refresh-токен — случайная строка; в БД лежит только её sha256-хеш, поэтому
 * дамп базы не даёт возможности войти. При каждом обновлении токен ротируется.
 */

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

export const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Срок жизни access-куки в мс — чтобы не парсить '15m' в двух местах. */
export const ACCESS_TTL_MS = (() => {
  const match = String(ACCESS_TTL).match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000;
  const value = Number(match[1]);
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return value * unit;
})();

const getSecret = () => {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      // Метка смены пароля: расходится с БД — токен больше не валиден.
      pwdAt: new Date(user.passwordUpdatedAt).toISOString(),
    },
    getSecret(),
    { expiresIn: ACCESS_TTL },
  );

export const verifyAccessToken = (token) => jwt.verify(token, getSecret());

export const issueRefreshToken = async (userId, { userAgent, ip } = {}) => {
  const token = crypto.randomBytes(48).toString('base64url');

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      userAgent: userAgent ? String(userAgent).slice(0, 255) : null,
      ip: ip || null,
    },
  });

  return token;
};

/** @returns {Promise<{ userId: string } | null>} null, если токен неизвестен, отозван или протух. */
export const findValidRefreshToken = async (token) => {
  if (!token) return null;

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, revokedAt: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) return null;
  return stored;
};

export const revokeRefreshToken = async (token) => {
  if (!token) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

/** Разлогинивает пользователя на всех устройствах — вызывается при смене пароля. */
export const revokeAllUserTokens = (userId) =>
  prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

/** Чистка протухших записей, чтобы таблица не росла бесконечно. */
export const deleteExpiredTokens = () =>
  prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
