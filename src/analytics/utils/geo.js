import geoip from 'geoip-lite';

/**
 * Раньше страну и город подставлял хостинг своими заголовками. На своём
 * сервере их нет, поэтому резолвим сами по IP из офлайн-базы GeoLite2,
 * которая приезжает вместе с пакетом geoip-lite.
 */

/** `::ffff:1.2.3.4` -> `1.2.3.4`; IPv6 оставляем как есть. */
const normalizeIp = (value) => {
  const ip = String(value || '').trim();
  if (!ip) return '';
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return mapped ? mapped[1] : ip;
};

/**
 * req.ip уже учитывает X-Forwarded-For — при условии, что в server.js
 * выставлен trust proxy. Без него сюда прилетал бы IP самого nginx.
 */
export const getClientIp = (req) => normalizeIp(req.ip || req.socket?.remoteAddress);

/** Пустые строки вместо null: фронт показывает их как «N/A» без доп. проверок. */
export const lookupGeo = (ip) => {
  const normalized = normalizeIp(ip);
  if (!normalized) return { country: '', region: '', city: '' };

  try {
    const hit = geoip.lookup(normalized);
    if (!hit) return { country: '', region: '', city: '' };
    return {
      country: hit.country || '',
      region: hit.region || '',
      city: hit.city || '',
    };
  } catch {
    // Битая база или кривой IP не должны ронять приём событий.
    return { country: '', region: '', city: '' };
  }
};
