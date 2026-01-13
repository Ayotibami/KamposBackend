import { Router } from 'express';
import { isAuth, fakeAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { upsertReactionSchema } from '../../schemas/reaction';
import { ReactionController } from './reaction.controller';
const router = Router();
// Upsert
router.post('/', isAuth, validateBody(upsertReactionSchema), ReactionController.upsert);
// Read
router.get('/entity/:entity_type/:entity_id', fakeAuth, ReactionController.listByEntity);
router.get('/user/:avitag', fakeAuth, ReactionController.listByUser);
// Delete
router.delete('/:reaction_id', isAuth, ReactionController.remove);
router.delete('/entity/:entity_type/:entity_id', isAuth, ReactionController.removeByEntity);
export default router;
