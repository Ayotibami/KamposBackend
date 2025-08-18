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
router.delete("/:reactionId", isAuth, ReactionController.delete);

export default router;
