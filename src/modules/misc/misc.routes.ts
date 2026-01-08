import { Router } from 'express';
import { pool } from '../../config/db';

const router = Router();

// GET /api/v1/misc/campuses
router.get('/campuses', async (_req, res) => {
    try {
        const result = await pool.query('SELECT campus_tag, campus_name FROM campus ORDER BY campus_name');
        return res.json({ success: true, data: result.rows });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: 'Failed to fetch campuses' });
    }
});

// GET /api/v1/misc/majors
router.get('/majors', async (_req, res) => {
    try {
        const result = await pool.query('SELECT major_tag, major_name FROM major ORDER BY major_name');
        return res.json({ success: true, data: result.rows });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: 'Failed to fetch majors' });
    }
});

export default router;
