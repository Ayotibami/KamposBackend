import { Router } from 'express';
import { isAuth } from '../../../middleware/auth';
import { isIdiot } from '../../../middleware/idiot';
import * as ctrl from './controller';
import { validateBody } from '../../../middleware/validate';
import { kompanyCreateSchema } from '../../../schemas/profile';

const router = Router();

router.post('/', isAuth, validateBody(kompanyCreateSchema), ctrl.create);
router.get('/', ctrl.list);
router.get('/:avitag', ctrl.get);
router.put('/:avitag', isAuth, ctrl.update);
router.patch('/:avitag/verify', isIdiot, ctrl.verify);
router.delete('/:avitag/delete', isIdiot, ctrl.remove);

export default router;
