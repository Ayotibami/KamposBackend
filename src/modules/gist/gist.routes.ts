import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { GistController } from './gist.controller';

const router = Router();

// Submit a gist (status SUBMITTED)
router.post('/', isAuth, GistController.submit);

export default router;
