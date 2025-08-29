import pool from "../../config/connectDB";
import type { IProfile } from "./profile.interface";

// Map a union row to IProfile. Some columns exist only on certain profile tables.
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
  profilePictureUrl: r.profile_picture_url ?? r.profile_image ?? r.logo_url,
  isVerified: r.is_verified,
  socialLinks: r.social_links ?? undefined,
  engagementScore: r.engagement_score ?? undefined,
  earningsBalance: r.earnings_balance ?? undefined,
  monetizationEnabled: r.monetization_enabled ?? undefined,
  topGistId: r.top_gist_id ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const unionSelectBase = `
  SELECT avitag, account_id, display_name, NULL::varchar as first_name, NULL::varchar as last_name,
         'KOMPANY'::varchar as profile_type, NULL::varchar as campus_tag, NULL::varchar as major_tag,
         NULL::varchar as degree, NULL::varchar as level, description as bio,
         logo_url as profile_picture_url, is_verified, social_links, NULL::float8 as engagement_score,
         NULL::float8 as earnings_balance, NULL::bool as monetization_enabled, NULL::uuid as top_gist_id,
         created_at, updated_at
  FROM kompany_profiles
  UNION ALL
  SELECT avitag, account_id, display_name, NULL, NULL,
         'SCHOOL', campus_tag, NULL, NULL, NULL, description as bio,
         logo_url as profile_picture_url, is_verified, NULL::jsonb as social_links, NULL::float8,
         NULL::float8, NULL::bool, NULL::uuid, created_at, updated_at
  FROM school_profiles
  UNION ALL
  SELECT avitag, account_id, display_name, NULL, NULL,
         'CREATOR', campus_tag, NULL, NULL, NULL, description as bio,
         profile_image as profile_picture_url, is_verified, NULL::jsonb as social_links,
         engagement_score, earnings_balance, monetization_enabled, top_gist_id, created_at, updated_at
  FROM creator_profiles
  UNION ALL
  SELECT avitag, account_id, NULL as display_name, first_name, last_name,
         'STUDENT', campus_tag, major_tag, degree, level, bio,
         profile_picture_url, is_verified, NULL::jsonb as social_links,
         NULL::float8, NULL::float8, NULL::bool, NULL::uuid, created_at, updated_at
  FROM student_profiles
  UNION ALL
  SELECT avitag, account_id, NULL as display_name, NULL as first_name, NULL as last_name,
         'ADMIN', NULL as campus_tag, NULL as major_tag, NULL as degree, NULL as level, description as bio,
         profile_image as profile_picture_url, is_verified, permissions as social_links,
         NULL::float8, NULL::float8, NULL::bool, NULL::uuid, created_at, updated_at
  FROM admin_profiles
`;

const detectTableByType = (type?: string): string => {
  switch (type) {
    case "STUDENT":
      return "student_profiles";
    case "CREATOR":
      return "creator_profiles";
    case "ADMIN":
      return "admin_profiles";
    case "KOMPANY":
      return "kompany_profiles";
    case "SCHOOL":
      return "school_profiles";
    default:
      return "student_profiles";
  }
};

