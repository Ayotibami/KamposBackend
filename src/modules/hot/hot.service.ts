import * as hotRepo from "./hot.repo";
import { GistService } from "../gist/gist.service";

export interface HotFeedPerson {
  avitag: string;
  first_name: string | null;
  image_url: string | null;
  campus_tag: string | null;
  major_tag: string | null;
  level: number | null;
  bio: string | null;
  tier: number;
  posts: hotRepo.HotPostWithAuthor[];
}

// How many trending campuses tier 5 considers — matches
// gist.service.ts's own TRENDING_SCHOOLS_FETCH_LIMIT (the size of its
// underlying cache), so this never asks for more than that cache actually
// holds. Unlike the school-filter pills (which exclude the viewer's own
// campus so a school is never suggested as its own "trending" pick), tier
// 5 has no reason to exclude it — a same-campus post already resolved into
// tiers 1-4 before tier 5 is ever considered, so the exclusion there would
// be a no-op here anyway, just extra ceremony.
const TRENDING_TIER_LIMIT = 8;

export const HotService = {
  create: (params: Parameters<typeof hotRepo.create>[0]) => hotRepo.create(params),
  findById: (hot_post_id: string) => hotRepo.findById(hot_post_id),
  deleteByOwner: (hot_post_id: string, avitag: string) => hotRepo.remove(hot_post_id, avitag),
  listMine: (avitag: string) => hotRepo.listMine(avitag),
  markSeenBatch: (avitag: string, hotPostIds: string[]) => hotRepo.markSeenBatch(avitag, hotPostIds),

  // Groups listFeed's flat (one row per post) result into one entry per
  // author, sorted by that author's BEST (lowest-numbered) tier first, then
  // by their soonest-expiring post (oldest created_at — matches every other
  // "soonest first" sort in this feature) as the tiebreaker within the same
  // tier. Posts within each author are oldest-first too, same convention
  // hot.repo.ts's listMine already uses.
  listFeed: async (viewerAvitag: string, viewerCampusTag: string | null, viewerMajorTag: string | null): Promise<HotFeedPerson[]> => {
    // excludeCampusTag: null — tier 5 has no reason to exclude the viewer's
    // own campus (see TRENDING_TIER_LIMIT's own doc comment above).
    const trending = await GistService.trendingSchools(null, TRENDING_TIER_LIMIT);
    const trendingCampusTags = trending.map((t) => t.campus_tag);

    const flat = await hotRepo.listFeed(viewerAvitag, viewerCampusTag, viewerMajorTag, trendingCampusTags);

    const byAvitag = new Map<string, HotFeedPerson>();
    for (const row of flat) {
      let person = byAvitag.get(row.avitag);
      if (!person) {
        person = {
          avitag: row.avitag,
          first_name: row.first_name,
          image_url: row.image_url,
          campus_tag: row.campus_tag,
          major_tag: row.major_tag,
          level: row.level,
          bio: row.bio,
          tier: row.tier,
          posts: [],
        };
        byAvitag.set(row.avitag, person);
      }
      // flat is already ORDER BY tier ASC, so the first row seen for a
      // given author already carries their best tier — later rows for the
      // same author only ever tie or lose, never improve it, so `person`
      // never needs its `tier` revisited after creation.
      person.posts.push(row);
    }

    return [...byAvitag.values()].sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      const aSoonest = a.posts[0]?.created_at ?? "";
      const bSoonest = b.posts[0]?.created_at ?? "";
      return aSoonest < bSoonest ? -1 : aSoonest > bSoonest ? 1 : 0;
    });
  },
};
