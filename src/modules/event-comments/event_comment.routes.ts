import { Router } from 'express';
import { isAuth, fakeAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { createEventCommentSchema, updateEventCommentSchema } from '../../schemas/event_comment';
import { EventCommentController } from './event_comment.controller';

const router = Router();

router.post('/', isAuth, validateBody(createEventCommentSchema), EventCommentController.create);
router.get('/event/:event_id', fakeAuth, EventCommentController.listByEvent);
router.get('/:comment_id', fakeAuth, EventCommentController.get);
router.put('/:comment_id', isAuth, validateBody(updateEventCommentSchema), EventCommentController.update);
router.delete('/:comment_id', isAuth, EventCommentController.remove);

export default router;
