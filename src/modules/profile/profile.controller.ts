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
}
