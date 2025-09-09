import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { ProfileController } from './profile.controller';

const router = Router();

// Create a profile (hidden until verified by IDIOT)
router.post('/', isAuth, ProfileController.create);

// List my profiles (including unverified)
router.get('/me', isAuth, ProfileController.meProfiles);

// Get a verified profile by avitag (public)
router.get('/:avitag', ProfileController.getByAvitag);

export default router;
