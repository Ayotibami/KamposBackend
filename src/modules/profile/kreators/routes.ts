import { Router } from 'express';
import { isAuth } from '../../../middleware/auth';
import { isIdiot } from '../../../middleware/idiot';
import * as ctrl from './controller';
import { validateBody } from '../../../middleware/validate';
import { kreatorCreateSchema } from '../../../schemas/profile';

const router = Router();

router.post('/', isAuth, validateBody(kreatorCreateSchema), ctrl.create);
router.get('/', ctrl.list);
router.get('/:avitag', ctrl.get);
router.put('/:avitag', isAuth, ctrl.update);
router.patch('/:avitag/verify', isAuth, isIdiot, ctrl.verify);
router.patch('/:avitag/unverify', isAuth, isIdiot, ctrl.unverify);
router.patch('/:avitag/ban', isAuth, isIdiot, ctrl.ban);
router.patch('/:avitag/unban', isAuth, isIdiot, ctrl.unban);
router.patch('/:avitag/deactivate', isAuth, ctrl.deactivate);
router.patch('/:avitag/reactivate', isAuth, ctrl.reactivate);
router.delete('/:avitag/delete', isAuth, ctrl.remove);

export default router;
