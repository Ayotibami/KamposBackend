import pool from "../../config/connectDB";
import type { IGist } from "./gist.interface";

const mapRow = (r: any): IGist => ({
  gistId: r.gist_id,
  gistText: r.gist_text,
  avitag: r.avitag,
  createdAt: r.created_at,
  editedAt: r.edited_at,
  gistApproval: r.gist_approval,
});

export const createGist = async (gist: Partial<IGist>): Promise<IGist> => {
  const { rows } = await pool.query(
    `INSERT INTO gists (gist_text, avitag) VALUES ($1, $2) RETURNING *`,
    [gist.gistText, gist.avitag]
  );
  return mapRow(rows[0]);
};

export const findGistById = async (gistId: string): Promise<IGist | null> => {
  const { rows } = await pool.query(`SELECT * FROM gists WHERE gist_id = $1`, [
    gistId,
  ]);
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const findGistsByAvitag = async (avitag: string): Promise<IGist[]> => {
  const { rows } = await pool.query(`SELECT * FROM gists WHERE avitag = $1`, [
    avitag,
  ]);
  return rows.map(mapRow);
};

export const findAllGists = async (
  page: number = 1,
  limit: number = 10
): Promise<{ gists: IGist[]; total: number }> => {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(
    `SELECT * FROM gists ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM gists`);
  return { gists: rows.map(mapRow), total: parseInt(countRows[0].count) };
};

// Approved-only variants for public consumption
export const findApprovedGistById = async (
  gistId: string
): Promise<IGist | null> => {
  const { rows } = await pool.query(
    `SELECT * FROM gists WHERE gist_id = $1 AND gist_approval = TRUE`,
    [gistId]
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const findApprovedGistsByAvitag = async (
  avitag: string
): Promise<IGist[]> => {
  const { rows } = await pool.query(
    `SELECT * FROM gists WHERE avitag = $1 AND gist_approval = TRUE ORDER BY created_at DESC`,
    [avitag]
  );
  return rows.map(mapRow);
};

export const findAllApprovedGists = async (
  page: number = 1,
  limit: number = 10
): Promise<{ gists: IGist[]; total: number }> => {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(
    `SELECT * FROM gists WHERE gist_approval = TRUE ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM gists WHERE gist_approval = TRUE`
  );
  return { gists: rows.map(mapRow), total: parseInt(countRows[0].count) };
};

export const updateGistById = async (
  gistId: string,
  updates: Partial<IGist>
): Promise<IGist | null> => {
  const set: string[] = [];
  const vals: any[] = [];
  let idx = 1;
  if (updates.gistText) {
    set.push(`gist_text = $${idx++}`);
    vals.push(updates.gistText);
  }
  if (set.length === 0) return findGistById(gistId);
  vals.push(gistId);
  const { rows } = await pool.query(
    `UPDATE gists SET ${set.join(
      ", "
    )}, edited_at = NOW() WHERE gist_id = $${idx} RETURNING *`,
    vals
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const deleteGistById = async (gistId: string): Promise<void> => {
  await pool.query(`DELETE FROM gists WHERE gist_id = $1`, [gistId]);
};

export const findTrendingGists = async (
  page: number = 1,
  limit: number = 10,
  timeRange: string = "7 days"
): Promise<{ gists: IGist[]; total: number }> => {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(
    `
    SELECT g.*, COUNT(r.reaction_id) as reaction_count
    FROM gists g
    LEFT JOIN reactions r ON r.entity_id = g.gist_id AND r.entity_type = 'GIST'
    WHERE g.created_at >= NOW() - INTERVAL $3
    GROUP BY g.gist_id
    ORDER BY reaction_count DESC, g.created_at DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset, timeRange]
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM gists WHERE created_at >= NOW() - INTERVAL $1`,
    [timeRange]
  );
  return { gists: rows.map(mapRow), total: parseInt(countRows[0].count) };
};

export const findTrendingApprovedGists = async (
  page: number = 1,
  limit: number = 10,
  timeRange: string = "7 days"
): Promise<{ gists: IGist[]; total: number }> => {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(
    `
    SELECT g.*, COUNT(r.reaction_id) as reaction_count
    FROM gists g
    LEFT JOIN reactions r ON r.entity_id = g.gist_id AND r.entity_type = 'GIST'
    WHERE g.created_at >= NOW() - INTERVAL $3 AND g.gist_approval = TRUE
    GROUP BY g.gist_id
    ORDER BY reaction_count DESC, g.created_at DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset, timeRange]
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM gists WHERE created_at >= NOW() - INTERVAL $1 AND gist_approval = TRUE`,
    [timeRange]
  );
  return { gists: rows.map(mapRow), total: parseInt(countRows[0].count) };
};

export const searchGists = async (
  query: string,
  page: number = 1,
  limit: number = 10
): Promise<{ gists: IGist[]; total: number }> => {
  const offset = (page - 1) * limit;
  const searchTerm = `%${query}%`;
  const { rows } = await pool.query(
    `SELECT * FROM gists WHERE gist_text ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [searchTerm, limit, offset]
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM gists WHERE gist_text ILIKE $1`,
    [searchTerm]
  );
  return { gists: rows.map(mapRow), total: parseInt(countRows[0].count) };
};

export const searchApprovedGists = async (
  query: string,
  page: number = 1,
  limit: number = 10
): Promise<{ gists: IGist[]; total: number }> => {
  const offset = (page - 1) * limit;
  const searchTerm = `%${query}%`;
  const { rows } = await pool.query(
    `SELECT * FROM gists WHERE gist_text ILIKE $1 AND gist_approval = TRUE ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [searchTerm, limit, offset]
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM gists WHERE gist_text ILIKE $1 AND gist_approval = TRUE`,
    [searchTerm]
  );
  return { gists: rows.map(mapRow), total: parseInt(countRows[0].count) };
};

// Admin moderation helpers
export const approveGistById = async (
  gistId: string
): Promise<IGist | null> => {
  const { rows } = await pool.query(
    `UPDATE gists SET gist_approval = TRUE, edited_at = NOW() WHERE gist_id = $1 RETURNING *`,
    [gistId]
  );
  if (!rows[0]) return null;
  return mapRow(rows[0]);
};

export const findPendingGists = async (
  page: number = 1,
  limit: number = 10
): Promise<{ gists: IGist[]; total: number }> => {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(
    `SELECT * FROM gists WHERE gist_approval = FALSE ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM gists WHERE gist_approval = FALSE`
  );
  return { gists: rows.map(mapRow), total: parseInt(countRows[0].count) };
};
