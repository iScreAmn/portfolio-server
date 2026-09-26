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
