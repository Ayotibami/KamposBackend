import type { Request, Response } from 'express';
import * as studentsRepo from '../profile/students/repo';
import * as kreatorsRepo from '../profile/kreators/repo';
import * as kompaniesRepo from '../profile/kompanies/repo';
import * as schoolsRepo from '../profile/schools/repo';
import * as idiotsRepo from '../profile/idiots/repo';
import * as accountRepo from '../account/account.repo';
import { safeAudit } from '../audit/audit.util';
import {
  adminStudentCreateSchema,
  adminKreatorCreateSchema,
  adminKompanyCreateSchema,
  adminSchoolCreateSchema,
  adminIdiotCreateSchema,
} from '../../schemas/profile';
import type { ZodSchema } from 'zod';

// profile_status is a real Postgres ENUM (profile_status) shared by every
// profile table — same 4 values everywhere. Ban/deactivate WRITES are out
// of scope for this build, but filtering/displaying by status (including
// these two values) is fine.
const VALID_STATUSES = new Set(['ACTIVE', 'DEACTIVATED', 'DELETED', 'BANNED']);

function parseStatus(req: Request): 'ACTIVE' | 'DEACTIVATED' | 'DELETED' | 'BANNED' | null {
  const raw = typeof req.query.profile_status === 'string' ? req.query.profile_status.toUpperCase() : undefined;
  return raw && VALID_STATUSES.has(raw) ? (raw as any) : null;
}

