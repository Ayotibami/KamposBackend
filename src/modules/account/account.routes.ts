import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { changePasswordSchema } from '../../schemas/auth';
import { AccountController } from './account.controller';

const router = Router();

router.get('/profile', isAuth, AccountController.me);
router.patch('/update', isAuth, AccountController.update);
router.patch('/change-password', isAuth, validateBody(changePasswordSchema), AccountController.changePassword);
router.delete('/delete', isAuth, AccountController.delete);

export default router;
