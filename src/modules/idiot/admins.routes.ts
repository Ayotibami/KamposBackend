import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { AdminsController } from './admins.controller';

const router = Router();

// King-only — no isIdiot middleware here on purpose (see admins.controller.ts).
router.get('/', isAuth, AdminsController.list);
router.post('/grant', isAuth, AdminsController.grant);
router.post('/revoke', isAuth, AdminsController.revoke);

export default router;
