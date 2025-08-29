import express from "express";
import { restrictTo } from "../../middleware/rbac";
import { ReportController } from "./report.controller";
import { ReportSchemas } from "./report.schema";
import { validateBody } from "../../middleware/validateSchema";
import { isAuth } from "../../middleware/auth";

const router = express.Router();

router.get("/", isAuth, restrictTo("ADMIN"), ReportController.listAll);
router.get("/user/:aviTag", isAuth, ReportController.getByUser);
router.get("/gist/:gistId", isAuth, restrictTo("ADMIN"), ReportController.getByGistId);
router.get("/:reportId", isAuth, restrictTo("ADMIN"), ReportController.getById);
router.post(
  "/create",
  isAuth,
  validateBody(ReportSchemas.createReport),
  ReportController.create
);
router.patch(
  "/:reportId",
  isAuth,
  restrictTo("ADMIN"),
  validateBody(ReportSchemas.updateReport),
  ReportController.update
);
router.delete(
  "/:reportId",
  isAuth,
  restrictTo("ADMIN"),
  ReportController.delete
);

export default router;
