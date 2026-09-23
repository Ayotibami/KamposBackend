import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { isIdiot } from '../../middleware/idiot';
import { AdminSpotsController } from './spots.controller';

const router = Router();

// Browse every Spot regardless of status — any admin, not king-only. The
// soft "Take Down" action already exists at DELETE /spots/:spot_id (see
// spot.controller.ts's remove, which branches on isAdminRole).
router.get('/', isAuth, isIdiot, AdminSpotsController.list);

// The genuine hard delete — a real DELETE, not a status flip. Deliberately
// a DIFFERENT route than the consumer-facing DELETE /spots/:spot_id (which
// stays exactly as it is, soft-only) rather than repurposing that one, so
// the already-shipped Take Down button/endpoint can't silently change
// meaning underneath it.
router.delete('/:spot_id', isAuth, isIdiot, AdminSpotsController.hardDelete);

// Undo a takedown — REJECTED back to ACTIVE only (see reactivateAsAdmin's
// own doc for why REMOVED, the poster's own self-delete, is never reversed
// this way).
router.post('/:spot_id/reactivate', isAuth, isIdiot, AdminSpotsController.reactivate);

export default router;
