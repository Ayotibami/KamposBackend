import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { AuditController } from './audit.controller';

const router = Router();

// King-only — no isIdiot middleware here on purpose (see
// audit.controller.ts's own doc comment, same pattern
// users.routes.ts's PATCH /:account_id/email already uses).
router.get('/', isAuth, AuditController.list);

export default router;
