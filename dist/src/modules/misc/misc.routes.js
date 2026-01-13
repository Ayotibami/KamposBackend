import { Router } from 'express';
import * as CampusesController from './misc.controller';
const router = Router();
// GET /campuses - get all campuses
router.get('/campuses', CampusesController.getAllCampuses);
// GET /majors - get all majors
router.get('/majors', CampusesController.getAllMajors);
export default router;
