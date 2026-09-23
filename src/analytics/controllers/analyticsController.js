import * as analyticsService from '../services/analyticsService.js';
import { getClientIp } from '../utils/geo.js';

/** Период по умолчанию, если фронт не прислал from/to. */
const DEFAULT_RANGE_DAYS = 7;
const MAX_RANGE_DAYS = 400;
const MAX_SESSIONS = 200;
const MAX_SESSION_EVENTS = 1000;

const parseDate = (value, fallback) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const parseLimit = (value, fallback, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

/**
 * Границы периода из query. Слишком широкий запрос обрезаем: иначе один
 * кривой from на десять лет кладёт базу тяжёлой агрегацией.
 */
const parsePeriod = (query) => {
  const to = parseDate(query.to, new Date());
  const defaultFrom = new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 3600 * 1000);
  let from = parseDate(query.from, defaultFrom);

  const maxSpanMs = MAX_RANGE_DAYS * 24 * 3600 * 1000;
  if (to.getTime() - from.getTime() > maxSpanMs) {
    from = new Date(to.getTime() - maxSpanMs);
  }
  if (from > to) from = defaultFrom;

  return { from, to };
};

export const trackEvents = async (req, res) => {
  try {
    const rawEvents = req.body?.events;

    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      return res.status(400).json({ success: false, message: 'events must be a non-empty array' });
    }

    const result = await analyticsService.trackEvents({
      rawEvents,
      ip: getClientIp(req),
    });

    // 202: трекер не ждёт подтверждения и не ретраит — отвечаем «принято».
    return res.status(202).json({ success: true, ...result });
  } catch (error) {
    console.error('[analytics] track error:', error);
    return res.status(500).json({ success: false, message: 'Failed to track events' });
  }
};

export const getSummary = async (req, res) => {
  try {
    const { from, to } = parsePeriod(req.query);
    const summary = await analyticsService.getSummary(from, to);
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('[analytics] summary error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load summary' });
  }
};

export const getDevices = async (req, res) => {
  try {
    const { from, to } = parsePeriod(req.query);
    const limit = parseLimit(req.query.limit, 10, 50);
    const devices = await analyticsService.getDevices(from, to, limit);
    return res.json({ success: true, data: devices });
  } catch (error) {
    console.error('[analytics] devices error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load devices' });
  }
};

export const getSessions = async (req, res) => {
  try {
    const { from, to } = parsePeriod(req.query);
    const limit = parseLimit(req.query.limit, 100, MAX_SESSIONS);
    const sessions = await analyticsService.getSessions(from, to, limit);
    return res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('[analytics] sessions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load sessions' });
  }
};

export const getSessionEvents = async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required' });
    }

    const limit = parseLimit(req.query.limit, 500, MAX_SESSION_EVENTS);
    const events = await analyticsService.getSessionEvents(sessionId, limit);

    if (events === null) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    return res.json({ success: true, data: events });
  } catch (error) {
    console.error('[analytics] session events error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load session events' });
  }
};

/** Только для dev: полная очистка таблицы событий, чтобы не тащить тестовые переходы в отчёты. */
export const deleteAllEvents = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Недоступно в production' });
  }
  try {
    const count = await analyticsService.deleteAll();
    return res.json({ success: true, data: { deleted: count } });
  } catch (error) {
    console.error('[analytics] delete all error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete events' });
  }
};
