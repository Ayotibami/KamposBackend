import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { requireOtpVerified } from '../../middleware/otp';
import { GistController } from './gist.controller';

const router = Router();

// Submit a gist (status SUBMITTED)
router.post('/', isAuth, requireOtpVerified, GistController.submit);

export default router;
