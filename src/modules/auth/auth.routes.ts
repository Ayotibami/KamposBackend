import { Router } from 'express';
import { AuthController } from './auth.controller';
import { OTPController } from './otp.controller';
import { PasswordResetController } from './password-reset.controller';
import { isAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { OAuthController } from './oauth.controller';
import { googleOAuthSchema, facebookOAuthSchema, appleOAuthSchema } from '../../schemas/auth';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/switch-profile', isAuth, AuthController.switchProfile);

// OTP and password reset
router.post('/verify-otp/send', OTPController.send);
router.post('/verify-otp', OTPController.verify);
router.post('/forgot-password', PasswordResetController.request);
router.post('/reset-password', PasswordResetController.reset);

// OAuth
router.post('/oauth/google', validateBody(googleOAuthSchema), OAuthController.google);
router.post('/oauth/facebook', validateBody(facebookOAuthSchema), OAuthController.facebook);
router.post('/oauth/apple', validateBody(appleOAuthSchema), OAuthController.apple);

export default router;