function parseIsVerified(req: Request): boolean | null {
  const raw = req.query.is_verified;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

function parseStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function parseCursor(req: Request): string | undefined {
  return typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
}

function parseLimit(req: Request): number {
  return Number(req.query.limit ?? 20);
}

const REPO_BY_TYPE: Record<string, { findByAvitag: (avitag: string) => Promise<any> }> = {
  students: studentsRepo,
  kreators: kreatorsRepo,
  kompanies: kompaniesRepo,
  schools: schoolsRepo,
  idiots: idiotsRepo,
};

// One schema per type (see schemas/profile.ts's own doc comment on why
// these are separate from the self-signup *CreateSchema they extend) —
// picked by :type the same way REPO_BY_TYPE above is, so an unknown type
// segment fails the same "unknown profile type" way for both read and
// write.
const CREATE_SCHEMA_BY_TYPE: Record<string, ZodSchema<any>> = {
  students: adminStudentCreateSchema,
  kreators: adminKreatorCreateSchema,
  kompanies: adminKompanyCreateSchema,
  schools: adminSchoolCreateSchema,
  idiots: adminIdiotCreateSchema,
};

export const AdminProfilesController = {
  // POST /idiot/profiles/:type — an admin attaching a NEW profile to
  // someone's account (any account, whether or not it already has other
  // profiles — accounts are allowed multiple profiles by design, same
  // reasoning switch-profile exists at all). Every one of the 5 self-
  // service create() controllers (students/student.controller.ts etc.)
  // hard-codes `req.user.account_id` as the owner, so there was genuinely
  // no path for an admin to create a profile for anyone but themselves —
  // this is that missing path, not a wrapper around the existing one.
  //
  // account_id comes from the request body (validated as part of each
  // admin*CreateSchema, see schemas/profile.ts), not a route param — this
  // is reached from the account-detail page, which already knows which
  // account it's creating for.
  create: async (req: Request, res: Response) => {
    const type = req.params.type;
    const schema = CREATE_SCHEMA_BY_TYPE[type];
    if (!schema) return res.status(404).json({ success: false, message: 'Unknown profile type' });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Some of that information isn't quite right — please check and try again.",
      });
    }
    const body = parsed.data as Record<string, any>;

    const target = await accountRepo.findAccountById(body.account_id);
    if (!target) return res.status(404).json({ success: false, message: 'Account not found' });

    try {
      let created: any;
      switch (type) {
        case 'students': {
          let hobbiesArr: string[] | null = null;
          if (Array.isArray(body.hobbies)) hobbiesArr = body.hobbies;
          else if (typeof body.hobbies === 'string' && body.hobbies.trim()) {
            hobbiesArr = body.hobbies.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
          created = await studentsRepo.create({
            avitag: body.avitag,
            account_id: body.account_id,
            first_name: body.first_name,
            last_name: body.last_name,
            display_name: body.display_name ?? null,
            campus_tag: body.campus_tag,
            major_tag: body.major_tag,
            level: body.level != null ? Number(body.level) : null,
            bio: body.bio ?? null,
            hobbies: hobbiesArr,
            degree: body.degree ?? null,
            image_url: body.image_url ?? null,
          });
          break;
        }
        case 'kreators':
          created = await kreatorsRepo.create({
            avitag: body.avitag,
            account_id: body.account_id,
            display_name: body.display_name,
            campustag: body.campustag ?? null,
            description: body.description ?? null,
            image_url: body.image_url ?? null,
          });
          break;
        case 'kompanies':
          created = await kompaniesRepo.create({
            avitag: body.avitag,
            account_id: body.account_id,
            display_name: body.display_name,
            email: body.email,
            phone_number: body.phone_number,
            // Same "blank, not a broken link" default self-signup's own
            // kompany create() falls back to when no photo was uploaded —
            // the column is NOT NULL, so something has to go in, and an
            // empty string is what the rest of this app's kompany-image
            // rendering already treats as "no photo" (see Avatar.tsx's own
            // null/empty-string handling).
            image_url: body.image_url ?? '',
            website: body.website,
            social_links: body.social_links ?? null,
            description: body.description ?? null,
          });
          break;
        case 'schools':
          created = await schoolsRepo.create({
            avitag: body.avitag,
            account_id: body.account_id,
            display_name: body.display_name,
            description: body.description ?? null,
            campus_tag: body.campus_tag ?? null,
            image_url: body.image_url ?? null,
            website: body.website ?? null,
          });
          break;
        case 'idiots':
          created = await idiotsRepo.create({
            avitag: body.avitag,
            account_id: body.account_id,
            display_name: body.display_name,
            description: body.description ?? null,
            image_url: body.image_url ?? null,
          });
          break;
      }
      await safeAudit({
        action: 'PROFILE_CREATE',
        target_type: 'PROFILE',
        target_id: created.avitag,
        idiot_avitag: req.user!.avitag ?? req.user!.account_id,
      });
      return res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      if (err?.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'That avitag (or display name, for a kreator) is already taken.',
        });
      }
      if (err?.code === '23503') {
        return res.status(400).json({ success: false, message: 'Invalid campus or major reference' });
      }
      return res.status(500).json({ success: false, message: 'Failed to create profile' });
    }
  },

  // GET /idiot/profiles/:type/:avitag — a single profile, ANY status. The
  // consumer-facing GET /profiles/<type>/:avitag (students/student.controller.ts's
  // `get`, and its siblings) 404s on anything that isn't ACTIVE — correct for
  // the public-facing "view a profile" use case, wrong for admin editing,
  // where a deactivated/banned profile is exactly the one an admin most
  // needs to open and fix. This calls each type's own `findByAvitag()`
  // directly (no status gate at the repo layer — that gate only ever lived
  // in the consumer controller) rather than reusing the public endpoint.
  getOne: async (req: Request, res: Response) => {
    const repo = REPO_BY_TYPE[req.params.type];
    if (!repo) return res.status(404).json({ success: false, message: 'Unknown profile type' });
    const data = await repo.findByAvitag(req.params.avitag);
    if (!data) return res.status(404).json({ success: false, message: 'Profile not found' });
    return res.json({ success: true, data });
  },

  // GET /idiot/profiles/students
  students: async (req: Request, res: Response) => {
    const levelRaw = req.query.level;
    const level = typeof levelRaw === 'string' && levelRaw.trim() !== '' && !Number.isNaN(Number(levelRaw)) ? Number(levelRaw) : null;

    const data = await studentsRepo.adminSearch({
      search: parseStr(req.query.search),
      profile_status: parseStatus(req),
      is_verified: parseIsVerified(req),
      campus_tag: parseStr(req.query.campus_tag),
      major_tag: parseStr(req.query.major_tag),
      level,
      cursor: parseCursor(req),
      limit: parseLimit(req),
    });
    return res.json({ success: true, data });
  },

  // GET /idiot/profiles/kreators
  kreators: async (req: Request, res: Response) => {
    const data = await kreatorsRepo.adminSearch({
      search: parseStr(req.query.search),
      profile_status: parseStatus(req),
      is_verified: parseIsVerified(req),
      campus_tag: parseStr(req.query.campus_tag),
      cursor: parseCursor(req),
      limit: parseLimit(req),
    });
    return res.json({ success: true, data });
  },

  // GET /idiot/profiles/kompanies
  kompanies: async (req: Request, res: Response) => {
    const data = await kompaniesRepo.adminSearch({
      search: parseStr(req.query.search),
      profile_status: parseStatus(req),
      is_verified: parseIsVerified(req),
      cursor: parseCursor(req),
      limit: parseLimit(req),
    });
    return res.json({ success: true, data });
  },

  // GET /idiot/profiles/schools
  schools: async (req: Request, res: Response) => {
    const data = await schoolsRepo.adminSearch({
      search: parseStr(req.query.search),
      profile_status: parseStatus(req),
      is_verified: parseIsVerified(req),
      campus_tag: parseStr(req.query.campus_tag),
      cursor: parseCursor(req),
      limit: parseLimit(req),
    });
    return res.json({ success: true, data });
  },

  // GET /idiot/profiles/idiots
  idiots: async (req: Request, res: Response) => {
    const data = await idiotsRepo.adminSearch({
      search: parseStr(req.query.search),
      profile_status: parseStatus(req),
      is_verified: parseIsVerified(req),
      cursor: parseCursor(req),
      limit: parseLimit(req),
    });
    return res.json({ success: true, data });
  },
};
