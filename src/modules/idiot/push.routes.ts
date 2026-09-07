import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { isIdiot } from '../../middleware/idiot';
import { PushController } from './push.controller';

const router = Router();

router.get('/public-key', isAuth, isIdiot, PushController.publicKey);
router.post('/subscribe', isAuth, isIdiot, PushController.subscribe);
router.post('/unsubscribe', isAuth, isIdiot, PushController.unsubscribe);

export default router;
