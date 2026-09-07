import { pool } from '../../config/db';

export interface HqStats {
  accounts: { total: number; by_status: Record<string, number> };
  profiles: { total: number; by_type: Record<string, number> };
  signups: { today: number; last_7d: number; last_30d: number; total: number };
  logins: { today: number; last_7d: number; last_30d: number };
  engagement: {
    gists: { total: number; today: number; last_7d: number };
    comments: { total: number; today: number };
    reactions_total: number;
    gist_views_total: number;
    gist_shares_total: number;
  };
  moderation: { pending_gists: number; pending_reports: number };
  admins_total: number;
  trends: {
    signups_by_day: { date: string; count: number }[];
    gists_by_day: { date: string; count: number }[];
  };
}

/**
 * One row per calendar day for the last 30 days (including today), zero-
 * filled for days with no activity — a generate_series left-joined against
 * the target table, so the chart never has to guess at a gap. Shared by
 * both trend queries below; only the source table/timestamp column differ.
 */
function dailySeriesQuery(table: string, timestampCol: string): string {
  return `
    WITH days AS (
      SELECT generate_series(
        date_trunc('day', now()) - interval '29 days',
        date_trunc('day', now()),
        interval '1 day'
      )::date AS day
    )
    SELECT to_char(d.day, 'YYYY-MM-DD') AS date, COUNT(t.*)::int AS count
    FROM days d
    LEFT JOIN ${table} t ON date_trunc('day', t.${timestampCol}) = d.day
    GROUP BY d.day
    ORDER BY d.day
  `;
}

const PROFILE_TABLES = [
  ['STUDENT', 'student_profiles'],
  ['KREATOR', 'kreator_profiles'],
  ['KOMPANY', 'kompany_profiles'],
  ['SCHOOL', 'school_profiles'],
  ['IDIOT', 'idiot_profiles'],
] as const;

/**
 * One read model for the HQ landing page — a dozen small COUNT queries run
 * in parallel (Promise.all) rather than one giant query, since they hit
 * unrelated tables and gain nothing from being combined. "Today" buckets use
 * date_trunc('day', now()) (calendar-day boundary) rather than a rolling
 * 24h window, so the number means the same thing regardless of what time of
 * day an admin checks it.
 */
export async function getHqStats(): Promise<HqStats> {
  const [
    accountsByStatus,
    profilesByType,
    signups,
    logins,
    gists,
    comments,
    reactions,
    gistViews,
    gistShares,
    pendingReports,
    admins,
    signupsByDay,
    gistsByDay,
  ] = await Promise.all([
    pool.query<{ account_status: string; count: string }>(
      `SELECT account_status, COUNT(*)::int AS count FROM accounts GROUP BY account_status`
    ),
    pool.query<{ profile_type: string; count: string }>(
      PROFILE_TABLES.map(([type, table]) => `SELECT '${type}' AS profile_type, COUNT(*)::int AS count FROM ${table}`).join(
        ' UNION ALL '
      )
    ),
    pool.query<{ today: number; last_7d: number; last_30d: number; total: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today,
         COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS last_7d,
         COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS last_30d,
         COUNT(*)::int AS total
       FROM accounts`
    ),
    pool.query<{ today: number; last_7d: number; last_30d: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE last_login >= date_trunc('day', now()))::int AS today,
         COUNT(*) FILTER (WHERE last_login >= now() - interval '7 days')::int AS last_7d,
         COUNT(*) FILTER (WHERE last_login >= now() - interval '30 days')::int AS last_30d
       FROM accounts`
    ),
    pool.query<{ total: number; pending: number; approved: number; today: number; last_7d: number }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE gist_status = 'SUBMITTED')::int AS pending,
         COUNT(*) FILTER (WHERE gist_status = 'APPROVED')::int AS approved,
         COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today,
         COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS last_7d
       FROM gists`
    ),
    pool.query<{ total: number; today: number }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE commented_at >= date_trunc('day', now()))::int AS today
       FROM comments`
    ),
    pool.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM reactions`),
    pool.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM gist_views`),
    pool.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM gist_shares`),
    pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM gist_reports WHERE status = 'PENDING'`),
    pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM accounts WHERE role IN ('idiot', 'king')`),
    pool.query<{ date: string; count: number }>(dailySeriesQuery('accounts', 'created_at')),
    pool.query<{ date: string; count: number }>(dailySeriesQuery('gists', 'created_at')),
  ]);

  const by_status: Record<string, number> = {};
  let accountsTotal = 0;
  for (const row of accountsByStatus.rows) {
    by_status[row.account_status] = Number(row.count);
    accountsTotal += Number(row.count);
  }

  const by_type: Record<string, number> = {};
  let profilesTotal = 0;
  for (const row of profilesByType.rows) {
    by_type[row.profile_type] = Number(row.count);
    profilesTotal += Number(row.count);
  }

  const gistsRow = gists.rows[0];
  const commentsRow = comments.rows[0];
  const signupsRow = signups.rows[0];
  const loginsRow = logins.rows[0];

  return {
    accounts: { total: accountsTotal, by_status },
    profiles: { total: profilesTotal, by_type },
    signups: { today: signupsRow.today, last_7d: signupsRow.last_7d, last_30d: signupsRow.last_30d, total: signupsRow.total },
    logins: { today: loginsRow.today, last_7d: loginsRow.last_7d, last_30d: loginsRow.last_30d },
    engagement: {
      gists: { total: gistsRow.total, today: gistsRow.today, last_7d: gistsRow.last_7d },
      comments: { total: commentsRow.total, today: commentsRow.today },
      reactions_total: reactions.rows[0].total,
      gist_views_total: gistViews.rows[0].total,
      gist_shares_total: gistShares.rows[0].total,
    },
    moderation: { pending_gists: gistsRow.pending, pending_reports: pendingReports.rows[0].count },
    admins_total: admins.rows[0].count,
    trends: {
      signups_by_day: signupsByDay.rows.map((r) => ({ date: r.date, count: Number(r.count) })),
      gists_by_day: gistsByDay.rows.map((r) => ({ date: r.date, count: Number(r.count) })),
    },
  };
}
