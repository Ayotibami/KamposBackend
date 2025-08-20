import pool from "../../config/connectDB";
import type { IGist } from "./gist.interface";
import { ApiError } from "../../utils/responseHandler";

export const createGist = async (gistData: Partial<IGist>) => {
  const { avitag, gist_text, media_ids, visibility } = gistData;
  const query = `
    INSERT INTO gists (gist_id, avitag, gist_text, media_ids, visibility, gist_approval)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, FALSE)
    RETURNING *;
  `;
  const values = [avitag, gist_text, media_ids || [], visibility || "PUBLIC"];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

export const findAllGists = async (
  page: number,
  limit: number,
  isAdmin: boolean = false
) => {
  const offset = (page - 1) * limit;
  const query = isAdmin
    ? `
      SELECT * FROM gists
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `
    : `
      SELECT * FROM gists
      WHERE gist_approval = TRUE
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `;
  const countQuery = isAdmin
    ? `SELECT COUNT(*) FROM gists;`
    : `SELECT COUNT(*) FROM gists WHERE gist_approval = TRUE;`;

  const [gistsResult, countResult] = await Promise.all([
    pool.query(query, [limit, offset]),
    pool.query(countQuery),
  ]);

  return {
    gists: gistsResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
};

export const findGistById = async (
  gist_id: string,
  isAdmin: boolean = false
) => {
  const query = isAdmin
    ? `SELECT * FROM gists WHERE gist_id = $1;`
    : `SELECT * FROM gists WHERE gist_id = $1 AND gist_approval = TRUE;`;
  const { rows } = await pool.query(query, [gist_id]);
  return rows[0] || null;
};

export const updateGistById = async (
  gist_id: string,
  updates: Partial<IGist>
) => {
  const fields = Object.keys(updates).filter(
    (key) =>
      key !== "gist_id" &&
      key !== "avitag" &&
      key !== "created_at" &&
      key !== "gist_approval"
  );
  if (fields.length === 0)
    throw ApiError.badRequest("No valid fields to update");

  const setClause = fields
    .map((field, index) => `${field} = $${index + 2}`)
    .join(", ");
  const query = `
    UPDATE gists
    SET ${setClause}, edited_at = CURRENT_TIMESTAMP
    WHERE gist_id = $1
    RETURNING *;
  `;
  const values = [
    gist_id,
    ...fields.map(field => updates[field as keyof IGist])
  ];
  const { rows } = await pool.query(query, values);
  return rows[0] || null;
};

export const deleteGistById = async (gist_id: string) => {
  const query = `DELETE FROM gists WHERE gist_id = $1 RETURNING gist_id;`;
  const { rows } = await pool.query(query, [gist_id]);
  return rows[0] ? rows[0].gist_id : null;
};

export const findGistsByAvitag = async (avitag: string) => {
  const query = `
    SELECT * FROM gists
    WHERE avitag = $1 AND gist_approval = TRUE
    ORDER BY created_at DESC;
  `;
  const { rows } = await pool.query(query, [avitag]);
  return rows;
};

export const findTrendingGists = async (
  page: number,
  limit: number,
  timeRange: string
) => {
  const offset = (page - 1) * limit;
  const timeFilter =
    timeRange === "24h"
      ? "NOW() - INTERVAL '24 hours'"
      : "NOW() - INTERVAL '7 days'";
  const query = `
    SELECT g.*
    FROM gists g
    LEFT JOIN views v ON g.gist_id = v.gist_id
    WHERE g.gist_approval = TRUE
    AND g.created_at >= ${timeFilter}
    GROUP BY g.gist_id
    ORDER BY COUNT(v.view_id) DESC
    LIMIT $1 OFFSET $2;
  `;
  const countQuery = `
    SELECT COUNT(DISTINCT g.gist_id) as total
    FROM gists g
    WHERE g.gist_approval = TRUE
    AND g.created_at >= ${timeFilter};
  `;

  const [gistsResult, countResult] = await Promise.all([
    pool.query(query, [limit, offset]),
    pool.query(countQuery),
  ]);

  return {
    gists: gistsResult.rows,
    total: parseInt(countResult.rows[0].total, 10),
  };
};

export const searchGists = async (
  query: string,
  page: number,
  limit: number
) => {
  const offset = (page - 1) * limit;
  const searchQuery = `
    SELECT * FROM gists
    WHERE gist_approval = TRUE
    AND gist_text ILIKE $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const countQuery = `
    SELECT COUNT(*) FROM gists
    WHERE gist_approval = TRUE
    AND gist_text ILIKE $1;
  `;
  const searchTerm = `%${query}%`;

  const [gistsResult, countResult] = await Promise.all([
    pool.query(searchQuery, [searchTerm, limit, offset]),
    pool.query(countQuery, [searchTerm]),
  ]);

  return {
    gists: gistsResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
};

export const approveGist = async (gist_id: string, approved: boolean) => {
  const query = `
    UPDATE gists
    SET gist_approval = $2, edited_at = CURRENT_TIMESTAMP
    WHERE gist_id = $1
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [gist_id, approved]);
  return rows[0] || null;
};

export const findReportedGists = async () => {
  const query = `
    SELECT g.* FROM gists g
    JOIN reports r ON g.gist_id = r.gist_id
    WHERE r.status = 'PENDING'
    ORDER BY g.created_at DESC;
  `;
  const { rows } = await pool.query(query);
  return rows;
};
