import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { isIdiot } from '../../middleware/idiot';
import { ReferenceController } from './reference.controller';

const router = Router();

// Any admin (isIdiot) — same tier as Users/Profiles CRUD, not king-gated;
// this isn't the "manage other admins" or "see everyone's activity" kind
// of sensitive. Reads stay on the existing public GET /misc/campuses and
// /misc/majors (this data was never sensitive), only writes live here.
router.post('/campuses', isAuth, isIdiot, ReferenceController.createCampus);
router.patch('/campuses/:tag', isAuth, isIdiot, ReferenceController.updateCampus);
router.delete('/campuses/:tag', isAuth, isIdiot, ReferenceController.deleteCampus);

router.post('/majors', isAuth, isIdiot, ReferenceController.createMajor);
router.patch('/majors/:tag', isAuth, isIdiot, ReferenceController.updateMajor);
router.delete('/majors/:tag', isAuth, isIdiot, ReferenceController.deleteMajor);

export default router;
