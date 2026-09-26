import { validationResult } from 'express-validator';
import { sendPackageTelegramNotification } from '../../telegram/services/notifications.js';
import { saveLead } from '../../leads/leadRepository.js';

const PACKAGE_NAMES = {
  starter: 'Стандарт',
  pro: 'Комфорт',
  premium: 'Премиум'
};

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

export const handlePackageRequest = async (req, res) => {
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

    const { name, packageId, packagePrice, contactMethod, contact, withSupport } = req.body;

    const packageData = {
      name: name.trim(),
      packageName: PACKAGE_NAMES[packageId],
      packagePrice: (packagePrice ?? '').trim(),
      contactMethod: METHOD_LABELS[contactMethod],
      contact: normalizeContact(contactMethod, contact),
      withSupport: withSupport === true,
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

    const savedLead = await saveLead({
      type: 'package',
      name: packageData.name,
      contact: packageData.contact,
      method: packageData.contactMethod,
      payload: {
        package: packageData.packageName,
        price: packageData.packagePrice || null,
        support: packageData.withSupport
      },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    let telegramDelivered = false;
    try {
      const result = await sendPackageTelegramNotification(packageData);
      telegramDelivered = result?.skipped !== true;
      console.log('Package telegram notification result:', result);
    } catch (error) {
      console.error(
        'Package telegram notification failed:',
        error?.message || error,
        error?.details || ''
      );
    }

    if (!savedLead && !telegramDelivered) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send request. Please try again later.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Package request sent successfully!'
    });
  } catch (error) {
    console.error('Package request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send request. Please try again later.'
    });
  }
};
