import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { isIdiot } from '../../middleware/idiot';
import { UsersController } from './users.controller';

const router = Router();

router.get('/', isAuth, isIdiot, UsersController.search);
router.get('/:account_id', isAuth, isIdiot, UsersController.detail);
router.post('/', isAuth, isIdiot, UsersController.create);
// King-only — no isIdiot middleware here on purpose (see users.controller.ts).
router.patch('/:account_id/email', isAuth, UsersController.updateEmail);
router.patch('/:account_id/status', isAuth, isIdiot, UsersController.updateStatus);
router.post('/:account_id/email', isAuth, isIdiot, UsersController.sendMessage);

export default router;
