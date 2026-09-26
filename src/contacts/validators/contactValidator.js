import { body } from 'express-validator';

export const CONTACT_METHODS = ['telegram', 'whatsapp', 'email'];

// Старый фронт слал «Telegram»/«WhatsApp»/«Email», новый — id в нижнем регистре.
// Приводим к одному виду, чтобы обе версии формы проходили валидацию.
const toMethodId = (value) => String(value ?? '').trim().toLowerCase();

export const contactValidationRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('contactMethod')
    .customSanitizer(toMethodId)
    .isIn(CONTACT_METHODS)
    .withMessage('Choose a valid contact method'),
  body('contactValue')
    .trim()
    .notEmpty()
    .withMessage('Contact is required')
    .isLength({ max: 100 })
    .withMessage('Contact must not exceed 100 characters')
    .custom((value, { req }) => {
      const method = toMethodId(req.body?.contactMethod);
      const digits = value.replace(/\D/g, '').length;
      if (method === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new Error('Enter a valid email');
      }
      if (method === 'whatsapp' && (digits < 8 || digits > 15)) {
        throw new Error('Enter a valid phone number');
      }
      if (method === 'telegram' && !/^@?[A-Za-z][\w]{3,31}$/.test(value) && digits < 8) {
        throw new Error('Enter a Telegram username or phone number');
      }
      return true;
    }),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Message must be between 10 and 1000 characters'),
  body('agreeToPrivacy')
    .custom((value) => value === true)
    .withMessage('You must agree to the processing of personal data'),
  body('captcha')
    .notEmpty()
    .withMessage('Please complete the CAPTCHA'),
  body('honeypot')
    .optional({ values: 'falsy' })
    .isEmpty()
    .withMessage('Spam detected'),
];
