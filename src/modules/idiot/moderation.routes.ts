import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { isIdiot } from '../../middleware/idiot';
import * as gistRepo from '../gist/gist.repo';
import { pool } from '../../config/db';
import { logAudit } from '../audit/audit.repo';
import { WSGateway } from '../../ws/gateway';

const router = Router();

// List pending
router.get('/gists', isAuth, isIdiot, async (req, res) => {
  const limit = Number(req.query.limit ?? 20);
  const offset = Number(req.query.offset ?? 0);
  const data = await gistRepo.listPendingGists(limit, offset);
  res.json({ success: true, data });
});

router.get('/profiles', isAuth, isIdiot, async (req, res) => {
  const limit = Number(req.query.limit ?? 20);
  const offset = Number(req.query.offset ?? 0);
  const { rows } = await pool.query(
    `(
      SELECT avitag, account_id, 'STUDENT' AS profile_type, created_at FROM student_profiles WHERE is_verified = FALSE AND profile_status = 'ACTIVE'
    ) UNION ALL (
      SELECT avitag, account_id, 'KREATOR' AS profile_type, joined_at AS created_at FROM kreator_profiles WHERE is_verified = FALSE AND profile_status = 'ACTIVE'
    ) UNION ALL (
      SELECT avitag, account_id, 'KOMPANY' AS profile_type, created_at FROM kompany_profiles WHERE is_verified = FALSE AND profile_status = 'ACTIVE'
    ) UNION ALL (
      SELECT avitag, account_id, 'SCHOOL' AS profile_type, created_at FROM school_profiles WHERE is_verified = FALSE AND profile_status = 'ACTIVE'
    )
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  res.json({ success: true, data: rows });
});

// Approve/Reject gists
router.post('/gists/:id/approve', isAuth, isIdiot, async (req, res) => {
  const id = req.params.id;
  const updated = await gistRepo.approveGist(id);
  if (!updated) return res.status(404).json({ success: false, message: 'Gist not found' });
  if (!req.user?.avitag) {
    return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
  }
  await logAudit({ action: 'GIST_APPROVE', target_type: 'GIST', target_id: id, idiot_avitag: req.user.avitag });
  // Broadcast to global feed
  WSGateway.broadcast('feed.global', { type: 'GIST_APPROVED', gist: updated });
  res.json({ success: true, data: updated });
});

router.post('/gists/:id/reject', isAuth, isIdiot, async (req, res) => {
  const id = req.params.id;
  const { reason } = req.body || {};
  const updated = await gistRepo.rejectGist(id);
  if (!updated) return res.status(404).json({ success: false, message: 'Gist not found' });
  if (!req.user?.avitag) {
    return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
  }
  await logAudit({ action: 'GIST_REJECT', target_type: 'GIST', target_id: id, idiot_avitag: req.user.avitag, reason: reason ?? null });
  res.json({ success: true, data: updated });
});

// Verify/Reject profiles
router.post('/profiles/:avitag/verify', isAuth, isIdiot, async (req, res) => {
  const avitag = req.params.avitag;
  // Try update in each subtype until one matches
  const tables = [
    'student_profiles',
    'kreator_profiles',
    'kompany_profiles',
    'school_profiles',
  ];
  let success = false;
  for (const t of tables) {
    const { rowCount } = await pool.query(`UPDATE ${t} SET is_verified = TRUE, updated_at = NOW() WHERE avitag = $1`, [avitag]);
    if ((rowCount || 0) > 0) { success = true; break; }
  }
  if (!success) return res.status(404).json({ success: false, message: 'Profile not found' });
  if (!req.user?.avitag) {
    return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
  }
  await logAudit({ action: 'PROFILE_VERIFY', target_type: 'PROFILE', target_id: avitag, idiot_avitag: req.user.avitag });
  res.json({ success: true, message: 'Profile verified' });
});

router.post('/profiles/:avitag/reject', isAuth, isIdiot, async (req, res) => {
  const avitag = req.params.avitag;
  const { reason } = req.body || {};
  // For now we log rejection; future could soft-delete or flag.
  if (!req.user?.avitag) {
    return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
  }
  await logAudit({ action: 'PROFILE_REJECT', target_type: 'PROFILE', target_id: avitag, idiot_avitag: req.user.avitag, reason: reason ?? null });
  res.json({ success: true, message: 'Profile rejection logged' });
});

export default router;
