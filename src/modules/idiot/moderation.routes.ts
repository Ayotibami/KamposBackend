import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { isIdiot } from '../../middleware/idiot';
import { ModerationController } from './moderation.controller';
 

const router = Router();

// List pending
router.get('/gists', isAuth, isIdiot, ModerationController.listPendingGists);

router.get('/profiles', isAuth, isIdiot, ModerationController.listPendingProfiles);

// Approve/Reject gists
router.post('/gists/:id/approve', isAuth, isIdiot, ModerationController.approveGist);

router.post('/gists/:id/reject', isAuth, isIdiot, ModerationController.rejectGist);

// Verify/Reject profiles
router.post('/profiles/:avitag/verify', isAuth, isIdiot, ModerationController.verifyProfile);

router.post('/profiles/:avitag/reject', isAuth, isIdiot, ModerationController.rejectProfile);

// Reports moderation
router.get('/reports', isAuth, isIdiot, ModerationController.listPendingReports);
router.post('/reports/:report_id/accept', isAuth, isIdiot, ModerationController.acceptReport);
router.post('/reports/:report_id/reject', isAuth, isIdiot, ModerationController.rejectReport);

export default router;
