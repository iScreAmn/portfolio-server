import express from 'express';
import rateLimit from 'express-rate-limit';
import { packageValidationRules } from '../validators/packageValidator.js';
import { handlePackageRequest } from '../controllers/packageController.js';

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', limiter, packageValidationRules, handlePackageRequest);

export default router;
