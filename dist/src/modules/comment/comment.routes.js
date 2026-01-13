import { Router } from 'express';
import { isAuth, fakeAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { createCommentSchema, updateCommentSchema } from '../../schemas/comment';
import { CommentController } from './comment.controller';
const router = Router();
// Create
router.post('/', isAuth, validateBody(createCommentSchema), CommentController.create);
// Read
router.get('/gist/:gist_id', fakeAuth, CommentController.listByGist);
router.get('/user/:avitag', fakeAuth, CommentController.listByUser);
router.get('/:comment_id', fakeAuth, CommentController.get);
// Update
router.put('/:comment_id', isAuth, validateBody(updateCommentSchema), CommentController.update);
// Delete
router.delete('/:comment_id', isAuth, CommentController.remove);
export default router;
