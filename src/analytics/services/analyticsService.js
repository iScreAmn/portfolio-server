import * as repo from '../repositories/analyticsRepository.js';
import { normalizeBatch } from '../validators/analyticsValidator.js';
import { lookupGeo } from '../utils/geo.js';

/** Аварийный выключатель: приём событий отвечает 202, но в БД ничего не пишет. */
const isDisabled = () => process.env.ANALYTICS_DISABLED === '1';

const DEFAULT_ALLOWED_HOSTS = ['djcode.ge', 'www.djcode.ge'];

const getAllowedHosts = () => {
  const fromEnv = String(process.env.ANALYTICS_ALLOWED_HOSTS || '').trim();
  const hosts = fromEnv
    ? fromEnv.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_ALLOWED_HOSTS;
  return new Set(hosts);
};

/** Собственные визиты в админку в статистику сайта не попадают. */
const isAdminPath = (path) => String(path || '').split('?')[0].startsWith('/admin');

/**
 * Принимает батч от трекера: нормализует, отсеивает чужие домены и админку,
 * дописывает IP и гео, пишет одной вставкой.
 */
export const trackEvents = async ({ rawEvents, ip }) => {
  const { events, dropped } = normalizeBatch(rawEvents);
  if (!events.length) return { count: 0, dropped };

  const allowedHosts = getAllowedHosts();
  const eligible = events.filter((event) => {
    if (isAdminPath(event.path)) return false;
    // Событие без hostname пришло не от нашего трекера — не доверяем.
    return event.hostname ? allowedHosts.has(event.hostname.toLowerCase()) : false;
  });

  if (!eligible.length) return { count: 0, dropped: rawEvents.length };
  if (isDisabled()) return { count: 0, dropped: rawEvents.length };

  const geo = lookupGeo(ip);
  const rows = eligible.map((event) => ({ ...event, ip, ...geo }));

  const count = await repo.insertEvents(rows);
  return { count, dropped: rawEvents.length - count };
};

const TOP_LIMIT = 10;
const COUNTRIES_LIMIT = 20;

/** Сводка за период — всё, что рисует вкладка Overview, одним запросом. */
export const getSummary = async (from, to) => {
  const [totals, sessionStats, daily, topPages, sources, countries] = await Promise.all([
    repo.getTotals(from, to),
    repo.getSessionStats(from, to),
    repo.getDaily(from, to),
    repo.getTopPages(from, to, TOP_LIMIT),
    repo.getSources(from, to, TOP_LIMIT),
    repo.getCountries(from, to, COUNTRIES_LIMIT),
  ]);

  return {
    totals,
    avg_session_seconds: Math.round(sessionStats.avg_session_seconds),
    bounce_rate: sessionStats.bounce_rate,
    daily,
    top_pages: topPages,
    sources,
    countries,
  };
};

export const getDevices = (from, to, limit) => repo.getDevices(from, to, limit);

export const getSessions = (from, to, limit) => repo.getSessions(from, to, limit);

export const getSessionEvents = async (sessionId, limit) => {
  const events = await repo.getSessionEvents(sessionId, limit);
  // Пустой список неотличим от несуществующей сессии — уточняем отдельно,
  // чтобы фронт мог показать 404, а не «событий нет».
  if (!events.length && !(await repo.sessionExists(sessionId))) return null;
  return events;
};
