import { Router } from "express";
import { profileController } from "./profile.controller";
import { isAuth, requireAdmin } from "../../middleware/auth";
import { validateBody } from "../../middleware/validateSchema";
import {
  studentSchema,
  kompanySchema,
  schoolSchema,
  creatorSchema,
  adminSchema,
} from "./profile.schema";

const router = Router();

// Student Routes
router.post(
  "/students",
  isAuth,
  validateBody(studentSchema),
  profileController.createStudentProfile
);
router.get("/students/:avitag", profileController.getProfileByAvitag);
router.get("/students", profileController.getProfilesByType);
router.put(
  "/students/:avitag",
  isAuth,
  validateBody(studentSchema.partial()),
  profileController.updateProfile
);
router.patch(
  "/students/:avitag/verify",
  isAuth,
  requireAdmin,
  profileController.verifyProfile
);
router.delete(
  "/students/:avitag",
  isAuth,
  requireAdmin,
  profileController.deleteProfile
);

// Kompany Routes
router.post(
  "/kompany",
  isAuth,
  validateBody(kompanySchema),
  profileController.createKompanyProfile
);
router.get("/kompany/:avitag", profileController.getProfileByAvitag);
router.get("/kompany", profileController.getProfilesByType);
router.put(
  "/kompany/:avitag",
  isAuth,
  validateBody(kompanySchema.partial()),
  profileController.updateProfile
);
router.patch(
  "/kompany/:avitag/verify",
  isAuth,
  requireAdmin,
  profileController.verifyProfile
);
router.delete(
  "/kompany/:avitag",
  isAuth,
  requireAdmin,
  profileController.deleteProfile
);

// School Routes
router.post(
  "/schools",
  isAuth,
  validateBody(schoolSchema),
  profileController.createSchoolProfile
);
router.get("/schools/:avitag", profileController.getProfileByAvitag);
router.get("/schools", profileController.getProfilesByType);
router.put(
  "/schools/:avitag",
  isAuth,
  validateBody(schoolSchema.partial()),
  profileController.updateProfile
);
router.patch(
  "/schools/:avitag/verify",
  isAuth,
  requireAdmin,
  profileController.verifyProfile
);
router.delete(
  "/schools/:avitag",
  isAuth,
  requireAdmin,
  profileController.deleteProfile
);

// Creator Routes
router.post(
  "/creators",
  isAuth,
  validateBody(creatorSchema),
  profileController.createCreatorProfile
);
router.get("/creators/:avitag", profileController.getProfileByAvitag);
router.get("/creators", profileController.getProfilesByType);
router.put(
  "/creators/:avitag",
  isAuth,
  validateBody(creatorSchema.partial()),
  profileController.updateProfile
);
router.patch(
  "/creators/:avitag/verify",
  isAuth,
  requireAdmin,
  profileController.verifyProfile
);
router.delete(
  "/creators/:avitag",
  isAuth,
  requireAdmin,
  profileController.deleteProfile
);

// Admin Routes
router.post(
  "/admins",
  isAuth,
  requireAdmin,
  validateBody(adminSchema),
  profileController.createAdminProfile
);
router.get(
  "/admins/:avitag",
  isAuth,
  requireAdmin,
  profileController.getProfileByAvitag
);
router.get(
  "/admins",
  isAuth,
  requireAdmin,
  profileController.getProfilesByType
);
router.put(
  "/admins/:avitag",
  isAuth,
  requireAdmin,
  validateBody(adminSchema.partial()),
  profileController.updateProfile
);
router.patch(
  "/admins/:avitag/verify",
  isAuth,
  requireAdmin,
  profileController.verifyProfile
);
router.delete(
  "/admins/:avitag",
  isAuth,
  requireAdmin,
  profileController.deleteProfile
);

export default router;
