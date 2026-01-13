import { Router } from 'express';
import { isAuth, fakeAuth } from '../../middleware/auth';
import { RegistrationController } from './registration.controller';
const router = Router();
router.post('/', isAuth, RegistrationController.register);
router.get('/event/:event_id', fakeAuth, RegistrationController.listByEvent);
router.get('/student/:avitag', fakeAuth, RegistrationController.listByStudent);
router.delete('/:id', isAuth, RegistrationController.unregister);
export default router;
