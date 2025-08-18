import express from "express";
import { isAuth } from "../../middleware/auth";
import { ViewController } from "./view.controller";
import { ViewSchemas } from "./view.schema";
import { validateBody } from "../../middleware/validateSchema";

const router = express.Router();

router.post(
  "/create",
  isAuth,
  validateBody(ViewSchemas.createView),
  ViewController.create
);
router.get("/gist/:gistId", ViewController.getByGistId);
router.get("/gist/:gistId/count", ViewController.getCountByGistId);

export default router;