export const createProfile = async (
  p: Partial<IProfile>
): Promise<IProfile> => {
  const table = detectTableByType(p.profileType);
  // Generate avitag if not provided: simple slug + random
  const avitag =
    p.avitag ||
    (p.displayName || p.firstName || "user")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 7);

  let query = "";
  let values: any[] = [];

  if (table === "student_profiles") {
    query = `INSERT INTO student_profiles
      (avitag, account_id, first_name, last_name, campus_tag, hobbies, degree, major_tag, bio, level, is_verified, profile_picture_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`;
    values = [
      avitag,
      p.accountId,
      p.firstName ?? "",
      p.lastName ?? "",
      p.campusTag ?? null,
      null,
      p.degree ?? null,
      p.majorTag ?? null,
      p.bio ?? null,
      p.level ?? null,
      p.isVerified ?? false,
      p.profilePictureUrl ?? null,
    ];
  } else if (table === "creator_profiles") {
    query = `INSERT INTO creator_profiles
      (avitag, account_id, display_name, description, campus_tag, profile_image, engagement_score, earnings_balance, monetization_enabled, top_gist_id, is_verified)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`;
    values = [
      avitag,
      p.accountId,
      p.displayName ?? "",
      p.bio ?? null,
      p.campusTag ?? null,
      p.profilePictureUrl ?? null,
      p.engagementScore ?? null,
      p.earningsBalance ?? 0,
      p.monetizationEnabled ?? false,
      p.topGistId ?? null,
      p.isVerified ?? false,
    ];
  } else if (table === "kompany_profiles") {
    query = `INSERT INTO kompany_profiles
      (avitag, account_id, display_name, email, phone_number, description, logo_url, website, social_links, is_verified)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`;
    values = [
      avitag,
      p.accountId,
      p.displayName ?? "",
      (p as any).email ?? "",
      (p as any).phoneNumber ?? "",
      p.bio ?? null,
      p.profilePictureUrl ?? "",
      (p as any).website ?? "",
      p.socialLinks ? JSON.stringify(p.socialLinks) : null,
      p.isVerified ?? false,
    ];
  } else if (table === "school_profiles") {
    query = `INSERT INTO school_profiles
      (avitag, account_id, display_name, description, campus_tag, logo_url, website, is_verified)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
    values = [
      avitag,
      p.accountId,
      p.displayName ?? "",
      p.bio ?? null,
      p.campusTag ?? null,
      p.profilePictureUrl ?? null,
      (p as any).website ?? null,
      p.isVerified ?? false,
    ];
  } else if (table === "admin_profiles") {
    query = `INSERT INTO admin_profiles
      (avitag, account_id, full_name, description, profile_image, role, permissions, is_verified)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
    values = [
      avitag,
      p.accountId,
      p.displayName ??
        (p.firstName ? `${p.firstName} ${p.lastName ?? ""}`.trim() : "Admin"),
      p.bio ?? null,
      p.profilePictureUrl ?? null,
      (p as any).role ?? "CONTENT_REVIEWER",
      (p as any).permissions ? JSON.stringify((p as any).permissions) : null,
      p.isVerified ?? true,
    ];
  }

  const { rows } = await pool.query(query, values);
  const created = mapRow(rows[0]);
  created.profileType = (p.profileType as any) || created.profileType;
  return created;
};

