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

// Creators endpoints
router.post("/creators", isAuth, ProfileController.createCreator);
router.get("/creators/:avitag", ProfileController.getCreator);
router.get("/creators", ProfileController.listCreators);
router.put("/creators/:avitag", isAuth, ProfileController.updateCreator);
router.patch(
  "/creators/:avitag/verify",
  isAuth,
  restrictTo("ADMIN"),
  ProfileController.verifyCreator
);
router.delete(
  "/creators/:avitag",
  isAuth,
  restrictTo("ADMIN"),
  ProfileController.deleteCreator
);

// Kompanies endpoints
router.post("/kompanies", isAuth, ProfileController.createKompany);
router.get("/kompanies/:avitag", ProfileController.getKompany);
router.get("/kompanies", ProfileController.listKompanies);
router.put("/kompanies/:avitag", isAuth, ProfileController.updateKompany);
router.patch(
  "/kompanies/:avitag/verify",
  isAuth,
  restrictTo("ADMIN"),
  ProfileController.verifyKompany
);
router.delete(
  "/kompanies/:avitag",
  isAuth,
  restrictTo("ADMIN"),
  ProfileController.deleteKompany
);

// Schools endpoints
router.post("/schools", isAuth, ProfileController.createSchool);
router.get("/schools/:avitag", ProfileController.getSchool);
router.get("/schools", ProfileController.listSchools);
router.put("/schools/:avitag", isAuth, ProfileController.updateSchool);
router.patch(
  "/schools/:avitag/verify",
  isAuth,
  restrictTo("ADMIN"),
  ProfileController.verifySchool
);
router.delete(
  "/schools/:avitag",
  isAuth,
  restrictTo("ADMIN"),
  ProfileController.deleteSchool
);

// Admins endpoints
router.post("/admins", isAuth, restrictTo("SUPER_ADMIN"), ProfileController.createAdmin);
router.get("/admins/:avitag", isAuth, restrictTo("ADMIN"), ProfileController.getAdmin);
router.get("/admins", isAuth, restrictTo("ADMIN"), ProfileController.listAdmins);
router.put("/admins/:avitag", isAuth, restrictTo("SUPER_ADMIN"), ProfileController.updateAdmin);
router.patch(
  "/admins/:avitag/verify",
  isAuth,
  restrictTo("SUPER_ADMIN"),
  ProfileController.verifyAdmin
);
router.delete(
  "/admins/:avitag",
  isAuth,
  restrictTo("SUPER_ADMIN"),
  ProfileController.deleteAdmin
);

export default router;
