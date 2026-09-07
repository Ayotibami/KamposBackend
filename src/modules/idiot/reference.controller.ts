import type { Request, Response } from 'express';
import * as miscRepo from '../misc/misc.repo';
import { safeAudit } from '../audit/audit.util';

// Same loose slug shape the live data already follows ("unilag", "ui",
// "cs", "pos") — lowercase, letters/digits/underscore, no spaces. Not as
// strict as schemas/profile.ts's avitagSchema (no reserved-word list, no
// leading/trailing-underscore rule) since a campus/major tag is never a
// route segment or a public handle, just an internal key.
const TAG_RE = /^[a-z0-9_]{2,24}$/;

function normalizeTag(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const tag = raw.trim().toLowerCase();
  return TAG_RE.test(tag) ? tag : null;
}

function normalizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  return name.length > 0 && name.length <= 120 ? name : null;
}

export const ReferenceController = {
  // POST /idiot/reference/campuses — any admin. Tag is set here and
  // never again (see misc.repo.ts's own doc comment on why renaming one
  // later isn't safe given how inconsistently campus_tag is stored across
  // the schema).
  createCampus: async (req: Request, res: Response) => {
    const tag = normalizeTag(req.body?.campus_tag);
    const name = normalizeName(req.body?.campus_name);
    if (!tag) return res.status(400).json({ success: false, message: 'campus_tag must be 2-24 lowercase letters, digits, or underscores' });
    if (!name) return res.status(400).json({ success: false, message: 'campus_name is required' });
    try {
      const campus = await miscRepo.createCampus(tag, name);
      await safeAudit({ action: 'REFERENCE_CREATE', target_type: 'CAMPUS', target_id: tag, idiot_avitag: req.user!.avitag ?? req.user!.account_id, reason: name });
      return res.status(201).json({ success: true, data: campus });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ success: false, message: 'A campus with this tag already exists' });
      return res.status(500).json({ success: false, message: 'Failed to create campus' });
    }
  },

  // PATCH /idiot/reference/campuses/:tag — name only, tag itself is
  // immutable (see createCampus above / misc.repo.ts's doc comment).
  updateCampus: async (req: Request, res: Response) => {
    const tag = req.params.tag;
    const name = normalizeName(req.body?.campus_name);
    if (!name) return res.status(400).json({ success: false, message: 'campus_name is required' });
    const campus = await miscRepo.updateCampusName(tag, name);
    if (!campus) return res.status(404).json({ success: false, message: 'Campus not found' });
    await safeAudit({ action: 'REFERENCE_UPDATE', target_type: 'CAMPUS', target_id: tag, idiot_avitag: req.user!.avitag ?? req.user!.account_id, reason: name });
    return res.json({ success: true, data: campus });
  },

  // DELETE /idiot/reference/campuses/:tag — blocked if ANYTHING still
  // references this tag, not just what a live foreign key would catch
  // (three of the five places a campus_tag can live have no FK at all —
  // see misc.repo.ts's getCampusUsage doc comment). Checked explicitly
  // here rather than just letting a bare DELETE fail on the two tables
  // that DO have a real constraint, since that would silently succeed for
  // the other three and leave them holding a dangling value.
  deleteCampus: async (req: Request, res: Response) => {
    const tag = req.params.tag;
    const usage = await miscRepo.getCampusUsage(tag);
    if (usage.total > 0) {
      const parts = [
        usage.student_profiles && `${usage.student_profiles} student profile(s)`,
        usage.school_profiles && `${usage.school_profiles} school profile(s)`,
        usage.kreator_profiles && `${usage.kreator_profiles} kreator profile(s)`,
        usage.gists && `${usage.gists} gist(s)`,
        usage.events && `${usage.events} event(s)`,
      ].filter(Boolean);
      return res.status(409).json({
        success: false,
        message: `Can't delete — still used by ${parts.join(', ')}.`,
      });
    }
    const deletedName = await miscRepo.deleteCampus(tag);
    if (!deletedName) return res.status(404).json({ success: false, message: 'Campus not found' });
    await safeAudit({ action: 'REFERENCE_DELETE', target_type: 'CAMPUS', target_id: tag, idiot_avitag: req.user!.avitag ?? req.user!.account_id, reason: deletedName });
    return res.json({ success: true, message: 'Campus deleted' });
  },

  createMajor: async (req: Request, res: Response) => {
    const tag = normalizeTag(req.body?.major_tag);
    const name = normalizeName(req.body?.major_name);
    if (!tag) return res.status(400).json({ success: false, message: 'major_tag must be 2-24 lowercase letters, digits, or underscores' });
    if (!name) return res.status(400).json({ success: false, message: 'major_name is required' });
    try {
      const major = await miscRepo.createMajor(tag, name);
      await safeAudit({ action: 'REFERENCE_CREATE', target_type: 'MAJOR', target_id: tag, idiot_avitag: req.user!.avitag ?? req.user!.account_id, reason: name });
      return res.status(201).json({ success: true, data: major });
    } catch (err: any) {
      if (err?.code === '23505') return res.status(409).json({ success: false, message: 'A major with this tag already exists' });
      return res.status(500).json({ success: false, message: 'Failed to create major' });
    }
  },

  updateMajor: async (req: Request, res: Response) => {
    const tag = req.params.tag;
    const name = normalizeName(req.body?.major_name);
    if (!name) return res.status(400).json({ success: false, message: 'major_name is required' });
    const major = await miscRepo.updateMajorName(tag, name);
    if (!major) return res.status(404).json({ success: false, message: 'Major not found' });
    await safeAudit({ action: 'REFERENCE_UPDATE', target_type: 'MAJOR', target_id: tag, idiot_avitag: req.user!.avitag ?? req.user!.account_id, reason: name });
    return res.json({ success: true, data: major });
  },

  deleteMajor: async (req: Request, res: Response) => {
    const tag = req.params.tag;
    const usage = await miscRepo.getMajorUsage(tag);
    if (usage.total > 0) {
      const parts = [
        usage.student_profiles && `${usage.student_profiles} student profile(s)`,
        usage.gists && `${usage.gists} gist(s)`,
        usage.events && `${usage.events} event(s)`,
      ].filter(Boolean);
      return res.status(409).json({
        success: false,
        message: `Can't delete — still used by ${parts.join(', ')}.`,
      });
    }
    const deletedName = await miscRepo.deleteMajor(tag);
    if (!deletedName) return res.status(404).json({ success: false, message: 'Major not found' });
    await safeAudit({ action: 'REFERENCE_DELETE', target_type: 'MAJOR', target_id: tag, idiot_avitag: req.user!.avitag ?? req.user!.account_id, reason: deletedName });
    return res.json({ success: true, message: 'Major deleted' });
  },
};
