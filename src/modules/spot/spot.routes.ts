import { Router } from "express";
import { isAuth, fakeAuth } from "../../middleware/auth";
import { requireOtpVerified } from "../../middleware/otp";
import { SpotController } from "./spot.controller";

const router = Router();

// Create (draft) + upload
router.post("/draft", isAuth, requireOtpVerified, SpotController.draft);
router.get("/:spot_id/media/signature", isAuth, SpotController.signature);
router.post("/:spot_id/finalize", isAuth, SpotController.finalize);

// List & discovery
router.get("/", fakeAuth, SpotController.list);

// Single
router.get("/:spot_id", fakeAuth, SpotController.get);
router.delete("/:spot_id", isAuth, SpotController.remove);

// Engagement
router.post("/:spot_id/report", isAuth, SpotController.report);
router.post("/:spot_id/view", fakeAuth, SpotController.view);
router.post("/:spot_id/share", fakeAuth, SpotController.share);

export default router;
