import { validationResult } from 'express-validator';
import { sendCalculatorEmail } from '../services/calculatorService.js';
import { sendCalculatorTelegramNotification } from '../../telegram/services/notifications.js';
import { saveLead } from '../../leads/leadRepository.js';

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

const isEmailConfigured = () =>
  Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);

export const handleCalculator = async (req, res) => {
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

    const {
      name,
      contactMethod,
      contact,
      message,
      projectType,
      goals,
      designApproach,
      features,
      content
    } = req.body;

    const calculatorData = {
      name: name.trim(),
      contactMethod: METHOD_LABELS[contactMethod],
      contact: normalizeContact(contactMethod, contact),
      message: (message ?? '').trim(),
      projectType: projectType || '',
      goals: goals || [],
      designApproach: designApproach || '',
      features: features || [],
      content: content || '',
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

    // Сначала в БД, потом доставка: если все каналы упадут, заявка всё равно
    // останется в таблице leads и будет видна в админке.
    const savedLead = await saveLead({
      type: 'calculator',
      name: calculatorData.name,
      contact: calculatorData.contact,
      method: calculatorData.contactMethod,
      message: calculatorData.message,
      payload: {
        projectType: calculatorData.projectType,
        goals: calculatorData.goals,
        designApproach: calculatorData.designApproach,
        features: calculatorData.features,
        content: calculatorData.content
      },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Без SMTP письмо просто не шлём — заявка всё равно уходит в телеграм и админку.
    const [emailResult, telegramResult] = await Promise.allSettled([
      isEmailConfigured() ? sendCalculatorEmail(calculatorData) : Promise.resolve({ skipped: true }),
      sendCalculatorTelegramNotification(calculatorData)
    ]);

    if (telegramResult.status === 'fulfilled') {
      console.log('Calculator telegram notification result:', telegramResult.value);
    } else {
      console.error(
        'Calculator telegram notification failed:',
        telegramResult.reason?.message || telegramResult.reason,
        telegramResult.reason?.details || ''
      );
    }

    if (emailResult.status === 'rejected') {
      console.error('Calculator email failed:', emailResult.reason?.message || emailResult.reason);
    }

    // Выключенный телеграм резолвится со skipped — это не доставка.
    const telegramDelivered =
      telegramResult.status === 'fulfilled' && telegramResult.value?.skipped !== true;
    const emailDelivered =
      emailResult.status === 'fulfilled' && emailResult.value?.skipped !== true;

    // Заявка сохранена в БД — значит, она не потеряна, даже если ни письмо,
    // ни телеграм не ушли. Ошибку отдаём только когда пропало всё сразу.
    if (!savedLead && !telegramDelivered && !emailDelivered) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send message. Please try again later.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Calculator request sent successfully!'
    });
  } catch (error) {
    console.error('Calculator error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again later.'
    });
  }
};
