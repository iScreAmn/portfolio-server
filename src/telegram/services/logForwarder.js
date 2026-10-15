import { inspect } from 'node:util';
import { getTelegramConfig, isTelegramEnabled } from '../config/telegram.js';
import { sendTelegramMessage, telegram } from './telegramClient.js';

const { escapeHtml } = telegram;
const FLUSH_DELAY_MS = 2000;
const MIN_SEND_INTERVAL_MS = 3000;
const MAX_BUFFERED = 50;
const MAX_ENTRY_LENGTH = 1500;
const MAX_MESSAGE_LENGTH = 3800;

const LEVEL_ICONS = { error: '🔴', warn: '🟡', info: '🟢' };

const formatArg = (arg) => {
  if (arg instanceof Error) return arg.stack || arg.message;
  if (typeof arg === 'string') return arg;
  return inspect(arg, { depth: 4, breakLength: 100 });
};

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const formatEntry = ({ level, time, text }) => {
  const icon = LEVEL_ICONS[level] || '⚪';
  return `${icon} <b>${level.toUpperCase()}</b> ${escapeHtml(time)}\n<pre>${escapeHtml(text)}</pre>`;
};

export const createLogForwarder = ({ send, writeError }) => {
  let buffer = [];
  let dropped = 0;
  let timer = null;
  let lastSentAt = 0;
  let sending = Promise.resolve();

  const takeMessage = () => {
    const parts = [];
    let length = 0;
    while (buffer.length) {
      const html = formatEntry(buffer[0]);
      if (parts.length && length + html.length > MAX_MESSAGE_LENGTH) break;
      parts.push(html);
      length += html.length + 2;
      buffer.shift();
    }
    if (dropped && !buffer.length) {
      parts.push(`<i>…и ещё ${dropped} записей пропущено</i>`);
      dropped = 0;
    }
    return parts.join('\n\n');
  };

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    sending = sending.then(async () => {
      while (buffer.length || dropped) {
        const wait = lastSentAt + MIN_SEND_INTERVAL_MS - Date.now();
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        const html = takeMessage();
        lastSentAt = Date.now();
        try {
          await send(html);
        } catch (error) {
          // Через оригинальный console, иначе ошибка отправки снова попадёт в буфер.
          writeError('[telegram-logs] не удалось отправить лог:', error?.message || error);
        }
      }
    });
    return sending;
  };

  const push = (level, args) => {
    if (buffer.length >= MAX_BUFFERED) {
      dropped += 1;
    } else {
      buffer.push({
        level,
        time: new Date().toISOString(),
        text: truncate(args.map(formatArg).join(' '), MAX_ENTRY_LENGTH),
      });
    }
    if (!timer) timer = setTimeout(flush, FLUSH_DELAY_MS);
  };

  return { push, flush };
};

let forwarder = null;

// Перехватывает console.error/console.warn и дублирует их в топик «VPS Logs».
// Включается только в проде, когда задан TELEGRAM_LOGS_THREAD_ID.
export const installTelegramLogForwarder = () => {
  const { logsThreadId } = getTelegramConfig();
  if (forwarder || !logsThreadId || !isTelegramEnabled()) return false;
  if (process.env.NODE_ENV !== 'production') return false;

  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);

  forwarder = createLogForwarder({
    send: (html) => sendTelegramMessage(html, { message_thread_id: logsThreadId }),
    writeError: originalError,
  });

  console.error = (...args) => {
    originalError(...args);
    forwarder.push('error', args);
  };
  console.warn = (...args) => {
    originalWarn(...args);
    forwarder.push('warn', args);
  };

  return true;
};

export const logToTelegram = (level, ...args) => {
  forwarder?.push(level, args);
};

// Дожидается отправки накопленных логов, но не дольше timeoutMs.
export const flushTelegramLogs = (timeoutMs = 5000) => {
  if (!forwarder) return Promise.resolve();
  return Promise.race([
    forwarder.flush(),
    new Promise((resolve) => setTimeout(resolve, timeoutMs).unref()),
  ]);
};
