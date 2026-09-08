import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { BroadcastController } from './broadcast.controller';

const router = Router();

// King-only, checked inside the controller itself (not via the shared
// isIdiot middleware) — same pattern admins.controller.ts uses for
// grant/revoke, since this needs to reject a plain idiot admin too.
router.get('/recipient-count', isAuth, BroadcastController.recipientCount);
router.get('/', isAuth, BroadcastController.list);
router.get('/:broadcast_id', isAuth, BroadcastController.get);
router.post('/', isAuth, BroadcastController.create);

export default router;
