import pool from "../../config/connectDB";
import type {
  IProfile,
  IStudentProfile,
  IKompanyProfile,
  ISchoolProfile,
  ICreatorProfile,
  IAdminProfile,
} from "./profile.interface";
import { ApiError } from "../../utils/responseHandler";

const profileTables: Record<string, string> = {
  STUDENT: "student_profiles",
  KOMPANY: "kompany_profiles",
  SCHOOL: "school_profiles",
  CREATOR: "creator_profiles",
  ADMIN: "admin_profiles",
};

export const createProfile = async (profileData: Partial<IProfile>) => {
  const { avitag, account_id, profile_type, ...specificFields } = profileData;
  const table = profileTables[profile_type!];
  if (!table) throw ApiError.badRequest("Invalid profile type");

  const fields = [
    "avitag",
    "account_id",
    ...Object.keys(specificFields),
    "profile_type",
  ];
  const placeholders = fields.map((_, index) => `$${index + 1}`).join(", ");
  const query = `
    INSERT INTO ${table} (${fields.join(", ")})
    VALUES (${placeholders})
    RETURNING *;
  `;
  const values = [
    avitag,
    account_id,
    ...Object.values(specificFields),
    profile_type,
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

export const findProfileByAvitag = async (
  avitag: string
): Promise<IProfile | null> => {
  const tables = Object.values(profileTables);
  for (const table of tables) {
    const query = `SELECT * FROM ${table} WHERE avitag = $1;`;
    const { rows } = await pool.query(query, [avitag]);
    if (rows[0]) return rows[0];
  }
  return null;
};

export const findProfileByAccountId = async (
  account_id: string
): Promise<IProfile | null> => {
  const tables = Object.values(profileTables);
  for (const table of tables) {
    const query = `SELECT * FROM ${table} WHERE account_id = $1;`;
    const { rows } = await pool.query(query, [account_id]);
    if (rows[0]) return rows[0];
  }
  return null;
};

export const updateProfile = async (
  avitag: string,
  updates: Partial<IProfile>
) => {
  const profile = await findProfileByAvitag(avitag);
  if (!profile) throw ApiError.notFound("Profile not found");

  const table = profileTables[profile.profile_type];
  const fields = Object.keys(updates).filter(
    (key) => key !== "avitag" && key !== "account_id" && key !== "profile_type"
  );
  if (fields.length === 0)
    throw ApiError.badRequest("No valid fields to update");

  const setClause = fields
    .map((field, index) => `${field} = $${index + 2}`)
    .join(", ");
  const query = `
    UPDATE ${table}
    SET ${setClause}, updated_at = CURRENT_TIMESTAMP
    WHERE avitag = $1
    RETURNING *;
  `;
  const values = [
    avitag,
    ...fields.map((field) => (updates as Record<string, any>)[field] ?? null),
  ];
  const { rows } = await pool.query(query, values);
  return rows[0] || null;
};

export const deleteProfile = async (avitag: string) => {
  const profile = await findProfileByAvitag(avitag);
  if (!profile) throw ApiError.notFound("Profile not found");

  const table = profileTables[profile.profile_type];
  const query = `DELETE FROM ${table} WHERE avitag = $1 RETURNING avitag;`;
  const { rows } = await pool.query(query, [avitag]);
  return rows[0] ? rows[0].avitag : null;
};

export const verifyProfile = async (avitag: string) => {
  const profile = await findProfileByAvitag(avitag);
  if (!profile) throw ApiError.notFound("Profile not found");

  const table = profileTables[profile.profile_type];
  const query = `
    UPDATE ${table}
    SET is_verified = TRUE, updated_at = CURRENT_TIMESTAMP
    WHERE avitag = $1
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [avitag]);
  return rows[0] || null;
};

export const getProfilesByType = async (
  profile_type: string,
  page: number,
  limit: number
) => {
  const table = profileTables[profile_type];
  if (!table) throw ApiError.badRequest("Invalid profile type");

  const offset = (page - 1) * limit;
  const query = `
    SELECT * FROM ${table}
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2;
  `;
  const countQuery = `SELECT COUNT(*) FROM ${table};`;

  const [profilesResult, countResult] = await Promise.all([
    pool.query(query, [limit, offset]),
    pool.query(countQuery),
  ]);

  return {
    profiles: profilesResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
};
