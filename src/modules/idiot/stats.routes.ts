import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { isIdiot } from '../../middleware/idiot';
import { StatsController } from './stats.controller';

const router = Router();

router.get('/hq', isAuth, isIdiot, StatsController.hq);

export default router;
