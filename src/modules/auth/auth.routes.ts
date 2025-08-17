import express from "express";
import methodNotAllowed from "../../middleware/methodNotAllowed.js";
import { AuthController } from "./auth.controller.js";
import { isAuth } from "../../middleware/auth.js";
import { userSchema } from "../user/user.schema.js";
import { AuthSchemas } from "./auth.schema.js";
import { validateBody } from "../../middleware/validateSchema.js";

const router = express.Router();

router.route("/").get(isAuth, AuthController.getUser).all(methodNotAllowed);

router
  .route("/signup")
  .post(validateBody(userSchema), AuthController.register)
  .all(methodNotAllowed);

router
  .route("/signin")
  .post(validateBody(AuthSchemas.login), AuthController.login)
  .all(methodNotAllowed);

router
  .route("/send-otp")
  .post(validateBody(AuthSchemas.sendOTP), AuthController.sendOTP)
  .all(methodNotAllowed);

router
  .route("/verify-otp")
  .post(validateBody(AuthSchemas.verifyOTP), AuthController.verifyOTP)
  .all(methodNotAllowed);

router
  .route("/forgot-password")
  .post(validateBody(AuthSchemas.forgotPassword), AuthController.forgotPassword)
  .all(methodNotAllowed);

router
  .route("/reset-password")
  .post(validateBody(AuthSchemas.resetPassword), AuthController.resetPassword)
  .all(methodNotAllowed);

export default router;
