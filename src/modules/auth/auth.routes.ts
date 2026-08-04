import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';
import { OTPController } from './otp.controller';
import { PasswordResetController } from './password-reset.controller';
import { isAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { OAuthController } from './oauth.controller';
import { googleOAuthSchema, facebookOAuthSchema, appleOAuthSchema } from '../../schemas/auth';

const router = Router();

// Keyed by IP + the email in the request body, so one abusive IP can't burn
// through the limit for every email address, and one targeted email can't
// be spammed from a single IP either. 3 requests per 10 minutes each.
const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${(req.body?.email || '').toLowerCase()}`,
  message: { success: false, message: 'Too many code requests — abeg wait small before you try again.' },
});

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', isAuth, AuthController.logout);
router.post('/switch-profile', isAuth, AuthController.switchProfile);

// OTP and password reset
router.post('/verify-otp/send', otpSendLimiter, OTPController.send);
router.post('/verify-otp', OTPController.verify);
router.post('/forgot-password', otpSendLimiter, PasswordResetController.request);
router.post('/reset-password', PasswordResetController.reset);

// OAuth
router.post('/oauth/google', validateBody(googleOAuthSchema), OAuthController.google);
router.post('/oauth/facebook', validateBody(facebookOAuthSchema), OAuthController.facebook);
router.post('/oauth/apple', validateBody(appleOAuthSchema), OAuthController.apple);

export default router;
