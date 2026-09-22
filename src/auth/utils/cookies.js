import { ACCESS_TTL_MS, REFRESH_TTL_MS } from '../services/tokenService.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

/**
 * Refresh-кука уходит только на роуты обновления сессии — на остальных
 * запросах её в браузере просто нет, так что и украсть её из них нечего.
 */
const REFRESH_COOKIE_PATH = '/api/auth';

/**
 * SameSite=Lax достаточно: djcode.ge и api.djcode.ge — один site (одна
 * регистрируемая зона), так что запрос из фронта к API кросс-сайтовым
 * не считается. None пришлось бы ставить только при разных доменах.
 */
const baseOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const domain = String(process.env.COOKIE_DOMAIN || '').trim();

  return {
    httpOnly: true,
    sameSite: 'lax',
    // Secure-куку браузер не примет по http://localhost, поэтому только в проде.
    secure: isProduction,
    ...(domain ? { domain } : {}),
  };
};

export const setAuthCookies = (res, { accessToken, refreshToken }) => {
  const options = baseOptions();

  res.cookie(ACCESS_COOKIE, accessToken, {
    ...options,
    path: '/',
    maxAge: ACCESS_TTL_MS,
  });

  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...options,
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_TTL_MS,
    });
  }
};

export const clearAuthCookies = (res) => {
  const options = baseOptions();
  // Параметры должны совпадать с теми, что были при установке, иначе
  // браузер не найдёт куку и не удалит её.
  res.clearCookie(ACCESS_COOKIE, { ...options, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...options, path: REFRESH_COOKIE_PATH });
};
