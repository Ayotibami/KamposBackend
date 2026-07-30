import { Router } from 'express';
import { isAuth, fakeAuth } from '../../middleware/auth';
import { requireOtpVerified } from '../../middleware/otp';
import { GistController } from './gist.controller';
import { validateBody } from '../../middleware/validate';
import { createGistSchema, updateGistSchema } from '../../schemas/gist';
import { reorderGistMediaSchema, updateGistMediaSchema } from '../../schemas/gist_media';
import { GistMediaController } from './media.controller';

const router = Router();

// Create
router.post('/', isAuth, requireOtpVerified, validateBody(createGistSchema), GistController.create);

// List & discovery
router.get('/', fakeAuth, GistController.list);
router.get('/trending', fakeAuth, GistController.trending);
router.get('/search', fakeAuth, GistController.search);
router.get('/user/:avitag', fakeAuth, GistController.byUser);
router.get('/approved', fakeAuth, GistController.list);

// Single
router.get('/:gist_id/counts', GistController.counts);
router.get('/:gist_id', fakeAuth, GistController.get);
router.patch('/:gist_id', isAuth, requireOtpVerified, validateBody(updateGistSchema), GistController.update);
router.delete('/:gist_id', isAuth, GistController.remove);

// Engagement
router.post('/:gist_id/report', isAuth, requireOtpVerified, GistController.report);
router.post('/:gist_id/view', GistController.view);

// Media — list/upload/attach-by-url/update/reorder/delete. These were
// previously only defined in media.routes.ts, which was never actually
// mounted in app.ts (only this file, gist.routes.ts, is) — so every one of
// these except reorder was a live 404 until now.
router.get('/:gist_id/media', fakeAuth, GistMediaController.list);
router.post('/:gist_id/media', isAuth, GistMediaController.upload);
router.post('/:gist_id/media/url', isAuth, GistMediaController.attachByUrl);
router.patch('/:gist_id/media/reorder', isAuth, validateBody(reorderGistMediaSchema), GistMediaController.reorder);
router.patch('/media/:media_id', isAuth, validateBody(updateGistMediaSchema), GistMediaController.update);
router.delete('/media/:media_id', isAuth, GistMediaController.remove);

export default router;
