import { validationResult } from 'express-validator';
import { sendContactEmail } from '../services/contactService.js';
import { isSpamMessage } from '../middlewares/spamGuard.js';
import { sendContactTelegramNotification } from '../../telegram/services/notifications.js';
import { saveLead } from '../../leads/leadRepository.js';

/** Простейшая проверка «свой-чужой» из формы. Ответ задаётся в env. */
const getCaptchaAnswer = () => String(process.env.CONTACT_CAPTCHA_ANSWER || '').trim();

const isEmailConfigured = () =>
  Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);

const METHOD_LABELS = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  email: 'Email'
};

const normalizeContact = (method, value) => {
  const raw = value.trim();
  if (method === 'telegram' && /^[A-Za-z][\w]{3,31}$/.test(raw)) return `@${raw}`;
  return raw;
};

export const handleContact = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errList = errors.array().map((e) => ({
        path: e.path || e.param,
        msg: e.msg
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errList
      });
    }

    const { name, contactMethod, contactValue, message, captcha } = req.body;

    const captchaAnswer = getCaptchaAnswer();
    if (!captchaAnswer) {
      console.error('[contact] CONTACT_CAPTCHA_ANSWER не задан');
      return res.status(500).json({
        success: false,
        message: 'Form configuration is missing. Please contact administrator.'
      });
    }
    if (captcha !== captchaAnswer) {
      return res.status(400).json({
        success: false,
        message: 'CAPTCHA verification failed'
      });
    }

    if (isSpamMessage({ message })) {
      return res.status(400).json({
        success: false,
        message: 'Spam detected. Please revise your message.'
      });
    }

    const contactData = {
      name: name.trim(),
      // Валидатор уже привёл способ связи к id в нижнем регистре.
      contactMethod: METHOD_LABELS[contactMethod],
      contactValue: normalizeContact(contactMethod, contactValue ?? ''),
      message: (message ?? '').trim(),
      submitted_at: new Date().toLocaleString('en-GB', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    };

    // Сначала в БД, потом доставка: если оба канала упадут, заявка всё равно
    // останется в таблице leads.
    const savedLead = await saveLead({
      type: 'contact',
      name: contactData.name,
      contact: contactData.contactValue,
      method: contactData.contactMethod,
      message: contactData.message,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Почта — запасной канал: без SMTP-настроек заявка всё равно уходит
    // в CRM и телеграм.
    const [emailResult, telegramResult] = await Promise.allSettled([
      isEmailConfigured() ? sendContactEmail(contactData) : Promise.resolve({ skipped: true }),
      sendContactTelegramNotification(contactData)
    ]);

    if (telegramResult.status === 'fulfilled') {
      console.log('Contact telegram notification result:', telegramResult.value);
    } else {
      console.error(
        'Contact telegram notification failed:',
        telegramResult.reason?.message || telegramResult.reason,
        telegramResult.reason?.details || ''
      );
    }

    if (emailResult.status === 'rejected') {
      console.error('Contact email failed:', emailResult.reason?.message || emailResult.reason);
    }

    // Выключенный телеграм резолвится со skipped — это не доставка.
    const telegramDelivered =
      telegramResult.status === 'fulfilled' && telegramResult.value?.skipped !== true;
    const emailDelivered =
      emailResult.status === 'fulfilled' && emailResult.value?.skipped !== true;

    // Заявка сохранена в БД — значит, она не потеряна, даже если ни письмо,
    // ни телеграм не ушли. Ошибку отдаём только когда пропало всё сразу.
    const deliveryOk = emailDelivered || telegramDelivered || Boolean(savedLead);
    if (!deliveryOk) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send message. Please try again later.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message sent successfully!'
    });
  } catch (error) {
    console.error('Email sending error:', error);
    if (error.code === 'EAUTH') {
      return res.status(500).json({
        success: false,
        message: 'Email authentication failed. Please check credentials.'
      });
    }
    if (error.code === 'ECONNECTION') {
      return res.status(500).json({
        success: false,
        message: 'Email server connection failed. Please try again later.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again later.'
    });
  }
};
