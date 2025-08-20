import express from "express";
import { isAuth } from "../../middleware/auth";
import { GistController } from "./gist.controller";
import { GistSchemas } from "./gist.schema";
import { validateBody, validateQuery } from "../../middleware/validateSchema";
import { restrictTo } from "../../middleware/rbac";

const router = express.Router();

router.post(
  "/create",
  isAuth,
  restrictTo("STUDENT", "KAMPOSER", "CREATOR"),
  validateBody(GistSchemas.createGist),
  GistController.create
);
router.get("/", GistController.getAll);
router.get("/approved", GistController.getAllApproved);
router.get("/:gistId", GistController.getById);
router.get("/approved/:gistId", GistController.getApprovedById);
router.patch(
  "/:gistId",
  isAuth,
  restrictTo("STUDENT", "KAMPOSER", "CREATOR"),
  validateBody(GistSchemas.updateGist),
  GistController.update
);
router.delete(
  "/:gistId",
  isAuth,
  restrictTo("STUDENT", "KAMPOSER", "CREATOR"),
  GistController.delete
);
router.get("/user/:avi_tag", GistController.getByAvitag);
router.get("/user/:avi_tag/approved", GistController.getApprovedByAvitag);
router.get("/trending", GistController.getTrending);
router.get("/trending/approved", GistController.getTrendingApproved);
router.get(
  "/search",
  validateQuery(GistSchemas.searchGists),
  GistController.search
);
router.get(
  "/search/approved",
  validateQuery(GistSchemas.searchGists),
  GistController.searchApproved
);

// Admin moderation
router.get("/pending", isAuth, restrictTo("ADMIN"), GistController.getPending);
router.patch(
  "/:gistId/approve",
  isAuth,
  restrictTo("ADMIN"),
  GistController.approve
);

export default router;
