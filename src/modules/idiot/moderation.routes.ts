import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { isIdiot } from '../../middleware/idiot';
import * as gistRepo from '../gist/gist.repo';
import * as profileRepo from '../profile/profile.repo';
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
  const data = await profileRepo.listPendingProfiles(limit, offset);
  res.json({ success: true, data });
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
  const updated = await profileRepo.verifyProfile(avitag);
  if (!updated) return res.status(404).json({ success: false, message: 'Profile not found' });
  if (!req.user?.avitag) {
    return res.status(400).json({ success: false, message: 'Active profile (avitag) is required. Switch profile and retry.' });
  }
  await logAudit({ action: 'PROFILE_VERIFY', target_type: 'PROFILE', target_id: avitag, idiot_avitag: req.user.avitag });
  res.json({ success: true, data: updated });
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
