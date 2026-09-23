import bcrypt from 'bcryptjs';
import * as tokenService from '../services/tokenService.js';
import * as userRepository from '../repositories/userRepository.js';
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from '../utils/cookies.js';

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

/** Один и тот же текст на «нет такого email» и «неверный пароль» — чтобы перебором нельзя было узнать существующие адреса. */
const INVALID_CREDENTIALS = 'Неверный email или пароль';

/**
 * Валидный хеш от случайной строки. Нужен, чтобы ответ на несуществующий
 * email занимал столько же времени, сколько и на существующий: иначе
 * наличие учётки видно по времени ответа. Хеш с битым форматом для этого
 * не годится — bcrypt отвергает его мгновенно, не считая.
 */
const DUMMY_HASH = '$2b$12$Qk6JKKbUUjCdKV0n3fr5JuT5M5zql78hlWk2uw6QMaGEKlcQ9icwK';

const requestMeta = (req) => ({
  userAgent: req.get('user-agent') || '',
  ip: req.ip || '',
});

const issueSession = async (res, user, req) => {
  const accessToken = tokenService.signAccessToken(user);
  const refreshToken = await tokenService.issueRefreshToken(user.id, requestMeta(req));
  setAuthCookies(res, { accessToken, refreshToken });
};

export const login = async (req, res) => {
  try {
    const email = userRepository.normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email и пароль обязательны' });
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ success: false, message: INVALID_CREDENTIALS });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: INVALID_CREDENTIALS });
    }

    await issueSession(res, user, req);
    return res.json({ success: true, data: { user: userRepository.toPublicUser(user) } });
  } catch (error) {
    console.error('[auth] login error:', error);
    return res.status(500).json({ success: false, message: 'Не удалось войти' });
  }
};

/** Обновление сессии с ротацией: старый refresh-токен сразу отзывается. */
export const refresh = async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    const stored = await tokenService.findValidRefreshToken(token);

    if (!stored) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await userRepository.findById(stored.userId);
    if (!user) {
      await tokenService.revokeRefreshToken(token);
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    await tokenService.revokeRefreshToken(token);
    await issueSession(res, user, req);

    return res.json({ success: true, data: { user: userRepository.toPublicUser(user) } });
  } catch (error) {
    console.error('[auth] refresh error:', error);
    return res.status(500).json({ success: false, message: 'Не удалось обновить сессию' });
  }
};

export const logout = async (req, res) => {
  try {
    await tokenService.revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
  } catch (error) {
    // Даже если отозвать не вышло, куки у клиента гасим.
    console.error('[auth] logout error:', error);
  }
  clearAuthCookies(res);
  return res.json({ success: true });
};

export const me = (req, res) =>
  res.json({
    success: true,
    data: {
      user: req.user,
      // Фронту нужно знать режим бэкенда, а не свой собственный: аналитика
      // хранится на сервере, и именно его NODE_ENV решает, можно ли её чистить.
      isDev: process.env.NODE_ENV !== 'production',
    },
  });

export const changePassword = async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ success: false, message: 'Текущий и новый пароль обязательны' });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Новый пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`,
      });
    }
    if (newPassword === currentPassword) {
      return res
        .status(400)
        .json({ success: false, message: 'Новый пароль совпадает с текущим' });
    }

    const user = await userRepository.findById(req.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(403).json({ success: false, message: 'Текущий пароль неверен' });
    }

    const updated = await userRepository.updatePassword(
      user.id,
      await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
    );

    // Старые сессии больше не действуют — выдаём новую, чтобы не выкидывать
    // из админки того, кто только что сменил пароль.
    await tokenService.revokeAllUserTokens(user.id);
    await issueSession(res, { ...user, passwordUpdatedAt: updated.passwordUpdatedAt }, req);

    return res.json({ success: true, message: 'Пароль изменён' });
  } catch (error) {
    console.error('[auth] changePassword error:', error);
    return res.status(500).json({ success: false, message: 'Не удалось сменить пароль' });
  }
};
