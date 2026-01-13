import { Router } from 'express';
import { isAuth, fakeAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { updateGistMediaSchema } from '../../schemas/gist_media';
import { GistMediaController } from './media.controller';
const router = Router();
// List media for a gist (public)
router.get('/:gist_id/media', fakeAuth, GistMediaController.list);
// Upload new media to a gist (auth + file upload)
router.post('/:gist_id/media', isAuth, GistMediaController.upload);
// Update an existing media row (auth)
router.patch('/media/:media_id', isAuth, validateBody(updateGistMediaSchema), GistMediaController.update);
// Delete a media item (auth)
router.delete('/media/:media_id', isAuth, GistMediaController.remove);
export default router;
