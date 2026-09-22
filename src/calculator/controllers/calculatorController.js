import { validationResult } from 'express-validator';
import { sendCalculatorEmail } from '../services/calculatorService.js';
import { sendCalculatorTelegramNotification } from '../../telegram/services/notifications.js';
import { saveLead } from '../../leads/leadRepository.js';

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

    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({
        success: false,
        message: 'Email configuration is missing. Please contact administrator.'
      });
    }

    const {
      name,
      contact,
      message,
      projectType,
      goals,
      scope,
      designApproach,
      features,
      content,
      timeline,
      support
    } = req.body;

    const calculatorData = {
      name: name.trim(),
      contact: contact.trim(),
      message: (message ?? '').trim(),
      projectType: projectType || '',
      goals: goals || [],
      scope: scope || '',
      designApproach: designApproach || '',
      features: features || [],
      content: content || '',
      timeline: timeline || '',
      support: support || '',
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
      type: 'calculator',
      name: calculatorData.name,
      contact: calculatorData.contact,
      message: calculatorData.message,
      payload: {
        projectType: calculatorData.projectType,
        goals: calculatorData.goals,
        scope: calculatorData.scope,
        designApproach: calculatorData.designApproach,
        features: calculatorData.features,
        content: calculatorData.content,
        timeline: calculatorData.timeline,
        support: calculatorData.support
      },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    const [emailResult, telegramResult] = await Promise.allSettled([
      sendCalculatorEmail(calculatorData),
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
    const emailDelivered = emailResult.status === 'fulfilled';

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
      message: 'Calculator request sent successfully!'
    });
  } catch (error) {
    console.error('Calculator error:', error);
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
