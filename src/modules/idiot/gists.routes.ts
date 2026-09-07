import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { isIdiot } from '../../middleware/idiot';
import { AdminGistsController } from './gists.controller';

const router = Router();

// Browse every gist regardless of status — any admin, not king-only.
// Actions (approve/reject/delete) already exist under
// /idiot/moderation/gists/:id/{approve,reject} and DELETE /gists/:gist_id;
// this route is read-only.
router.get('/', isAuth, isIdiot, AdminGistsController.list);

export default router;
