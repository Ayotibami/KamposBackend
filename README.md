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

### OAuth environment
Set the following for OAuth:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` (optional for ID token verification but commonly set)
- `FACEBOOK_CLIENT_ID` (App ID)
- `FACEBOOK_CLIENT_SECRET`
- `APPLE_CLIENT_ID` (Service ID used by your client)
- `OAUTH_ENC_KEY` (32+ chars; used to encrypt provider refresh tokens before storing)

Optional Apple values present in `src/config/env.ts` are reserved for future server-to-server flows.

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
  - `oauth_sessions` table is created here.
- `migrations/0020_add_oauth_sessions_unique.sql` ensures a unique constraint on `(account_id, auth_provider)` for idempotent session upserts.

## OAuth usage

### Google Sign-In (ID token)
Client obtains an `id_token` from Google Sign-In SDK and sends it to the backend. Backend verifies signature and audience, links/creates account, persists optional refresh token and returns a JWT.

Request:
```bash
curl -X POST http://localhost:8080/api/v1/auth/oauth/google \
  -H "Content-Type: application/json" \
  -d '{
    "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": null,
    "refresh_expires_at": null
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "account": { "account_id": "...", "email": "user@example.com", "auth_provider": "GOOGLE", ... },
    "token": "<JWT access token>"
  }
}
```

### Facebook Login (Access Token)
Client obtains a Facebook `access_token` and sends to backend. Backend validates it via Graph API `/me`.

Request:
```bash
curl -X POST http://localhost:8080/api/v1/auth/oauth/facebook \
  -H "Content-Type: application/json" \
  -d '{
    "access_token": "EAABsbCS1iHgBA...",
    "refresh_token": null,
    "refresh_expires_at": null
  }'
```

### Apple Sign-In (Identity Token)
Client obtains an Apple `identity_token` (JWT). Backend verifies its signature using Apple JWKS, validates audience and issuer, then links/creates account.

Request:
```bash
curl -X POST http://localhost:8080/api/v1/auth/oauth/apple \
  -H "Content-Type: application/json" \
  -d '{
    "identity_token": "eyJraWQiOiJBSU9...",
    "refresh_token": null,
    "refresh_expires_at": null
  }'
```

Notes:
- If the provider returns an email that matches an existing account, the OAuth ID is linked to that account.
- If `OAUTH_ENC_KEY` is set, provider refresh tokens are encrypted at rest in `oauth_sessions.encrypted_refresh_token`.
- All OAuth logins return a standard JWT (subject to `JWT_EXPIRES`) that you use for authenticated endpoints.

## Gists: create with media (form-data)

`POST /api/v1/gists` supports creating a gist with optional media in a single request using `multipart/form-data`.

Headers:
- `Authorization: Bearer <JWT>`
- `Content-Type: multipart/form-data`

Fields:
- `gist_text` (string, required)
- `file` (file) for a single media OR `files` (multiple file fields) for multiple media

Single file example:
```bash
curl -X POST http://localhost:8080/api/v1/gists \
  -H "Authorization: Bearer $TOKEN" \
  -F gist_text='My first gist with a photo' \
  -F file=@/path/to/image.jpg
```

Multiple files example (preserves order):
```bash
curl -X POST http://localhost:8080/api/v1/gists \
  -H "Authorization: Bearer $TOKEN" \
  -F gist_text='Trip highlights' \
  -F files=@/path/photo1.jpg \
  -F files=@/path/photo2.jpg \
  -F files=@/path/video.mp4
```

Notes:
- The backend uploads each file to Cloudinary and stores a `gist_media` row with an `order_index` matching the upload order.
- Response returns the newly created gist with its `media` array inline. If media upload fails, the gist is still created and returned without media.

## Roadmap
- Phase 1: Schema, skeleton app, Auth (JWT + OAuth), Profiles + verification, Gists + approvals (WS + cache invalidation), GraphQL feeds, basic tests.
- Phase 2: Remaining modules (events, media, notifications, reports), push notifications (FCM), more tests and docs.

## Scripts (coming)
- Database migration runner (simple Bun/Node script)
- Seed reference data (campus/major)

## Contributing
- Use Vitest for tests: `bun run test`
- Consistent coding style, Zod validation on all request payloads.
