import express from "express";
import { isAuth } from "../../middleware/auth";
import { CommentController } from "./comment.controller";
import { CommentSchemas } from "./comment.schema";
import { validateBody } from "../../middleware/validateSchema";

const router = express.Router();

router.post(
  "/create",
  isAuth,
  validateBody(CommentSchemas.createComment),
  CommentController.create
);
router.get("/gist/:gistId", CommentController.getByGistId);
router.delete("/:commentId", isAuth, CommentController.delete);

export default router;
