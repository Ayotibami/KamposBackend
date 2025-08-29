import express from "express";
import { isAuth } from "../../middleware/auth";
import { ReactionController } from "./reaction.controller";
import { ReactionSchemas } from "./reaction.schema";
import { validateBody } from "../../middleware/validateSchema";

const router = express.Router();

router.post(
  "/create",
  isAuth,
  validateBody(ReactionSchemas.createReaction),
  ReactionController.create
);
router.get("/entity/:entityType/:entityId", ReactionController.getByEntity);
router.get("/user/:aviTag", ReactionController.getByUser);
router.delete("/:reactionId", isAuth, ReactionController.delete);
router.delete(
  "/entity/:entityType/:entityId/user/:aviTag",
  isAuth,
  ReactionController.deleteByEntityAndUser
);

export default router;
