const parseChatIds = (value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .map((v) => v.replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
};

const parseThreadId = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

export const getTelegramConfig = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = parseChatIds(process.env.TELEGRAM_CHATS_ID);
  const threadId = parseThreadId(process.env.TELEGRAM_THREAD_ID);
  const logsThreadId = parseThreadId(process.env.TELEGRAM_LOGS_THREAD_ID);

  return {
    token,
    chatIds,
    threadId,
    logsThreadId
  };
};

export const isTelegramEnabled = () => {
  const { token, chatIds } = getTelegramConfig();
  return Boolean(token && chatIds.length);
};
