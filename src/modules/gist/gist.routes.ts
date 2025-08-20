import { Router } from "express";
import { gistController } from "./gist.controller";
import { isAuth, requireAdmin } from "../../middleware/auth";
import { gistSchema, approveSchema } from "./gist.schema";
import { validateBody } from "../../middleware/validateSchema";

const router = Router();

router.post(
  "/create",
  isAuth,
  validateBody(gistSchema),
  gistController.createGist
);
router.get("/", gistController.getAllGists);
router.get("/:gist_id", gistController.getGistById);
router.patch(
  "/:gist_id",
  isAuth,
  validateBody(gistSchema.partial()),
  gistController.updateGist
);
router.delete("/:gist_id", isAuth, gistController.deleteGist);
router.get("/user/:avitag", gistController.getGistsByAvitag);
router.get("/trending", gistController.getTrendingGists);
router.get("/search", gistController.searchGists);
router.patch(
  "/:gist_id/approve",
  isAuth,
  requireAdmin,
  validateBody(approveSchema),
  gistController.approveGist
);
router.get(
  "/reported",
  isAuth,
  requireAdmin,
  gistController.getReportedGists
);

export default router;
