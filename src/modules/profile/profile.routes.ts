import express from "express";
import { isAuth } from "../../middleware/auth";
import { restrictTo } from "../../middleware/rbac";
import { ProfileController } from "./profile.controller";

const router = express.Router();

// Students endpoints
router.post("/students", isAuth, ProfileController.createStudent);
router.get("/students/:avitag", ProfileController.getStudent);
router.get("/students", ProfileController.listStudents);
router.put("/students/:avitag", isAuth, ProfileController.updateStudent);
router.patch(
  "/students/:avitag/verify",
  isAuth,
  restrictTo("ADMIN"),
  ProfileController.verifyStudent
);
router.delete(
  "/students/:avitag",
  isAuth,
  restrictTo("ADMIN"),
  ProfileController.deleteStudent
);

export default router;
