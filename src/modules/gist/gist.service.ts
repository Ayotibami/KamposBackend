import * as gistRepo from "./gist.repo";

// In-process cache for getTrendingSchools — that query scans every gist
// from the last 72h, and "which 3 schools are popular right now" doesn't
// need per-request freshness. A single shared entry (not keyed per viewer)
// serves everyone: it caches more than the 3 actually shown so that
// excluding whichever campus the requesting viewer belongs to still leaves
// enough to fill 3 pills. Recomputed lazily on the first request after it
// goes stale, not on a timer.
const TRENDING_SCHOOLS_TTL_MS = 20 * 60 * 1000;
const TRENDING_SCHOOLS_FETCH_LIMIT = 8;
let trendingSchoolsCache: { at: number; schools: gistRepo.TrendingSchool[] } | null = null;

async function getCachedTrendingSchools(): Promise<gistRepo.TrendingSchool[]> {
  const now = Date.now();
  if (trendingSchoolsCache && now - trendingSchoolsCache.at < TRENDING_SCHOOLS_TTL_MS) {
    return trendingSchoolsCache.schools;
  }
  const schools = await gistRepo.getTrendingSchools(TRENDING_SCHOOLS_FETCH_LIMIT);
  trendingSchoolsCache = { at: now, schools };
  return schools;
}

export const GistService = {
  // campus_tag/major_tag come from the caller now (the controller's own
  // req.user, off the session token) rather than a fresh lookup here — see
  // JwtClaims' own docs on why that's safe. Kept as explicit params rather
  // than re-adding the lookup internally so this stays a pure pass-through
  // to the repo, with no DB dependency of its own.
  create: async (
    avitag: string,
    account_id: string,
    profile_id: string,
    profile_type: string,
    gist_text: string,
    campus_tag: string | null,
    major_tag: string | null,
    color_key: string | null = null
  ) => {
    return gistRepo.create(avitag, account_id, profile_id, profile_type, gist_text, campus_tag, major_tag, color_key);
  },
  updateText: (gist_id: string, avitag: string, gist_text: string) =>
    gistRepo.updateText(gist_id, avitag, gist_text),
  deleteByOwner: (gist_id: string, avitag: string) =>
    gistRepo.remove(gist_id, avitag),
  deleteAsIdiot: (gist_id: string) => gistRepo.removeAsIdiot(gist_id),
  findById: (gist_id: string) => gistRepo.findById(gist_id),
  findWithCounts: (gist_id: string, viewerAvitag?: string) => gistRepo.findWithCounts(gist_id, viewerAvitag),
  findWithCountsAnyStatus: (gist_id: string, viewerAvitag?: string) => gistRepo.findWithCountsAnyStatus(gist_id, viewerAvitag),
  getContext: (gist_id: string, before: number, after: number, viewerAvitag?: string) =>
    gistRepo.getContext(gist_id, before, after, viewerAvitag),
  listRecent: (
    limit?: number,
    cursor?: string,
    viewerAvitag?: string,
    filters?: { major_tag?: string | null },
    feedScope?: { mode: "home" | "school" | "none"; campusTag: string | null }
  ) => gistRepo.listRecent(limit, cursor, viewerAvitag, filters, feedScope),
  listByUser: (avitag: string, limit?: number, cursor?: string, viewerAvitag?: string) =>
    gistRepo.listByUser(avitag, limit, cursor, viewerAvitag),
  countByUser: (avitag: string, viewerAvitag?: string) =>
    gistRepo.countByUser(avitag, viewerAvitag),
  // excludeCampusTag is always the viewer's own campus (derived server-side,
  // never trusted from the client) — a school never gets suggested as its
  // own trending pill.
  trendingSchools: async (excludeCampusTag: string | null, limit = 3) => {
    const all = await getCachedTrendingSchools();
    return all.filter((s) => s.campus_tag !== excludeCampusTag).slice(0, limit);
  },
  trending: (limit?: number, viewerAvitag?: string, filters?: { campus_tag?: string | null; major_tag?: string | null }) =>
    gistRepo.trending(limit, viewerAvitag, filters),
  search: (term: string, limit?: number, offset?: number, viewerAvitag?: string, filters?: { campus_tag?: string | null; major_tag?: string | null }) =>
    gistRepo.search(term, limit, offset, viewerAvitag, filters),
  getCounts: (gist_id: string) => gistRepo.getCounts(gist_id),
  getCountsFull: (gist_id: string) => gistRepo.getCountsFull(gist_id),
  getReactionBreakdownForGist: (gist_id: string) => gistRepo.getReactionBreakdownForGist(gist_id),
  report: (gist_id: string, reporter_avitag: string, reason: string | null) =>
    gistRepo.report(gist_id, reporter_avitag, reason),
  incrementView: (gist_id: string, avitag: string | null) =>
    gistRepo.incrementView(gist_id, avitag),
  incrementShare: (gist_id: string, avitag: string | null, platform: string | null) =>
    gistRepo.incrementShare(gist_id, avitag, platform),
};
