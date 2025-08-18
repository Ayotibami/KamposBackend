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
router.get("/:gistId", GistController.getById);
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
router.get("/trending", GistController.getTrending);
router.get(
  "/search",
  validateQuery(GistSchemas.searchGists),
  GistController.search
);

export default router;
