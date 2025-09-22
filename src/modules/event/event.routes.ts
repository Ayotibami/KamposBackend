import { Router } from 'express';
import { isAuth, fakeAuth } from '../../middleware/auth';
import { EventController } from './event.controller';

const router = Router();

// Create with optional thumbnail (form-data supported)
router.post('/', isAuth, EventController.create);

// List & get
router.get('/', fakeAuth, EventController.list);
router.get('/:event_id', fakeAuth, EventController.get);

// Update & delete
router.put('/:event_id', isAuth, EventController.update);
router.delete('/:event_id', isAuth, EventController.remove);

// Views
router.post('/:event_id/view', fakeAuth, EventController.view);

export default router;
