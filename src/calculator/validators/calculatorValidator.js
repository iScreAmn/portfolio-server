import { body } from 'express-validator';

export const calculatorValidationRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('contact')
    .trim()
    .notEmpty()
    .withMessage('Contact is required')
    .isLength({ min: 5, max: 100 })
    .withMessage('Contact must be between 5 and 100 characters'),
  
  body('message')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Message must not exceed 1000 characters'),
  
  body('projectType')
    .optional()
    .trim()
    .isIn(['landing', 'corporate', 'ecommerce', 'webapp'])
    .withMessage('Invalid project type'),
  
  body('goals')
    .optional()
    .isArray()
    .withMessage('Goals must be an array'),
  
  body('scope')
    .optional()
    .trim()
    .isIn(['mvp', 'medium', 'large'])
    .withMessage('Invalid scope'),
  
  body('designApproach')
    .optional()
    .trim()
    .isIn(['hasDesign', 'needDesign'])
    .withMessage('Invalid design approach'),
  
  body('features')
    .optional()
    .isArray()
    .withMessage('Features must be an array'),
  
  body('content')
    .optional()
    .trim()
    .isIn(['ready', 'needText', 'needVisual'])
    .withMessage('Invalid content option'),
  
  body('timeline')
    .optional()
    .trim()
    .isIn(['standard', 'fast', 'urgent'])
    .withMessage('Invalid timeline'),
  
  body('support')
    .optional()
    .trim()
    .isIn(['none', '1month', '3months', 'partnership'])
    .withMessage('Invalid support option'),
];

export const PACKAGE_IDS = ['starter', 'pro', 'premium'];
export const PACKAGE_CONTACT_METHODS = ['telegram', 'whatsapp', 'email'];

export const packageValidationRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('packageId')
    .trim()
    .isIn(PACKAGE_IDS)
    .withMessage('Invalid package'),

  body('packagePrice')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Invalid package price'),

  body('contactMethod')
    .trim()
    .isIn(PACKAGE_CONTACT_METHODS)
    .withMessage('Choose a valid contact method'),

  body('contact')
    .trim()
    .notEmpty()
    .withMessage('Contact is required')
    .isLength({ max: 100 })
    .withMessage('Contact must not exceed 100 characters')
    .custom((value, { req }) => {
      const method = req.body?.contactMethod;
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

  body('withSupport')
    .optional()
    .isBoolean({ strict: true })
    .withMessage('withSupport must be a boolean'),

  body('agreeToPrivacy')
    .custom((value) => value === true)
    .withMessage('You must agree to the processing of personal data'),
];
