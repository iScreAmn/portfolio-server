import { Bot } from 'grammy';
import { getTelegramConfig, isTelegramEnabled } from '../config/telegram.js';

let botInstance = null;
let botToken = null;

const getBot = () => {
  const { token } = getTelegramConfig();
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }

  if (botInstance && botToken === token) return botInstance;

  botToken = token;
  botInstance = new Bot(token);
  return botInstance;
};

const escapeHtml = (input) => {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

export const telegram = {
  escapeHtml
};

export const sendTelegramMessage = async (htmlText, options = {}) => {
  if (!isTelegramEnabled()) {
    return {
      skipped: true,
      reason: 'Telegram is disabled (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHATS_ID)'
    };
  }

  const { chatIds, threadId } = getTelegramConfig();
  const bot = getBot();

  const maxLen = 4000;
  const normalizedHtmlText =
    typeof htmlText === 'string' && htmlText.length > maxLen
      ? `${htmlText.slice(0, maxLen - 1)}…`
      : htmlText;

  const baseOptions = {
    disable_web_page_preview: true,
    ...(threadId ? { message_thread_id: threadId } : {})
  };

  const sendOptionsHtml = {
    ...baseOptions,
    parse_mode: 'HTML',
    ...options
  };

  const toPlainText = (t) => {
    const noTags = String(t ?? '').replace(/<\/?(b|i|pre|code)>/g, '');
    return noTags
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#039;', "'");
  };

  const sendOptionsPlain = {
    ...baseOptions,
    ...options
  };

  const results = await Promise.allSettled(
    chatIds.map(async (chatId) => {
      try {
        return await bot.api.sendMessage(chatId, normalizedHtmlText, sendOptionsHtml);
      } catch (e) {
        const msg = e?.message || '';
        const isParseError =
          typeof msg === 'string' &&
          (msg.includes("can't parse entities") ||
            msg.includes('Bad Request: message is too long') ||
            msg.includes('MESSAGE_TOO_LONG'));
        if (!isParseError) throw e;
        const plain = toPlainText(normalizedHtmlText);
        return await bot.api.sendMessage(chatId, plain, sendOptionsPlain);
      }
    })
  );

  const ok = [];
  const failed = [];

  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') ok.push({ chatId: chatIds[idx], result: r.value });
    else failed.push({ chatId: chatIds[idx], error: r.reason });
  });

  if (failed.length) {
    const err = new Error(`Telegram send failed for ${failed.length}/${chatIds.length} chat(s)`);
    err.details = failed;
    throw err;
  }

  return { skipped: false, okCount: ok.length };
};

export const verifyTelegramConfig = async () => {
  if (!isTelegramEnabled()) return false;
  try {
    const bot = getBot();
    await bot.api.getMe();
    return true;
  } catch (e) {
    console.error('Telegram configuration error:', e?.message || e);
    return false;
  }
};

export const getTelegramHealthDetails = () => {
  const cfg = getTelegramConfig();
  return {
    enabled: isTelegramEnabled(),
    hasToken: Boolean(cfg.token),
    chatIdsCount: cfg.chatIds.length,
    threadId: cfg.threadId ?? null,
    logsThreadId: cfg.logsThreadId ?? null
  };
};
