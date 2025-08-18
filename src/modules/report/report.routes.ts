import express from "express";
import { restrictTo } from "../../middleware/rbac";
import { ReportController } from "./report.controller";
import { ReportSchemas } from "./report.schema";
import { validateBody } from "../../middleware/validateSchema";
import { isAuth } from "../../middleware/auth";

const router = express.Router();

router.post(
  "/create",
  isAuth,
  validateBody(ReportSchemas.createReport),
  ReportController.create
);
router.get("/:reportId", isAuth, restrictTo("ADMIN"), ReportController.getById);
router.get(
  "/gist/:gistId",
  isAuth,
  restrictTo("ADMIN"),
  ReportController.getByGistId
);
router.patch(
  "/:reportId",
  isAuth,
  restrictTo("ADMIN"),
  validateBody(ReportSchemas.updateReport),
  ReportController.update
);

export default router;
