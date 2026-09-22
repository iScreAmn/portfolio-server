import { prisma } from '../../config/prisma.js';

/**
 * Агрегаты считает Postgres, а не Node: выборки по сессиям требуют
 * DISTINCT ON и FILTER, которые в query-билдере Prisma не выражаются.
 *
 * Все COUNT приводятся к ::int намеренно — иначе драйвер отдаёт BigInt,
 * который потом ломает JSON.stringify в ответе.
 */

export const insertEvents = async (events) => {
  if (!events.length) return 0;
  const { count } = await prisma.analyticsEvent.createMany({ data: events });
  return count;
};

export const getTotals = async (from, to) => {
  const [row] = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS events,
      COUNT(*) FILTER (WHERE category = 'page' AND action = 'pageview')::int AS pageviews,
      COUNT(DISTINCT session_id)::int AS sessions,
      COUNT(DISTINCT visitor_id)::int AS visitors
    FROM analytics_events
    WHERE occurred_at >= ${from} AND occurred_at < ${to}
  `;
  return row;
};

/** Средняя длительность визита и доля сессий ровно с одним просмотром. */
export const getSessionStats = async (from, to) => {
  const [row] = await prisma.$queryRaw`
    WITH sess AS (
      SELECT
        session_id,
        MIN(occurred_at) AS started_at,
        MAX(occurred_at) AS ended_at,
        COUNT(*) FILTER (WHERE category = 'page' AND action = 'pageview') AS pageviews
      FROM analytics_events
      WHERE occurred_at >= ${from} AND occurred_at < ${to}
      GROUP BY session_id
    )
    SELECT
      COALESCE(AVG(EXTRACT(EPOCH FROM (ended_at - started_at))), 0)::float AS avg_session_seconds,
      COALESCE(AVG(CASE WHEN pageviews <= 1 THEN 1 ELSE 0 END), 0)::float AS bounce_rate
    FROM sess
  `;
  return row;
};

/**
 * Дни в UTC: фронт достраивает пропуски по UTC-ключам, и если считать
 * в локальной зоне, границы разъедутся и в графике появятся дубли.
 */
export const getDaily = (from, to) => prisma.$queryRaw`
  SELECT
    to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
    COUNT(DISTINCT session_id)::int AS sessions,
    COUNT(*) FILTER (WHERE category = 'page' AND action = 'pageview')::int AS pageviews
  FROM analytics_events
  WHERE occurred_at >= ${from} AND occurred_at < ${to}
  GROUP BY day
  ORDER BY day ASC
`;

/** Query-строка в пути не нужна: /portfolio?ref=x и /portfolio — одна страница. */
export const getTopPages = (from, to, limit) => prisma.$queryRaw`
  SELECT
    split_part(COALESCE(path, ''), '?', 1) AS path,
    COUNT(*)::int AS pageviews
  FROM analytics_events
  WHERE occurred_at >= ${from} AND occurred_at < ${to}
    AND category = 'page' AND action = 'pageview'
    AND COALESCE(path, '') NOT LIKE '/admin%'
  GROUP BY 1
  HAVING split_part(COALESCE(path, ''), '?', 1) <> ''
  ORDER BY pageviews DESC
  LIMIT ${limit}
`;

/**
 * Источник, страна и устройство — свойства визита, а не события, поэтому
 * берутся из первого события сессии (DISTINCT ON + ORDER BY occurred_at).
 */
export const getSources = (from, to, limit) => prisma.$queryRaw`
  WITH first_ev AS (
    SELECT DISTINCT ON (session_id) session_id, source_type
    FROM analytics_events
    WHERE occurred_at >= ${from} AND occurred_at < ${to}
    ORDER BY session_id, occurred_at ASC
  )
  SELECT COALESCE(NULLIF(source_type, ''), 'unknown') AS source_type, COUNT(*)::int AS sessions
  FROM first_ev
  GROUP BY 1
  ORDER BY sessions DESC
  LIMIT ${limit}
`;

export const getCountries = (from, to, limit) => prisma.$queryRaw`
  WITH first_ev AS (
    SELECT DISTINCT ON (session_id) session_id, country
    FROM analytics_events
    WHERE occurred_at >= ${from} AND occurred_at < ${to}
    ORDER BY session_id, occurred_at ASC
  )
  SELECT country, COUNT(*)::int AS sessions
  FROM first_ev
  WHERE COALESCE(country, '') <> ''
  GROUP BY country
  ORDER BY sessions DESC
  LIMIT ${limit}
`;

export const getDevices = (from, to, limit) => prisma.$queryRaw`
  WITH first_ev AS (
    SELECT DISTINCT ON (session_id) session_id, device_type, os, browser
    FROM analytics_events
    WHERE occurred_at >= ${from} AND occurred_at < ${to}
    ORDER BY session_id, occurred_at ASC
  )
  SELECT
    COALESCE(NULLIF(device_type, ''), 'unknown') AS device_type,
    COALESCE(NULLIF(os, ''), 'unknown') AS os,
    COALESCE(NULLIF(browser, ''), 'unknown') AS browser,
    COUNT(*)::int AS sessions
  FROM first_ev
  GROUP BY 1, 2, 3
  ORDER BY sessions DESC
  LIMIT ${limit}
`;

/** Список визитов: агрегаты + атрибуты первого события + точки входа/выхода. */
export const getSessions = (from, to, limit) => prisma.$queryRaw`
  WITH ev AS (
    SELECT * FROM analytics_events
    WHERE occurred_at >= ${from} AND occurred_at < ${to}
  ),
  agg AS (
    SELECT
      session_id,
      MIN(occurred_at) AS started_at,
      MAX(occurred_at) AS ended_at,
      COUNT(*)::int AS events,
      COUNT(*) FILTER (WHERE category = 'page' AND action = 'pageview')::int AS pageviews
    FROM ev
    GROUP BY session_id
  ),
  first_ev AS (
    SELECT DISTINCT ON (session_id)
      session_id, visitor_id, device_type, os, browser,
      country, region, city, referrer, source_type, utm_source
    FROM ev
    ORDER BY session_id, occurred_at ASC
  ),
  entry AS (
    SELECT DISTINCT ON (session_id) session_id, path
    FROM ev WHERE category = 'page' AND action = 'pageview'
    ORDER BY session_id, occurred_at ASC
  ),
  exit_page AS (
    SELECT DISTINCT ON (session_id) session_id, path
    FROM ev WHERE category = 'page' AND action = 'pageview'
    ORDER BY session_id, occurred_at DESC
  )
  SELECT
    a.session_id, a.started_at, a.ended_at, a.events, a.pageviews,
    f.visitor_id, f.device_type, f.os, f.browser,
    f.country, f.region, f.city, f.referrer, f.utm_source,
    COALESCE(NULLIF(f.source_type, ''), 'unknown') AS source_type,
    e.path AS entry_path,
    x.path AS exit_path
  FROM agg a
  JOIN first_ev f USING (session_id)
  LEFT JOIN entry e USING (session_id)
  LEFT JOIN exit_page x USING (session_id)
  ORDER BY a.started_at DESC
  LIMIT ${limit}
`;

export const getSessionEvents = (sessionId, limit) => prisma.$queryRaw`
  SELECT occurred_at, category, action, label, path, params
  FROM analytics_events
  WHERE session_id = ${sessionId}
  ORDER BY occurred_at ASC
  LIMIT ${limit}
`;

export const sessionExists = async (sessionId) => {
  const found = await prisma.analyticsEvent.findFirst({
    where: { sessionId },
    select: { id: true },
  });
  return Boolean(found);
};
