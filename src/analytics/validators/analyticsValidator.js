/**
 * Нормализация батча событий. Эндпоинт приёма открыт наружу, поэтому в БД
 * попадает только то, что перечислено здесь: чужие поля отбрасываются,
 * строки режутся по длине, числа приводятся к числам.
 */

export const MAX_EVENTS_PER_BATCH = 50;

/** Максимальная длина каждого строкового поля. */
const LIMITS = {
  sessionId: 64,
  visitorId: 64,
  category: 50,
  action: 50,
  label: 200,
  path: 500,
  url: 1000,
  hostname: 255,
  referrer: 1000,
  sourceType: 30,
  utmSource: 200,
  utmMedium: 200,
  utmCampaign: 200,
  utmTerm: 200,
  utmContent: 200,
  deviceType: 30,
  os: 50,
  browser: 50,
  locale: 35,
  timezone: 64,
};

const MAX_PARAMS_BYTES = 2000;
/** Часы клиента могут врать; всё, что дальше этого окна, считаем недостоверным. */
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

const str = (value, max) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
};

const int = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : null;
};

/** Время события: кривое или уехавшее далеко от «сейчас» заменяем на now. */
const occurredAt = (value, now) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return now;
  if (Math.abs(parsed.getTime() - now.getTime()) > MAX_CLOCK_SKEW_MS) return now;
  return parsed;
};

const params = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const serialized = JSON.stringify(value);
    if (!serialized || serialized.length > MAX_PARAMS_BYTES) return null;
    return JSON.parse(serialized);
  } catch {
    return null;
  }
};

/**
 * Приводит одно сырое событие к строке таблицы analytics_events.
 * Возвращает null, если события без обязательных полей — такое пишем в мусор.
 */
export const normalizeEvent = (raw, now) => {
  if (!raw || typeof raw !== 'object') return null;

  const sessionId = str(raw.sessionId, LIMITS.sessionId);
  const category = str(raw.category, LIMITS.category);
  const action = str(raw.action, LIMITS.action);
  if (!sessionId || !category || !action) return null;

  return {
    sessionId,
    visitorId: str(raw.visitorId, LIMITS.visitorId),
    occurredAt: occurredAt(raw.timestamp, now),
    category,
    action,
    label: str(raw.label, LIMITS.label),
    params: params(raw.params),
    path: str(raw.path, LIMITS.path),
    url: str(raw.url, LIMITS.url),
    hostname: str(raw.hostname, LIMITS.hostname),
    referrer: str(raw.referrer, LIMITS.referrer),
    sourceType: str(raw.sourceType, LIMITS.sourceType),
    utmSource: str(raw.utmSource, LIMITS.utmSource),
    utmMedium: str(raw.utmMedium, LIMITS.utmMedium),
    utmCampaign: str(raw.utmCampaign, LIMITS.utmCampaign),
    utmTerm: str(raw.utmTerm, LIMITS.utmTerm),
    utmContent: str(raw.utmContent, LIMITS.utmContent),
    deviceType: str(raw.deviceType, LIMITS.deviceType),
    os: str(raw.os, LIMITS.os),
    browser: str(raw.browser, LIMITS.browser),
    screenWidth: int(raw.screenWidth),
    screenHeight: int(raw.screenHeight),
    locale: str(raw.locale, LIMITS.locale),
    timezone: str(raw.timezone, LIMITS.timezone),
  };
};

/**
 * @returns {{ events: object[], dropped: number }}
 */
export const normalizeBatch = (rawEvents, now = new Date()) => {
  if (!Array.isArray(rawEvents)) return { events: [], dropped: 0 };

  const capped = rawEvents.slice(0, MAX_EVENTS_PER_BATCH);
  const events = [];

  for (const raw of capped) {
    const normalized = normalizeEvent(raw, now);
    if (normalized) events.push(normalized);
  }

  return { events, dropped: rawEvents.length - events.length };
};
