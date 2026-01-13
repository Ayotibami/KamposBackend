"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const otp_controller_1 = require("./otp.controller");
const password_reset_controller_1 = require("./password-reset.controller");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const oauth_controller_1 = require("./oauth.controller");
const auth_2 = require("../../schemas/auth");
const router = (0, express_1.Router)();
router.post('/register', auth_controller_1.AuthController.register);
router.post('/login', auth_controller_1.AuthController.login);
router.post('/logout', auth_controller_1.AuthController.logout);
router.post('/switch-profile', auth_1.isAuth, auth_controller_1.AuthController.switchProfile);
// OTP and password reset
router.post('/verify-otp/send', otp_controller_1.OTPController.send);
router.post('/verify-otp', otp_controller_1.OTPController.verify);
router.post('/forgot-password', password_reset_controller_1.PasswordResetController.request);
router.post('/reset-password', password_reset_controller_1.PasswordResetController.reset);
// OAuth
router.post('/oauth/google', (0, validate_1.validateBody)(auth_2.googleOAuthSchema), oauth_controller_1.OAuthController.google);
router.post('/oauth/facebook', (0, validate_1.validateBody)(auth_2.facebookOAuthSchema), oauth_controller_1.OAuthController.facebook);
router.post('/oauth/apple', (0, validate_1.validateBody)(auth_2.appleOAuthSchema), oauth_controller_1.OAuthController.apple);
exports.default = router;
