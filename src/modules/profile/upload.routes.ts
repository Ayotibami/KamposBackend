import { Router } from 'express';
import { isAuth } from '../../middleware/auth';
import { uploadBuffer } from '../../services/media/cloudinary';
import { pool } from '../../config/db';
import { avitagSchema } from '../../schemas/profile';
import { findByAvitag } from './utils';
import { safeErrorMessage } from '../../utils/errors';

const router = Router();

// Utility to detect which table holds the avitag
async function detectTable(avitag: string): Promise<'student_profiles'|'kreator_profiles'|'kompany_profiles'|'school_profiles'|null> {
  const checks = [
    { sql: 'SELECT 1 FROM student_profiles WHERE avitag = $1', t: 'student_profiles' as const },
    { sql: 'SELECT 1 FROM kreator_profiles WHERE avitag = $1', t: 'kreator_profiles' as const },
    { sql: 'SELECT 1 FROM kompany_profiles WHERE avitag = $1', t: 'kompany_profiles' as const },
    { sql: 'SELECT 1 FROM school_profiles WHERE avitag = $1', t: 'school_profiles' as const },
  ];
  for (const c of checks) {
    const { rowCount } = await pool.query(c.sql, [avitag]);
    if ((rowCount || 0) > 0) return c.t;
  }
  return null;
}

// POST /api/v1/profiles/upload-picture  (form-data: avitag, image)
router.post('/upload-picture', isAuth, async (req, res) => {
  const { avitag } = req.body || {};
  if (!avitag) return res.status(400).json({ success: false, message: 'avitag is required' });

  const table = await detectTable(avitag);
  if (!table) return res.status(404).json({ success: false, message: 'Profile not found' });

  // Verify ownership
  const { rowCount } = await pool.query(`SELECT 1 FROM ${table} WHERE avitag = $1 AND account_id = $2`, [avitag, req.user!.account_id]);
  if ((rowCount || 0) === 0 && req.user?.profileType !== 'IDIOT') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  if (!req.files || !('image' in req.files)) {
    return res.status(400).json({ success: false, message: 'image file is required' });
  }
  const fileAny: any = (req.files as any).image;
  const file = Array.isArray(fileAny) ? fileAny[0] : fileAny;
  const buffer: Buffer = file?.data;
  if (!buffer) return res.status(400).json({ success: false, message: 'Invalid image' });

  try {
    const uploaded: any = await uploadBuffer(buffer, `kampos/profiles/${avitag}`);
    const url: string = uploaded.secure_url || uploaded.url;

    const column = table === 'kompany_profiles' ? 'image_url' : 'image_url';
    await pool.query(`UPDATE ${table} SET ${column} = $1, updated_at = NOW() WHERE avitag = $2`, [url, avitag]);
    return res.json({ success: true, url });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: safeErrorMessage(e, 'Upload failed') });
  }
});

// POST /api/v1/profiles/avatar-preupload  (form-data: image)
// For the profile-setup wizard: uploads a picked avatar to Cloudinary
// BEFORE any profile row exists yet (unlike /upload-picture above, which
// hard-requires an existing avitag to attach the image to). Returns a plain
// URL the client can hold onto — including across a reload, since a URL is
// just a string, unlike the raw file object it replaces — and pass along
// as `image_url` when the profile is actually created at the end of setup.
router.post('/avatar-preupload', isAuth, async (req, res) => {
  if (!req.files || !('image' in req.files)) {
    return res.status(400).json({ success: false, message: 'image file is required' });
  }
  const fileAny: any = (req.files as any).image;
  const file = Array.isArray(fileAny) ? fileAny[0] : fileAny;
  const buffer: Buffer = file?.data;
  if (!buffer) return res.status(400).json({ success: false, message: 'Invalid image' });

  const mimetype: string = String(file?.mimetype || '');
  if (!mimetype.startsWith('image/')) {
    return res.status(415).json({ success: false, message: 'Only image files are allowed' });
  }
  if (buffer.length > 10 * 1024 * 1024) {
    return res.status(413).json({ success: false, message: 'Image too large (max 10MB)' });
  }

  try {
    // Scoped by account_id (not avitag — that doesn't exist yet) so
    // concurrent/repeated picks during setup don't collide with anyone else's.
    const uploaded: any = await uploadBuffer(buffer, `kampos/profiles/pending/${req.user!.account_id}`);
    const url: string = uploaded.secure_url || uploaded.url;
    return res.json({ success: true, url });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: safeErrorMessage(e, 'Upload failed') });
  }
});

// GET /api/v1/profiles/avitag-available/:avitag
// For the profile-setup wizard's live-as-you-type check. No auth required —
// same as any other "is this handle taken" lookup (nothing sensitive in the
// response). Checks across all five profile-type tables via findByAvitag,
// since avitag has to be globally unique (a student can't take a tag a
// kreator/kompany/school/idiot profile already has).
router.get('/avitag-available/:avitag', async (req, res) => {
  const parsed = avitagSchema.safeParse(req.params.avitag);
  if (!parsed.success) {
    return res.json({
      success: true,
      available: false,
      message: parsed.error.issues[0]?.message || 'Invalid Avitag',
    });
  }
  const existing = await findByAvitag(parsed.data);
  return res.json({ success: true, available: !existing });
});

export default router;
