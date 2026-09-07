import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { isIdiot } from '../../middleware/idiot';
import { AdminProfilesController } from './profiles.controller';

const router = Router();

// Browse every profile of a given type regardless of status — any admin,
// not king-only. Per-type edit/verify/delete actions already exist under
// PUT/PATCH/DELETE /profiles/<type>/:avitag; these routes are read-only.
router.get('/students', isAuth, isIdiot, AdminProfilesController.students);
router.get('/kreators', isAuth, isIdiot, AdminProfilesController.kreators);
router.get('/kompanies', isAuth, isIdiot, AdminProfilesController.kompanies);
router.get('/schools', isAuth, isIdiot, AdminProfilesController.schools);
router.get('/idiots', isAuth, isIdiot, AdminProfilesController.idiots);
// Create a profile for someone's account — any admin. Body carries
// account_id (see profiles.controller.ts's create() doc comment for why
// this isn't a route param).
router.post('/:type', isAuth, isIdiot, AdminProfilesController.create);
// Single profile, any status — for the admin edit page. Placed after the
// 5 plural list routes above so a literal segment like "students" is never
// swallowed by this dynamic :type param (Express matches route order).
router.get('/:type/:avitag', isAuth, isIdiot, AdminProfilesController.getOne);

export default router;