export const findProfileByAvitag = async (
  avitag: string
): Promise<IProfile | null> => {
  const { rows } = await pool.query(
    `SELECT * FROM (${unionSelectBase}) u WHERE avitag = $1 LIMIT 1`,
    [avitag]
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const findProfileByAccountId = async (
  accountId: string
): Promise<IProfile | null> => {
  const { rows } = await pool.query(
    `SELECT * FROM (${unionSelectBase}) u WHERE account_id = $1 LIMIT 1`,
    [accountId]
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const updateProfileByAvitag = async (
  avitag: string,
  updates: Partial<IProfile>
): Promise<IProfile | null> => {
  // detect which table contains this avitag
  const tables = [
    "student_profiles",
    "creator_profiles",
    "admin_profiles",
    "kompany_profiles",
    "school_profiles",
  ];
  let table: string | null = null;
  for (const t of tables) {
    const { rows } = await pool.query(`SELECT 1 FROM ${t} WHERE avitag = $1`, [
      avitag,
    ]);
    if (rows.length) {
      table = t;
      break;
    }
  }
  if (!table) return null;

  // Build SET clause depending on table
  const set: string[] = [];
  const vals: any[] = [];
  let idx = 1;
  const push = (col: string, val: any) => {
    set.push(`${col} = $${idx++}`);
    vals.push(val);
  };

  if (table === "student_profiles") {
    if (updates.firstName !== undefined) push("first_name", updates.firstName);
    if (updates.lastName !== undefined) push("last_name", updates.lastName);
    if (updates.campusTag !== undefined) push("campus_tag", updates.campusTag);
    if (updates.majorTag !== undefined) push("major_tag", updates.majorTag);
    if (updates.degree !== undefined) push("degree", updates.degree);
    if (updates.level !== undefined) push("level", updates.level);
    if (updates.bio !== undefined) push("bio", updates.bio);
    if (updates.profilePictureUrl !== undefined)
      push("profile_picture_url", updates.profilePictureUrl);
    if (updates.isVerified !== undefined)
      push("is_verified", updates.isVerified);
  } else if (table === "creator_profiles") {
    if (updates.displayName !== undefined)
      push("display_name", updates.displayName);
    if (updates.bio !== undefined) push("description", updates.bio);
    if (updates.campusTag !== undefined) push("campus_tag", updates.campusTag);
    if (updates.profilePictureUrl !== undefined)
      push("profile_image", updates.profilePictureUrl);
    if (updates.engagementScore !== undefined)
      push("engagement_score", updates.engagementScore);
    if (updates.earningsBalance !== undefined)
      push("earnings_balance", updates.earningsBalance);
    if (updates.monetizationEnabled !== undefined)
      push("monetization_enabled", updates.monetizationEnabled);
    if (updates.topGistId !== undefined) push("top_gist_id", updates.topGistId);
    if (updates.isVerified !== undefined)
      push("is_verified", updates.isVerified);
  } else if (table === "kompany_profiles") {
    if (updates.displayName !== undefined)
      push("display_name", updates.displayName);
    if (updates.bio !== undefined) push("description", updates.bio);
    if (updates.profilePictureUrl !== undefined)
      push("logo_url", updates.profilePictureUrl);
    if ((updates as any).email !== undefined)
      push("email", (updates as any).email);
    if ((updates as any).phoneNumber !== undefined)
      push("phone_number", (updates as any).phoneNumber);
    if ((updates as any).website !== undefined)
      push("website", (updates as any).website);
    if (updates.socialLinks !== undefined)
      push("social_links", JSON.stringify(updates.socialLinks));
    if (updates.isVerified !== undefined)
      push("is_verified", updates.isVerified);
  } else if (table === "school_profiles") {
    if (updates.displayName !== undefined)
      push("display_name", updates.displayName);
    if (updates.bio !== undefined) push("description", updates.bio);
    if (updates.campusTag !== undefined) push("campus_tag", updates.campusTag);
    if (updates.profilePictureUrl !== undefined)
      push("logo_url", updates.profilePictureUrl);
    if ((updates as any).website !== undefined)
      push("website", (updates as any).website);
    if (updates.isVerified !== undefined)
      push("is_verified", updates.isVerified);
  } else if (table === "admin_profiles") {
    if (updates.displayName !== undefined)
      push("full_name", updates.displayName);
    if (updates.bio !== undefined) push("description", updates.bio);
    if (updates.profilePictureUrl !== undefined)
      push("profile_image", updates.profilePictureUrl);
    if ((updates as any).role !== undefined)
      push("role", (updates as any).role);
    if ((updates as any).permissions !== undefined)
      push("permissions", JSON.stringify((updates as any).permissions));
    if (updates.isVerified !== undefined)
      push("is_verified", updates.isVerified);
  }

  if (!set.length) return findProfileByAvitag(avitag);
  vals.push(avitag);
  await pool.query(
    `UPDATE ${table} SET ${set.join(
      ", "
    )}, updated_at = now() WHERE avitag = $${idx}`,
    vals
  );
  return findProfileByAvitag(avitag);
};

export const findProfilesByCampusOrMajor = async (
  campusTag?: string,
  majorTag?: string
): Promise<IProfile[]> => {
  const conds: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (campusTag) {
    conds.push(`campus_tag = $${i++}`);
    vals.push(campusTag);
  }
  if (majorTag) {
    conds.push(`major_tag = $${i++}`);
    vals.push(majorTag);
  }
  if (!conds.length) return [];

  const { rows } = await pool.query(
    `SELECT * FROM (
      SELECT avitag, account_id, NULL as display_name, first_name, last_name,
             'STUDENT' as profile_type, campus_tag, major_tag, degree, level, bio,
             profile_picture_url, is_verified, NULL::jsonb as social_links, NULL::float8 as engagement_score,
             NULL::float8 as earnings_balance, NULL::bool as monetization_enabled, NULL::uuid as top_gist_id,
             created_at, updated_at
      FROM student_profiles
      UNION ALL
      SELECT avitag, account_id, display_name, NULL, NULL,
             'CREATOR', campus_tag, NULL, NULL, NULL, description as bio,
             profile_image as profile_picture_url, is_verified, NULL::jsonb, engagement_score,
             earnings_balance, monetization_enabled, top_gist_id, created_at, updated_at
      FROM creator_profiles
    ) u
    WHERE ${conds.join(" OR ")}`,
    vals
  );
  return rows.map(mapRow);
};
