# Kampos Backend (Rebuild)

Backend stack
- Bun + Express 5 + TypeScript
- PostgreSQL (raw `pg`, no ORM) + Redis
- Vitest + Supertest
- WebSockets (`ws`) + Redis-backed pub/sub
- GraphQL (feeds only)
- Email (Brevo SMTP) + Push (FCM)

---

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

---

## Table of Contents
- [Environment](#environment)
- [Run (dev)](#run-dev)
- [Database](#database)
- [Design Principles](#design-principles)
- [Endpoints (high level)](#endpoints-high-level)
- [REST API Documentation](#rest-api-documentation)
  - [Auth and Account](#auth-and-account)
  - [Profiles](#profiles)
  - [Gists](#gists)
  - [Comments](#comments)
  - [Reactions](#reactions)
  - [Events](#events)
  - [Event Comments](#event-comments)
  - [Event Registrations](#event-registrations)
  - [IDIOT Moderation (admin)](#idiot-moderation-admin)
  - [Socket.IO Live Updates (React Native Expo)](#socketio-live-updates-react-native-expo)
- [Migrations](#migrations)
- [OAuth usage](#oauth-usage)
- [Gists: create with media (form-data)](#gists-create-with-media-form-data)
- [Roadmap](#roadmap)
- [Scripts (coming)](#scripts-coming)
- [Contributing](#contributing)

---

## REST API Documentation

Base URL: `http://localhost:8080`

All endpoints return a JSON envelope: `{ success: boolean, data?: any, message?: string }`.

Auth and Account
- Register
  - POST `/api/v1/auth/register`
  - Body:
    ```json
    { "email": "user@example.com", "password": "My$ecretPass123" }
    ```
  - Response:
    ```json
    { "success": true, "data": { "account_id": "...", "email": "user@example.com" } }
    ```

- Login
  - POST `/api/v1/auth/login`
  - Body:
    ```json
    { "email": "user@example.com", "password": "My$ecretPass123" }
    ```
  - Response includes JWT token:
    ```json
    { "success": true, "data": { "token": "<JWT>", "account": { "account_id": "...", "email": "user@example.com" } } }
    ```

- OAuth
  - Google: POST `/api/v1/auth/oauth/google` (body `{ id_token, refresh_token?, refresh_expires_at? }`)
  - Facebook: POST `/api/v1/auth/oauth/facebook` (body `{ access_token, refresh_token?, refresh_expires_at? }`)
  - Apple: POST `/api/v1/auth/oauth/apple` (body `{ identity_token, refresh_token?, refresh_expires_at? }`)

- Switch profile
  - POST `/api/v1/auth/switch-profile`
  - Auth: Bearer
  - Body:
    ```json
    { "avitag": "john_doe@abc" }
    ```
  - Response contains a token bound to the active profile.

- Account: Me
  - GET `/api/v1/account/me`
  - Auth: Bearer
  - Response: account + active profile context

- Account: Update
  - PATCH `/api/v1/account/update`
  - Body:
    ```json
    { "display_name": "John D.", "bio": "Student at ABC" }
    ```

- Change password
  - PATCH `/api/v1/account/change-password`
  - Body:
    ```json
    { "old_password": "...", "new_password": "..." }
    ```

- Delete (soft)
  - DELETE `/api/v1/account/delete`

Profiles
- Create student profile
  - POST `/api/v1/profiles/students`
  - Body:
    ```json
    { "avitag": "john@abc", "display_name": "John", "campus_tag": "ABC", "major_tag": "CS" }
    ```

- Get profile by avitag
  - GET `/api/v1/profiles/students/:avitag`

- Update profile
  - PATCH `/api/v1/profiles/students/:avitag`
  - Body: fields to update (e.g., `display_name`, `bio`)

- Upload profile picture (form-data)
  - POST `/api/v1/profiles/upload-picture`
  - Field: `file`

### Gists
- Create a gist (form-data, optional media)
  - POST `/api/v1/gists`
  - Auth: Bearer
  - Fields:
    - `gist_text` (string, required)
    - `file` (one) or `files` (multiple)
  - Example curl:
    ```bash
    curl -X POST http://localhost:8080/api/v1/gists \
      -H "Authorization: Bearer $TOKEN" \
      -F gist_text='Trip highlights' \
      -F files=@/path/photo1.jpg \
      -F files=@/path/photo2.jpg \
      -F files=@/path/video.mp4
    ```
  - Response:
    ```json
    {
      "success": true,
      "data": {
        "gist_id": "...",
        "avitag": "john@abc",
        "gist_text": "Trip highlights",
        "created_at": "...",
        "media": [ { "media_id": "...", "media_type": "IMAGE", "order_index": 0, "media_url": "..." } ]
      }
    }
    ```

- List recent
  - GET `/api/v1/gists?limit=20&cursor=<gist_id>&campus_tag=<tag>&major_tag=<tag>`
  - Filters (optional): `campus_tag`, `major_tag`

- Trending
  - GET `/api/v1/gists/trending?limit=20&campus_tag=<tag>&major_tag=<tag>`
  - Filters (optional): `campus_tag`, `major_tag`

- Search
  - GET `/api/v1/gists/search?term=abc&limit=20&offset=0&campus_tag=<tag>&major_tag=<tag>`
  - Filters (optional): `campus_tag`, `major_tag`

- Get by id
  - GET `/api/v1/gists/:gist_id`

- Counts
  - GET `/api/v1/gists/:gist_id/counts`

- Update gist text
  - PATCH `/api/v1/gists/:gist_id`
  - Body:
    ```json
    { "gist_text": "Updated text" }
    ```

- Delete gist
  - DELETE `/api/v1/gists/:gist_id`

- Report a gist
  - POST `/api/v1/gists/:gist_id/report`
  - Body:
    ```json
    { "reason": "Spam or inappropriate content" }
    ```

- Record a view
  - POST `/api/v1/gists/:gist_id/view`

- Reorder gist media
  - PATCH `/api/v1/gists/:gist_id/media/reorder`
  - Body:
    ```json
    { "media_ids": ["<MEDIA_ID_3>", "<MEDIA_ID_1>", "<MEDIA_ID_2>"] }
    ```

- Upload single media (form-data)
  - POST `/api/v1/gists/:gist_id/media`
  - Field: `file`

### Comments
- Create
  - POST `/api/v1/comments`
  - Body:
    ```json
    { "gist_id": "<GIST_ID>", "text": "Nice post!" }
    ```

- List by gist
  - GET `/api/v1/comments/gist/:gist_id?limit=20&cursor=<comment_id>`

- Delete
  - DELETE `/api/v1/comments/:comment_id`

### Reactions
- Upsert reaction
  - POST `/api/v1/reactions`
  - Body:
    ```json
    { "entity_type": "GIST", "entity_id": "<GIST_ID>", "type": "LIKE" }
    ```

- List by entity
  - GET `/api/v1/reactions/entity?entity_type=GIST&entity_id=<GIST_ID>`

- Remove reaction
  - DELETE `/api/v1/reactions/:reaction_id`

### Events
- Create event (optional thumbnail; JSON or form-data)
  - POST `/api/v1/events`
  - Auth: Bearer
  - Fields:
    - `title` (string), `host_avi_tags` (string[] up to 3), `location` (string), `description` (string), `event_date` (ISO string)
    - `thumbnail` (file, image, optional)
  - Example (multipart):
    ```bash
    curl -X POST http://localhost:8080/api/v1/events \
      -H "Authorization: Bearer $TOKEN" \
      -F title='Tech Talk' \
      -F host_avi_tags='["dev@abc","club@abc"]' \
      -F location='ABC Campus' \
      -F description='A deep dive into JS runtimes' \
      -F event_date='2025-09-28T14:00:00Z' \
      -F thumbnail=@/path/banner.jpg
    ```

- List events
  - GET `/api/v1/events?limit=20&before=<EVENT_ID>`

- Get event by id
  - GET `/api/v1/events/:event_id`

- Update event
  - PUT `/api/v1/events/:event_id`
  - Body (any subset):
    ```json
    { "title": "Updated Title", "event_date": "2025-10-01T15:00:00Z" }
    ```

- Delete event
  - DELETE `/api/v1/events/:event_id`

- Record a view
  - POST `/api/v1/events/:event_id/view`

### Event Comments
- Create
  - POST `/api/v1/event-comments`
  - Body:
    ```json
    { "event_id": "<EVENT_ID>", "text": "Excited for this!" }
    ```

- List by event
  - GET `/api/v1/event-comments/event/:event_id?limit=20&cursor=<comment_id>`

- Update
  - PUT `/api/v1/event-comments/:comment_id`
  - Body:
    ```json
    { "text": "Updated comment" }
    ```

- Delete
  - DELETE `/api/v1/event-comments/:comment_id`

### Event Registrations
- Register for event
  - POST `/api/v1/event-registrations`
  - Auth: Bearer
  - Body:
    ```json
    { "event_id": "<EVENT_ID>" }
    ```

- Get registered students for event
  - GET `/api/v1/event-registrations/event/:event_id`

- Get a student's registered events
  - GET `/api/v1/event-registrations/student/:avitag`

- Unregister
  - DELETE `/api/v1/event-registrations/:id`

### IDIOT Moderation (admin)
- Base path: `/api/v1/idiot/moderation` (JWT + role `IDIOT`)

- Pending gists
  - GET `/api/v1/idiot/moderation/gists?limit=20&offset=0`

- Approve gist
  - POST `/api/v1/idiot/moderation/gists/:id/approve`

- Reject gist
  - POST `/api/v1/idiot/moderation/gists/:id/reject`
  - Body:
    ```json
    { "reason": "Contains disallowed content" }
    ```

- Pending profiles
  - GET `/api/v1/idiot/moderation/profiles?limit=20&offset=0`

- Verify profile
  - POST `/api/v1/idiot/moderation/profiles/:avitag/verify`

- Reject profile (log)
  - POST `/api/v1/idiot/moderation/profiles/:avitag/reject`
  - Body:
    ```json
    { "reason": "Impersonation" }
    ```

- Pending reports
  - GET `/api/v1/idiot/moderation/reports?limit=20&offset=0`

- Accept report (reject gist)
  - POST `/api/v1/idiot/moderation/reports/:report_id/accept`

- Reject report
  - POST `/api/v1/idiot/moderation/reports/:report_id/reject`

## Socket.IO Live Updates (React Native Expo)

The backend emits WebSocket events (via `socket.io`) for certain topics, e.g.:
- `feed.global`: approvals/rejections broadcast
- `gist_media:created`, `gist_media:reordered`, `gist_media:deleted`
- `event.created`, `event.updated`, `event.deleted`, `event.viewed`
- `event_comment:created`, `event_comment:updated`, `event_comment:deleted`

Example: React Native (Expo) minimal subscriber using `socket.io-client`.

Install dependencies:
```bash
expo install socket.io-client
```

Usage:
```tsx
// App.tsx
import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, Text, FlatList } from 'react-native';
import io, { Socket } from 'socket.io-client';

type EventItem = { id: string; msg: string };

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    // Connect with optional auth (Bearer token)
    const socket = io('http://localhost:8080', {
      transports: ['websocket'],
      auth: { token: 'Bearer <JWT>' },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setEvents((e) => [{ id: Date.now()+':c', msg: 'connected' }, ...e]);
    });

    // Subscribe to global feed broadcast
    socket.on('feed.global', (payload: any) => {
      setEvents((e) => [{ id: Date.now()+':fg', msg: JSON.stringify(payload) }, ...e]);
    });

    // Media changes
    socket.on('gist_media:created', (payload: any) => {
      setEvents((e) => [{ id: Date.now()+':mc', msg: JSON.stringify(payload) }, ...e]);
    });
    socket.on('gist_media:reordered', (payload: any) => {
      setEvents((e) => [{ id: Date.now()+':mr', msg: JSON.stringify(payload) }, ...e]);
    });
    socket.on('gist_media:deleted', (payload: any) => {
      setEvents((e) => [{ id: Date.now()+':md', msg: JSON.stringify(payload) }, ...e]);
    });

    return () => { socket.disconnect(); };
  }, []);

  return (
    <SafeAreaView>
      <Text>Live events</Text>
      <FlatList
        data={events}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => <Text>{item.msg}</Text>}
      />
    </SafeAreaView>
  );
}
```

Notes:
- Replace `http://localhost:8080` with your server URL.
- Pass the authenticated JWT via `auth: { token: 'Bearer <JWT>' }` if your server checks auth on WS handshake.
- The backend uses `WSGateway.broadcast(topic, payload)`, so the client listens directly to those topics.

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
