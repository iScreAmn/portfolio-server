import { sendTelegramMessage, telegram } from './telegramClient.js';

const { escapeHtml } = telegram;

const linesToHtml = (lines) => lines.filter(Boolean).join('\n');

export const sendContactTelegramNotification = async (data) => {
  const contactLabel = data.contactMethod === 'Email' ? 'Email' : 'Phone';
  const html = linesToHtml([
    `<b>New Contact Form Submission (Portfolio)</b>`,
    ``,
    `<b>Name:</b> ${escapeHtml(data.name)}`,
    `<b>Preferred contact:</b> ${escapeHtml(data.contactMethod)}`,
    `<b>${escapeHtml(contactLabel)}:</b> ${escapeHtml(data.contactValue)}`,
    `<b>Message:</b> ${escapeHtml(data.message || '—')}`,
    ``,
    `<b>Submitted at:</b> ${escapeHtml(data.submitted_at)}`
  ]);

  return sendTelegramMessage(html);
};

export const sendReviewTelegramNotification = async (review) => {
  const html = linesToHtml([
    `<b>⭐ Новый отзыв ждёт подтверждения</b>`,
    ``,
    `<b>Имя:</b> ${escapeHtml(review.name)}`,
    review.company ? `<b>Компания:</b> ${escapeHtml(review.company)}` : '',
    `<b>Отзыв:</b> ${escapeHtml(review.text)}`,
    ``,
    `Подтвердить или удалить — на дашборде админки.`
  ]);

  return sendTelegramMessage(html);
};

const translateValues = {
  projectType: {
    landing: 'Лендинг',
    corporate: 'Корпоративный сайт',
    ecommerce: 'Интернет-магазин',
    webapp: 'Веб-приложение'
  },
  goals: {
    leads: 'Лиды/заявки',
    sales: 'Онлайн-продажи',
    branding: 'Презентация бренда',
    automation: 'Автоматизация процессов'
  },
  scope: {
    mvp: 'MVP (до 5 страниц)',
    medium: 'Средний (6-10)',
    large: 'Большой (15+)'
  },
  designApproach: {
    hasDesign: 'Есть референс/дизайн',
    needDesign: 'Нужна разработка дизайна'
  },
  features: {
    admin: 'Админ-панель',
    cabinet: 'Личный кабинет',
    filters: 'Фильтры/поиск',
    multilang: 'Мультиязычность',
    blog: 'Блог/CMS',
    payment: 'Online Оплата',
    notifications: 'Telegram/email уведомления',
    seo: 'SEO'
  },
  content: {
    ready: 'Контент готов',
    needText: 'Нужна помощь с текстами',
    needVisual: 'Нужна помощь с визуалом'
  },
  timeline: {
    standard: 'Стандарт',
    fast: 'Ускоренно',
    urgent: 'Срочно'
  },
  support: {
    none: 'Не нужна',
    '1month': '1 месяц',
    '3months': '3 месяца',
    partnership: 'Партнерство'
  }
};

export const sendCalculatorTelegramNotification = async (data) => {
  const projectTypeText = translateValues.projectType[data.projectType] || data.projectType || '—';
  const goalsText = (data.goals || []).map(g => translateValues.goals[g] || g).join(', ') || '—';
  const scopeText = translateValues.scope[data.scope] || data.scope || '—';
  const designApproachText = translateValues.designApproach[data.designApproach] || data.designApproach || '—';
  const featuresText = (data.features || []).map(f => translateValues.features[f] || f).join(', ') || '—';
  const contentText = translateValues.content[data.content] || data.content || '—';
  const timelineText = translateValues.timeline[data.timeline] || data.timeline || '—';
  const supportText = translateValues.support[data.support] || data.support || '—';

  const html = linesToHtml([
    `<b>🧮 Новый запрос из калькулятора</b>`,
    ``,
    `<b>👤 Имя:</b> ${escapeHtml(data.name)}`,
    `<b>📞 Контакт:</b> ${escapeHtml(data.contact)}`,
    data.message ? `<b>💬 Сообщение:</b> ${escapeHtml(data.message)}` : '',
    ``,
    `<b>📋 Параметры проекта:</b>`,
    `<b>Тип:</b> ${escapeHtml(projectTypeText)}`,
    `<b>Цели:</b> ${escapeHtml(goalsText)}`,
    `<b>Объём:</b> ${escapeHtml(scopeText)}`,
    `<b>Дизайн:</b> ${escapeHtml(designApproachText)}`,
    `<b>Функционал:</b> ${escapeHtml(featuresText)}`,
    `<b>Контент:</b> ${escapeHtml(contentText)}`,
    `<b>Сроки:</b> ${escapeHtml(timelineText)}`,
    `<b>Поддержка:</b> ${escapeHtml(supportText)}`,
    ``,
    `<b>Отправлено:</b> ${escapeHtml(data.submitted_at)}`
  ]);

  return sendTelegramMessage(html);
};
