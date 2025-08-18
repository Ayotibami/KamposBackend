import pool from "../../config/connectDB";
import type { IProfile } from "./profile.interface";

const mapRow = (r: any): IProfile => ({
  avitag: r.avitag,
  accountId: r.account_id,
  displayName: r.display_name,
  firstName: r.first_name,
  lastName: r.last_name,
  profileType: r.profile_type,
  campusTag: r.campus_tag,
  majorTag: r.major_tag,
  degree: r.degree,
  level: r.level,
  bio: r.bio,
  profilePictureUrl: r.profile_picture_url,
  isVerified: r.is_verified,
  socialLinks: r.social_links,
  engagementScore: r.engagement_score,
  earningsBalance: r.earnings_balance,
  monetizationEnabled: r.monetization_enabled,
  topGistId: r.top_gist_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const createProfile = async (
  p: Partial<IProfile>
): Promise<IProfile> => {
  const { rows } = await pool.query(
    `INSERT INTO profiles
     (account_id, display_name, first_name, last_name, profile_type, campus_tag, major_tag, degree, level, bio, profile_picture_url, is_verified, social_links, engagement_score, earnings_balance, monetization_enabled, top_gist_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      p.accountId ?? null,
      p.displayName ?? null,
      p.firstName ?? null,
      p.lastName ?? null,
      p.profileType ?? "STUDENT",
      p.campusTag ?? null,
      p.majorTag ?? null,
      p.degree ?? null,
      p.level ?? null,
      p.bio ?? null,
      p.profilePictureUrl ?? null,
      p.isVerified ?? false,
      p.socialLinks ? JSON.stringify(p.socialLinks) : null,
      p.engagementScore ?? 0,
      p.earningsBalance ?? 0,
      p.monetizationEnabled ?? false,
      p.topGistId ?? null,
    ]
  );
  return mapRow(rows[0]);
};

export const findProfileByAvitag = async (
  avitag: string
): Promise<IProfile | null> => {
  const { rows } = await pool.query(
    `SELECT * FROM profiles WHERE avitag = $1`,
    [avitag]
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const findProfileByAccountId = async (
  accountId: string
): Promise<IProfile | null> => {
  const { rows } = await pool.query(
    `SELECT * FROM profiles WHERE account_id = $1 LIMIT 1`,
    [accountId]
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const updateProfileByAvitag = async (
  avitag: string,
  updates: Partial<IProfile>
): Promise<IProfile | null> => {
  const set: string[] = [];
  const vals: any[] = [];
  let idx = 1;
  const mapKey = (k: string) => {
    switch (k) {
      case "displayName":
        return "display_name";
      case "firstName":
        return "first_name";
      case "lastName":
        return "last_name";
      case "profileType":
        return "profile_type";
      case "campusTag":
        return "campus_tag";
      case "majorTag":
        return "major_tag";
      case "profilePictureUrl":
        return "profile_picture_url";
      case "isVerified":
        return "is_verified";
      case "socialLinks":
        return "social_links";
      case "engagementScore":
        return "engagement_score";
      case "earningsBalance":
        return "earnings_balance";
      case "monetizationEnabled":
        return "monetization_enabled";
      case "topGistId":
        return "top_gist_id";
      default:
        return k;
    }
  };
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) continue;
    set.push(`${mapKey(k)} = $${idx++}`);
    vals.push(k === "socialLinks" ? JSON.stringify(v) : v);
  }
  if (set.length === 0) return findProfileByAvitag(avitag);
  vals.push(avitag);
  const { rows } = await pool.query(
    `UPDATE profiles SET ${set.join(
      ", "
    )}, updated_at = now() WHERE avitag = $${idx} RETURNING *`,
    vals
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const findProfilesByCampusOrMajor = async (
  campusTag?: string,
  majorTag?: string
): Promise<IProfile[]> => {
  const conditions: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (campusTag) {
    conditions.push(`campus_tag = $${idx++}`);
    vals.push(campusTag);
  }
  if (majorTag) {
    conditions.push(`major_tag = $${idx++}`);
    vals.push(majorTag);
  }
  if (conditions.length === 0) return [];

  const { rows } = await pool.query(
    `SELECT * FROM profiles WHERE ${conditions.join(" OR ")}`,
    vals
  );
  return rows.map(mapRow);
};
