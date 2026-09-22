import { verifyAccessToken } from '../services/tokenService.js';
import { findById, toPublicUser } from '../repositories/userRepository.js';
import { ACCESS_COOKIE } from '../utils/cookies.js';

const unauthorized = (res) => res.status(401).json({ success: false, message: 'Unauthorized' });

/**
 * Пускает дальше только с валидным access-токеном из httpOnly-куки.
 * Заголовок Authorization намеренно не читаем: токенов вне кук у нас нет.
 */
export const requireAuth = async (req, res, next) => {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return unauthorized(res);

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return unauthorized(res);
  }

  // Сверяемся с БД: учётку могли удалить, а роль — понизить уже после
  // выдачи токена.
  const user = await findById(payload.sub);
  if (!user) return unauthorized(res);

  const tokenPwdAt = String(payload.pwdAt || '');
  const dbPwdAt = new Date(user.passwordUpdatedAt).toISOString();
  if (tokenPwdAt !== dbPwdAt) return unauthorized(res);

  req.user = toPublicUser(user);
  return next();
};

/** Ставится после requireAuth. */
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return unauthorized(res);
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    return next();
  };
