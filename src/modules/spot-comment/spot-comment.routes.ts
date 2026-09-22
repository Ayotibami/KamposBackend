import { Router } from "express";
import { isAuth, fakeAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { createSpotCommentSchema } from "../../schemas/spot_comment";
import { SpotCommentController } from "./spot-comment.controller";

const router = Router();

router.post("/", isAuth, validateBody(createSpotCommentSchema), SpotCommentController.create);
router.get("/spot/:spot_id", fakeAuth, SpotCommentController.listBySpot);
router.delete("/:comment_id", isAuth, SpotCommentController.remove);

export default router;
