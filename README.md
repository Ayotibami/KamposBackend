# Kampos Backend (Rebuild)

Backend stack
- Bun + Express 5 + TypeScript
- PostgreSQL (raw `pg`, no ORM) + Redis
- Vitest + Supertest
- WebSockets (`ws`) + Redis-backed pub/sub
- GraphQL (feeds only)
- Email (Brevo SMTP) + Push (FCM)

## Environment
Copy `.env.example` to `.env` and fill in values.

## Run (dev)
- Install deps: `bun install`
- Start API: `bun run dev`

## Database
- Create database (Postgres)
- Run migrations in `migrations/` (use your preferred tool or psql):
  - `psql "$POSTGRES_URI" -f migrations/0001_init.sql`

## Design Principles
- Account may own multiple profiles (no max). `avitag` unique globally.
- Profiles are hidden until verified by IDIOT (admin role renamed to IDIOT everywhere).
- Gists require approval (Submitted → Approved/Rejected). Feeds show only approved gists; authors can see all their own.
- Trending window: 3 days. Search by text with filters (campus, major, level).
- Engagement: flat comments (immediate), one reaction per user+entity, views are auth-only and count every view, shares tracked via GET and return links.
- WebSockets: JWT Bearer handshake; topics for `feed.global`, `gist.{id}.comments`, `gist.{id}.reactions`.
- Caching: Redis for feeds/trending; invalidate on approvals and engagement.
- Security: argon2id hashing, JWT access token (30 days) with `avitag` and `profileType`, Zod validation, Helmet, CORS, rate limiting.
- Accounts soft delete. Moderation queue under `/api/v1/idiot/*`. Audit logs for approvals/verification.

## Endpoints (high level)
- Auth: register, login, logout, oauth (Google/Facebook/Apple), switch-profile
- Account: me, update, change-password, delete (soft)
- Profiles: create, get/update/delete (hidden until verified), verify/reject by IDIOT
- Gists: submit, edit/delete, get by id, list, by user, trending (3 days), search
- Comments: CRUD, by gist, by user
- Reactions: add/change/remove; by entity, by user
- Views: record view (auth-only)
- Shares: GET tracking + return outbound link(s)
- Media: upload/get/list-by-entity/update/delete (hard delete)
- Events: CRUD; registrations CRUD
- Notifications: list, mark read/unread
- Reports: submit, list, review, delete
- Moderation (IDIOT): queues for pending gists/profiles, approve/reject
- GraphQL (feeds): approved-only with filters and cursor pagination

## Migrations
- `migrations/0001_init.sql` creates core enums, tables, indexes.

## Roadmap
- Phase 1: Schema, skeleton app, Auth (JWT + OAuth), Profiles + verification, Gists + approvals (WS + cache invalidation), GraphQL feeds, basic tests.
- Phase 2: Remaining modules (events, media, notifications, reports), push notifications (FCM), more tests and docs.

## Scripts (coming)
- Database migration runner (simple Bun/Node script)
- Seed reference data (campus/major)

## Contributing
- Use Vitest for tests: `bun run test`
- Consistent coding style, Zod validation on all request payloads.
