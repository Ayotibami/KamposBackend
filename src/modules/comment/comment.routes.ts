import express from "express";
import { isAuth } from "../../middleware/auth";
import { CommentController } from "./comment.controller";
import { CommentSchemas } from "./comment.schema";
import { validateBody } from "../../middleware/validateSchema";

const router = express.Router();

router.get("/", CommentController.listAll);
router.get("/user/:aviTag", CommentController.getByUser);
router.get("/gist/:gistId", CommentController.getByGistId);
router.get("/:commentId", CommentController.getById);
router.post(
  "/create",
  isAuth,
  validateBody(CommentSchemas.createComment),
  CommentController.create
);
router.patch(
  "/:commentId",
  isAuth,
  validateBody(CommentSchemas.updateComment),
  CommentController.update
);
router.delete("/:commentId", isAuth, CommentController.delete);

export default router;
