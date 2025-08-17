import express from "express";
import { isAuth } from "../../middleware/auth";
import { AuthController } from "../auth/auth.controller";

const router = express.Router();

router.get("/profile", isAuth, AuthController.getUser); // GET /api/account/profile
router.patch("/change-password", isAuth, AuthController.changePassword);
router.patch("/update", isAuth, AuthController.updateAccount);
router.delete("/delete", isAuth, AuthController.softDeleteAccount);

export default router;
