import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { requireOtpVerified } from '../../middleware/otp';
import { GistController } from './gist.controller';
import { validateBody } from '../../middleware/validate';
import { createGistSchema, updateGistSchema } from '../../schemas/gist';

const router = Router();

// Create
router.post('/', isAuth, requireOtpVerified, validateBody(createGistSchema), GistController.create);

// List & discovery
router.get('/', GistController.list);
router.get('/trending', GistController.trending);
router.get('/search', GistController.search);
router.get('/user/:avitag', GistController.byUser);

// Single
router.get('/:gist_id', GistController.get);
router.patch('/:gist_id', isAuth, requireOtpVerified, validateBody(updateGistSchema), GistController.update);
router.delete('/:gist_id', isAuth, GistController.remove);

// Engagement
router.post('/:gist_id/report', isAuth, requireOtpVerified, GistController.report);
router.post('/:gist_id/view', GistController.view);

export default router;
