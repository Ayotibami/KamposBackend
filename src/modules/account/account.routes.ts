import { Router } from "express";
import { accountController } from "./account.controller";
import { isAuth } from "../../middleware/auth";
import { validateBody, validateParams } from "../../middleware/validateSchema";
import { accountSchema, loginSchema } from "./account.schema";
import z from "zod";

const router = Router();

router.post("/register", validateBody(accountSchema), accountController.createAccount);
router.post("/login", validateBody(loginSchema), accountController.login);
router.get("/:account_id", isAuth, validateParams(z.object({ account_id: z.string().uuid() })), accountController.getAccount);
router.put("/:account_id", isAuth, validateParams(z.object({ account_id: z.string().uuid() })), validateBody(accountSchema.partial()), accountController.updateAccount);
router.delete("/:account_id", isAuth, validateParams(z.object({ account_id: z.string().uuid() })), accountController.deleteAccount);

export default router;