import type { Request, Response } from "express";
import * as profileRepo from "./profile.model";
import { ApiError, ApiSuccess } from "../../utils/responseHandler";
import type { IProfile } from "./profile.interface";
import pool from "../../config/connectDB";

export class ProfileController {
  static async createStudent(req: Request, res: Response) {
    const accountId = (req as any).user?.accountId as string | undefined;
    const body = req.body as Partial<IProfile>;
    const result = await profileRepo.createProfile({
      ...body,
      accountId: body.accountId || accountId,
      profileType: "STUDENT",
    });
    return res.status(201).json(ApiSuccess.created("Student profile created", result));
  }

  static async getStudent(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile || profile.profileType !== "STUDENT") throw ApiError.notFound("Student profile not found");
    return res.json(ApiSuccess.ok("Student profile fetched", profile));
  }

  static async listStudents(req: Request, res: Response) {
    // Basic pagination for student_profiles
    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "20", 10), 1), 100);
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(
      `SELECT *, count(*) OVER() as total_count FROM student_profiles ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0;

    const items = rows.map((r: any) => ({
      avitag: r.avitag,
      accountId: r.account_id,
      firstName: r.first_name,
      lastName: r.last_name,
      campusTag: r.campus_tag,
      majorTag: r.major_tag,
      degree: r.degree,
      level: r.level,
      bio: r.bio,
      profilePictureUrl: r.profile_picture_url,
      isVerified: r.is_verified,
      profileType: "STUDENT",
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return res.json(
      ApiSuccess.ok("Students fetched", {
        items,
        page,
        limit,
        total,
      })
    );
  }

  static async updateStudent(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const updates = req.body as Partial<IProfile>;
    const updated = await profileRepo.updateProfileByAvitag(avitag, updates);
    if (!updated) throw ApiError.notFound("Student profile not found");
    return res.json(ApiSuccess.ok("Student profile updated", updated));
  }

  static async verifyStudent(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const updated = await profileRepo.updateProfileByAvitag(avitag, { isVerified: true });
    if (!updated) throw ApiError.notFound("Student profile not found");
    return res.json(ApiSuccess.ok("Student verified", updated));
  }

  static async deleteStudent(req: Request, res: Response) {
    // Soft delete by marking is_verified false and clearing some fields (or actually delete from table if required)
    const { avitag } = req.params as { avitag: string };
    const updated = await profileRepo.updateProfileByAvitag(avitag, { isVerified: false });
    if (!updated) throw ApiError.notFound("Student profile not found");
    return res.json(ApiSuccess.ok("Student profile deactivated", updated));
  }
  
  // Creators
  static async createCreator(req: Request, res: Response) {
    const accountId = (req as any).user?.accountId as string | undefined;
    const body = req.body as Partial<IProfile>;
    const result = await profileRepo.createProfile({
      ...body,
      accountId: body.accountId || accountId,
      profileType: "CREATOR",
    });
    return res
      .status(201)
      .json(ApiSuccess.created("Creator profile created", result));
  }

  static async getCreator(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile || profile.profileType !== "CREATOR")
      throw ApiError.notFound("Creator profile not found");
    return res.json(ApiSuccess.ok("Creator profile fetched", profile));
  }

  static async listCreators(req: Request, res: Response) {
    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt((req.query.limit as string) || "20", 10), 1),
      100
    );
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(
      `SELECT *, count(*) OVER() as total_count FROM creator_profiles ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0;

    const items = rows.map((r: any) => ({
      avitag: r.avitag,
      accountId: r.account_id,
      displayName: r.display_name,
      campusTag: r.campus_tag,
      bio: r.description,
      profilePictureUrl: r.profile_image,
      isVerified: r.is_verified,
      engagementScore: r.engagement_score,
      earningsBalance: r.earnings_balance,
      monetizationEnabled: r.monetization_enabled,
      topGistId: r.top_gist_id,
      profileType: "CREATOR" as const,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return res.json(
      ApiSuccess.ok("Creators fetched", {
        items,
        page,
        limit,
        total,
      })
    );
  }

  static async updateCreator(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const updates = req.body as Partial<IProfile>;
    const updated = await profileRepo.updateProfileByAvitag(avitag, updates);
    if (!updated) throw ApiError.notFound("Creator profile not found");
    return res.json(ApiSuccess.ok("Creator profile updated", updated));
  }

  static async verifyCreator(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const updated = await profileRepo.updateProfileByAvitag(avitag, { isVerified: true });
    if (!updated) throw ApiError.notFound("Creator profile not found");
    return res.json(ApiSuccess.ok("Creator verified", updated));
  }

  static async deleteCreator(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const updated = await profileRepo.updateProfileByAvitag(avitag, { isVerified: false });
    if (!updated) throw ApiError.notFound("Creator profile not found");
    return res.json(ApiSuccess.ok("Creator profile deactivated", updated));
  }

  // Kompanies (a.k.a Kamposer organization profiles)
  static async createKompany(req: Request, res: Response) {
    const accountId = (req as any).user?.accountId as string | undefined;
    const body = req.body as Partial<IProfile> & {
      email?: string;
      phoneNumber?: string;
      website?: string;
    };
    const result = await profileRepo.createProfile({
      ...body,
      accountId: body.accountId || accountId,
      profileType: "KOMPANY",
    });
    return res
      .status(201)
      .json(ApiSuccess.created("Kompany profile created", result));
  }

  static async getKompany(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile || profile.profileType !== "KOMPANY")
      throw ApiError.notFound("Kompany profile not found");
    return res.json(ApiSuccess.ok("Kompany profile fetched", profile));
  }

  static async listKompanies(req: Request, res: Response) {
    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt((req.query.limit as string) || "20", 10), 1),
      100
    );
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(
      `SELECT *, count(*) OVER() as total_count FROM kompany_profiles ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0;

    const items = rows.map((r: any) => ({
      avitag: r.avitag,
      accountId: r.account_id,
      displayName: r.display_name,
      bio: r.description,
      profilePictureUrl: r.logo_url,
      isVerified: r.is_verified,
      socialLinks: r.social_links ?? undefined,
      profileType: "KOMPANY" as const,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      email: r.email,
      phoneNumber: r.phone_number,
      website: r.website,
    }));

    return res.json(
      ApiSuccess.ok("Kompanies fetched", {
        items,
        page,
        limit,
        total,
      })
    );
  }

  static async updateKompany(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const updates = req.body as Partial<IProfile> & {
      email?: string;
      phoneNumber?: string;
      website?: string;
    };
    const updated = await profileRepo.updateProfileByAvitag(avitag, updates);
    if (!updated) throw ApiError.notFound("Kompany profile not found");
    return res.json(ApiSuccess.ok("Kompany profile updated", updated));
  }

  static async verifyKompany(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const updated = await profileRepo.updateProfileByAvitag(avitag, { isVerified: true });
    if (!updated) throw ApiError.notFound("Kompany profile not found");
    return res.json(ApiSuccess.ok("Kompany verified", updated));
  }

  static async deleteKompany(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const updated = await profileRepo.updateProfileByAvitag(avitag, { isVerified: false });
    if (!updated) throw ApiError.notFound("Kompany profile not found");
    return res.json(ApiSuccess.ok("Kompany profile deactivated", updated));
  }

  // Schools
  static async createSchool(req: Request, res: Response) {
    const accountId = (req as any).user?.accountId as string | undefined;
    const body = req.body as Partial<IProfile>;
    const result = await profileRepo.createProfile({
      ...body,
      accountId: body.accountId || accountId,
      profileType: "SCHOOL",
    });
    return res.status(201).json(ApiSuccess.created("School profile created", result));
  }

  static async getSchool(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile || profile.profileType !== "SCHOOL")
      throw ApiError.notFound("School profile not found");
    return res.json(ApiSuccess.ok("School profile fetched", profile));
  }

  static async listSchools(req: Request, res: Response) {
    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt((req.query.limit as string) || "20", 10), 1),
      100
    );
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(
      `SELECT *, count(*) OVER() as total_count FROM school_profiles ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0;

    const items = rows.map((r: any) => ({
      avitag: r.avitag,
      accountId: r.account_id,
      displayName: r.display_name,
      bio: r.description,
      campusTag: r.campus_tag,
      profilePictureUrl: r.logo_url,
      website: r.website,
      isVerified: r.is_verified,
      profileType: "SCHOOL" as const,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return res.json(
      ApiSuccess.ok("Schools fetched", { items, page, limit, total })
    );
  }

  static async updateSchool(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const updates = req.body as Partial<IProfile>;
    const updated = await profileRepo.updateProfileByAvitag(avitag, updates);
    if (!updated) throw ApiError.notFound("School profile not found");
    return res.json(ApiSuccess.ok("School profile updated", updated));
  }

  static async verifySchool(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const updated = await profileRepo.updateProfileByAvitag(avitag, { isVerified: true });
    if (!updated) throw ApiError.notFound("School profile not found");
    return res.json(ApiSuccess.ok("School verified", updated));
  }

  static async deleteSchool(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const updated = await profileRepo.updateProfileByAvitag(avitag, { isVerified: false });
    if (!updated) throw ApiError.notFound("School profile not found");
    return res.json(ApiSuccess.ok("School profile deactivated", updated));
  }

  // Admins
  static async createAdmin(req: Request, res: Response) {
    const accountId = (req as any).user?.accountId as string | undefined;
    const body = req.body as Partial<IProfile> & { role?: string; permissions?: any };
    const result = await profileRepo.createProfile({
      ...body,
      accountId: body.accountId || accountId,
      profileType: "ADMIN",
    });
    return res.status(201).json(ApiSuccess.created("Admin profile created", result));
  }

  static async getAdmin(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const profile = await profileRepo.findProfileByAvitag(avitag);
    if (!profile || profile.profileType !== "ADMIN")
      throw ApiError.notFound("Admin profile not found");
    return res.json(ApiSuccess.ok("Admin profile fetched", profile));
  }

  static async listAdmins(req: Request, res: Response) {
    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt((req.query.limit as string) || "20", 10), 1),
      100
    );
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(
      `SELECT *, count(*) OVER() as total_count FROM admin_profiles ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0;

    const items = rows.map((r: any) => ({
      avitag: r.avitag,
      accountId: r.account_id,
      fullName: r.full_name,
      bio: r.description,
      profilePictureUrl: r.profile_image,
      role: r.role,
      permissions: r.permissions,
      isVerified: r.is_verified,
      profileType: "ADMIN" as const,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return res.json(
      ApiSuccess.ok("Admins fetched", { items, page, limit, total })
    );
  }

  static async updateAdmin(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const updates = req.body as Partial<IProfile> & { role?: string; permissions?: any };
    const updated = await profileRepo.updateProfileByAvitag(avitag, updates);
    if (!updated) throw ApiError.notFound("Admin profile not found");
    return res.json(ApiSuccess.ok("Admin profile updated", updated));
  }

  static async verifyAdmin(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const updated = await profileRepo.updateProfileByAvitag(avitag, { isVerified: true });
    if (!updated) throw ApiError.notFound("Admin profile not found");
    return res.json(ApiSuccess.ok("Admin verified", updated));
  }

  static async deleteAdmin(req: Request, res: Response) {
    const { avitag } = req.params as { avitag: string };
    const updated = await profileRepo.updateProfileByAvitag(avitag, { isVerified: false });
    if (!updated) throw ApiError.notFound("Admin profile not found");
    return res.json(ApiSuccess.ok("Admin profile deactivated", updated));
  }
}
