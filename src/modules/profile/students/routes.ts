import { Router } from 'express';
import { isAuth } from '../../../middleware/auth';
import { isIdiot } from '../../../middleware/idiot';
import * as ctrl from './student.controller';
import { validateBody } from '../../../middleware/validate';
import { studentCreateSchema } from '../../../schemas/profile';

const router = Router();

router.post('/', isAuth, validateBody(studentCreateSchema), ctrl.create);
router.get('/', ctrl.list);
router.get('/:avitag', ctrl.get);
router.put('/:avitag', isAuth, ctrl.update);
router.patch('/:avitag/verify', isAuth, isIdiot, ctrl.verify);
router.patch('/:avitag/unverify', isAuth, isIdiot, ctrl.unverify);
router.patch('/:avitag/ban', isAuth, isIdiot, ctrl.ban);
router.patch('/:avitag/unban', isAuth, isIdiot, ctrl.unban);
router.patch('/:avitag/deactivate', isAuth, ctrl.deactivate);
router.patch('/:avitag/reactivate', isAuth, ctrl.reactivate);
// Not isIdiot-gated on purpose — either the owner or an admin can delete
// (see student.controller.ts's remove(), which checks ownership/admin
// itself, same pattern update() above already uses).
router.delete('/:avitag/delete', isAuth, ctrl.remove);

export default router;
