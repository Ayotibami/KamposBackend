import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { AccountController } from './account.controller';

const router = Router();

router.get('/profile', isAuth, AccountController.me);
router.patch('/update', isAuth, AccountController.update);
router.patch('/change-password', isAuth, AccountController.changePassword);
router.delete('/delete', isAuth, AccountController.delete);

export default router;
