import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { isIdiot } from '../../middleware/idiot';
import { ModerationController } from './moderation.controller';
 

const router = Router();

// Real-time admin socket auth — see ModerationController.socketTicket's doc comment.
router.get('/socket-ticket', isAuth, isIdiot, ModerationController.socketTicket);

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

// Spot reports moderation — same shape as gist reports above, separate
// endpoints (not a shared entity-type param) since the two report kinds
// join against entirely different tables.
router.get('/spot-reports', isAuth, isIdiot, ModerationController.listPendingSpotReports);
router.post('/spot-reports/:report_id/accept', isAuth, isIdiot, ModerationController.acceptSpotReport);
router.post('/spot-reports/:report_id/reject', isAuth, isIdiot, ModerationController.rejectSpotReport);

export default router;
