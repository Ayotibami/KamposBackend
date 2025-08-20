import express from "express";
import rateLimit from "express-rate-limit";
import { isAuth } from "../../middleware/auth";
import { AuthController } from "./auth.controller";
import { AuthSchemas } from "./auth.schema";
import { validateBody } from "../../middleware/validateSchema";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many requests, please try again later." },
});

router.use(limiter);

router.post(
  "/signup",
  validateBody(AuthSchemas.register),
  AuthController.register
);
router.post("/signin", validateBody(AuthSchemas.login), AuthController.login);

// Spec-compliant aliases
router.post("/register", validateBody(AuthSchemas.register), AuthController.register);
router.post("/login", validateBody(AuthSchemas.login), AuthController.login);

// refresh
router.post("/refresh", AuthController.refreshToken); // Controller method to implement below

// logout
router.post("/logout", isAuth, AuthController.logout);

// oauth callback endpoints (server-side handlers for Google/Fb/Apple)
router.post("/oauth/:provider", AuthController.oauthHandler); // provider: google|facebook|apple

// otp flows
router.post(
  "/send-otp",
  validateBody(AuthSchemas.sendOTP),
  AuthController.sendOTP
);
router.post(
  "/verify-otp",
  validateBody(AuthSchemas.verifyOTP),
  AuthController.verifyOTP
);
router.post(
  "/forgot-password",
  validateBody(AuthSchemas.forgotPassword),
  AuthController.forgotPassword
);
router.post(
  "/reset-password",
  validateBody(AuthSchemas.resetPassword),
  AuthController.resetPassword
);

// Account-related endpoints per spec
router.get("/account/profile", isAuth, AuthController.getUser);
router.patch("/account/update", isAuth, AuthController.updateAccount);
router.patch(
  "/account/change-password",
  isAuth,
  AuthController.changePassword
);
router.delete("/account/delete", isAuth, AuthController.softDeleteAccount);

export default router;
