import express from "express";
import { isAuth } from "../../middleware/auth";
import { MediaController } from "./media.controller";
import { MediaSchemas } from "./media.schema";
import { validateBody } from "../../middleware/validateSchema";

const router = express.Router();

router.post(
  "/upload",
  isAuth,
  validateBody(MediaSchemas.uploadMedia),
  MediaController.upload
);
router.get("/:mediaId", MediaController.getById);
router.get("/entity/:entityType/:entityId", MediaController.getByEntity);
router.patch(
  "/:mediaId",
  isAuth,
  validateBody(MediaSchemas.updateMedia),
  MediaController.update
);
router.delete("/:mediaId", isAuth, MediaController.delete);

export default router;
