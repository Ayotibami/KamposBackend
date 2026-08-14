# Kampos Backend — Full Guide

This document explains everything happening inside this backend: what it is, how the data is organized, how each feature works, and every API endpoint it exposes. It's written so that both a new engineer and a non-technical teammate (product, founder, support) can read it and come away understanding how Kampos actually works under the hood.

Each section starts with a **plain-English explanation** of the idea, then follows with the **technical details** for developers.

---

## 1. What This Backend Is

Kampos is a campus-focused social app. Students (and a few other account types — creators, companies, schools, and admins) post short updates called **gists**, react to and comment on them, and can create/attend campus **events**. This backend is the server that stores all of that data, enforces the rules (who can post, what needs approval, who's allowed to moderate), and pushes live updates to everyone's app in real time.

**In technical terms:**
- **Language/runtime:** TypeScript, run on Node (despite the README mentioning Bun, it's actually started with plain `node`).
- **Web framework:** Express 5 (`src/app.ts`).
- **Database:** PostgreSQL, accessed with raw SQL via the `pg` library — there is **no ORM** (no Prisma/TypeORM/Sequelize). All tables are defined by hand-written SQL migration files in `migrations/`.
- **Cache & pub/sub:** Redis — used for revoking login sessions and broadcasting live events.
- **Real-time layer:** three different systems run side-by-side (raw WebSockets, Socket.IO, and GraphQL subscriptions) — see Section 6.
- **File storage:** Cloudinary (all images/videos — profile pictures, gist media, event thumbnails).
- **Email:** Brevo (formerly Sendinblue), sent via SMTP.
- **Validation:** Zod schemas check incoming request data before it touches the database.
- **Auth:** JSON Web Tokens (JWTs) + Argon2 password hashing.
- **Rate limiting:** one global limiter (`express-rate-limit`) on the whole `/api/v1` prefix, 600 requests per 15 minutes per IP (raised from an original 100 — that was tight enough that a normal feed session alone, between polling, media signatures, and reactions, could burn through it and start 429ing unrelated things like login, which rides this same shared bucket and has no limiter of its own).

---

## 2. The Big Picture: Accounts vs. Profiles

This is the single most important concept to understand before anything else makes sense.

**Plain-English:** When someone signs up for Kampos, they create an **account** (just an email + password, or a Google/Facebook/Apple login). That account is just the "login" — it doesn't represent a person on the app yet. Separately, they create a **profile**, which is their actual public identity — a student profile, a creator profile, a company profile, a school profile, or (for staff) an admin profile. One account can actually hold multiple profiles and switch between them, similar to how one email can have multiple personas.

**Technical details:**
- `accounts` table: holds `email`, `password_hash` (Argon2id), `auth_provider` (EMAIL/GOOGLE/FACEBOOK/APPLE), `is_otp_verified`, `account_status`.
- Five separate profile tables, each independent (no shared parent table anymore — this was refactored away):
  - `student_profiles` — regular users. Has campus, major, academic level, bio, hobbies, degree type.
  - `kreator_profiles` — content creators. Has an engagement score, an earnings balance, and a monetization flag (for a future creator-payout feature).
  - `kompany_profiles` — businesses/brands. Has website, social links, contact info.
  - `school_profiles` — official school/campus accounts.
  - `idiot_profiles` — this is the **admin/moderator** role (an internal codename, not a public-facing label). Anyone with an "idiot" profile can review reported content and approve/reject gists and profiles.
- Every profile is identified by an `avitag` — a unique handle (like a username), validated by strict rules: 4-15 characters, lowercase letters/numbers/underscores, must contain a letter, no leading/trailing/double underscores, and — as of a later addition — **can't be one of a reserved list** (`login`/`signup`/`feed`/`settings`/`gist`/`api`/`profile`/`kampos`/`kappy`/`ceo`/`admin`/`test`, `schemas/profile.ts`'s `avitagSchema`). This exists because the companion web frontend (`kampos-web`) serves a student's profile at `/avitag` with no prefix — a colliding avitag would be permanently unreachable behind that app's own static routes. Mirrors an identical client-side list in `kampos-web/src/lib/validation.ts`, kept in sync by hand; this backend check is the real enforcement point.
- Profiles link back to their account via `account_id`, but posts/comments/reactions reference profiles by `avitag` directly rather than through a formal database foreign key — the app code, not the database, is responsible for making sure an avitag is real.
- **Fetching a student profile** (`GET /profiles/students/:avitag`) now also joins in `campus_name`/`major_name` (`students/repo.ts`'s `findByAvitag`, `LEFT JOIN` on the `campus`/`major` reference tables) alongside the existing short `campus_tag`/`major_tag` — added so the frontend can show "University of Lagos" instead of the raw `unilag` tag without a separate reference-list fetch plus client-side matching.
- A JWT is minted for a specific profile at a time (see `switch-profile` endpoint) — so "who am I acting as right now" is baked into the login token.

### Step-by-step: exactly what happens when someone creates a student profile

(The other four profile types — creator, company, school, admin — follow the same shape with different fields.)

1. The person must already be logged in with an account (this creates a *profile* on top of an existing account, not a brand-new login).
2. Three fields are required: the handle (`avitag`), first name, and last name. Everything else — display name, campus, major, academic level, bio, hobbies, degree type, profile picture — is optional at creation time and can be filled in later.
3. **Handle:** unlike some systems that auto-generate a username, here the person picks their own `avitag` directly, subject to the format rules in Section 2 (there's a separate "is this handle available?" check endpoint the signup flow calls first).
4. **Profile picture:** if a photo was uploaded with the request, it's sent to Cloudinary immediately. If not, the server falls back to a URL supplied in the request, and if neither is present, falls back to a site-wide default avatar image (if one is configured).
5. **Hobbies** can be submitted a few different ways (an actual list, a comma-separated string, or a JSON-formatted string) — the server is forgiving about the exact format and normalizes it.
6. The profile is inserted into the `student_profiles` table. If the campus or major tag given doesn't actually exist in the reference lists, the database rejects it and the person gets a clear "invalid campus or major" error rather than a confusing crash.
7. **A welcome email is sent** — but it's sent "fire and forget," meaning the server doesn't wait for it to succeed before responding. If the welcome email fails for some reason, the profile is still created successfully and the person is never told the email didn't go out.
8. Newly created profiles are **not automatically verified** — verification only happens later when an admin approves them (Section 6).

---

## 3. Signing Up and Logging In

**Plain-English:** New users register with an email and password (or sign in with Google/Facebook/Apple). After registering, they get a one-time code (OTP) emailed to them that they must enter to verify their email — until they do, they're blocked from posting or reporting content. Logging in gives the app two tokens: a short-lived one used for everyday requests, and a longer-lived one used to silently refresh the short one so the user doesn't get logged out constantly.

**Technical details** (`src/modules/auth/`):
- **Register:** hashes password with Argon2id, creates the account, sends an OTP email, and issues an access+refresh token pair.
- **Login:** verifies the password; if the account isn't OTP-verified yet, it automatically resends a fresh OTP. Login is blocked if the user's `idiot` (admin) profile hasn't been verified by another admin yet.
- **Tokens:** access token expires in 15 minutes (`ACCESS_TOKEN_EXPIRES`), refresh token in 30 days (`REFRESH_TOKEN_EXPIRES_DAYS`). Each token carries a unique `jti` ID so it can be individually revoked.
- **Logout / revocation:** logging out adds the token's `jti` to a Redis-backed blacklist (`token.service.ts`). If Redis is unreachable, the system "fails open" (treats tokens as still valid) rather than locking everyone out.
- **Refresh-token rotation has a 10-second grace window** before the just-rotated old token actually gets blacklisted (`revokeToken`'s `graceSeconds` param, `token.service.ts` — only the `/auth/refresh` call site passes it; an explicit logout still revokes immediately, no grace). Fixes a real race: several requests can legitimately share the same still-valid refresh token near its access-token's 15-minute expiry (e.g. a Next.js link-prefetch and the real navigation both hitting the frontend's SSR refresh middleware around the same moment) — without the grace window, whichever one landed first would rotate+revoke the shared token, and every other one got treated as reuse of an already-revoked token and hard-logged-out, even though it belonged to the same legitimate session.
- **OTP:** 10-minute-lived codes stored in `otp_codes`, emailed via Brevo. If email isn't configured (e.g. local dev), the code is just logged to the console instead of failing.
- **Password reset:** same OTP pattern — request a code, then submit code + new password.
- **OTP mechanics, precisely:** every code is valid for exactly 10 minutes and can only be used once — the moment it's successfully verified, it's deleted from the database, so replaying the same code again fails even within the 10-minute window. If someone tries to use an expired or wrong code, they get a clear "invalid or expired code" error.
- **What happens when a protected action is blocked by verification:** actions like posting a gist require a verified email. If someone tries one of these while unverified, the server doesn't just say "no" — it automatically sends them a brand-new OTP code right then and there, and replies with "OTP verification required, a new code has been sent to your email." This is convenient, but it does mean that repeatedly hitting a protected action while unverified will repeatedly trigger new emails — worth knowing if verification emails ever seem to be "spamming" someone during testing.
- **OAuth (Google/Facebook/Apple):** each provider is verified independently — Google via `google-auth-library`, Facebook via a call to their Graph API, Apple via a hand-written JWKS/JWT verification (no SDK exists for this, so it's built manually). Successful OAuth either links to an existing account (matched by email) or creates a new one, and optionally encrypts the provider's refresh token before storing it (`oauth_sessions` table).
- **The "king" bypass:** there's a hardcoded superuser escape hatch in `src/middleware/auth.ts` — a JWT marked with `who: 'king'` is treated as a super-admin regardless of what's in the database. This is intentional but worth flagging in any security review, since it isn't a normal database-checked role.

### Step-by-step: exactly what happens when you log in

Walking through the real code path, in order:

1. You send your email and password to `POST /auth/login`.
2. The server looks up the account by email and checks the password against the stored Argon2 hash.
3. If the account hasn't verified its email yet, the server automatically fires off a fresh OTP code and tells you verification is required — you don't get logged all the way in yet.
4. If you have an admin ("idiot") profile that hasn't itself been approved by another admin, login is blocked.
5. Otherwise, the server checks one internal database field on the account called `who`. For virtually everyone this is just `'user'`. If — and only if — someone has manually set `who = 'king'` directly in the database (there is no button or endpoint that does this; it has to be done by hand, e.g. by an engineer with database access), the login response is stamped with a special `role: 'king'`.
6. Two tokens come back: a 15-minute access token and a 30-day refresh token, each with a unique ID so it can be individually revoked later.

**A subtlety worth knowing about admin access:** being listed in the `ADMIN_ACCOUNT_IDS` setting does *not* grant admin rights immediately at login — that check only happens when the app calls `/auth/refresh` or `/auth/switch-profile` afterward, which re-derives the role from that list. So a freshly logged-in admin briefly looks like a regular user until their token gets silently refreshed. Separately, once someone's refresh token has the "king" status baked into it, refreshing that token keeps carrying "king" forward without re-checking the database each time — so revoking king status for someone already holding a king-flagged token means finding and revoking that specific token, not just changing the database.

**What "logged in" actually means on every request after that:** each API request either includes a cookie or an `Authorization: Bearer <token>` header (the header path exists mainly for testing tools like Postman — the real app uses the cookie). The server:
- Rejects the request with "Unauthorized" if no token is present at all.
- Rejects with "Invalid token" if the token is malformed, expired, or has a bad signature.
- Rejects with "Token revoked" if the token was logged out / blacklisted.
- If the token is a "king" token, the server treats the request as coming from an all-powerful super-admin literally named `king` — it skips every other check (including the email-verification requirement) and lets the request through no matter what.
- Otherwise, the request proceeds as the specific logged-in profile named in the token.

Some endpoints (like viewing the public feed) use a "soft" version of this check that never rejects the request — if you're logged in it personalizes the response, and if not, it just treats you as an anonymous visitor.

---

## 4. Gists — The Core Content Type

**Plain-English:** A "gist" is Kampos's version of a post — a short piece of text, optionally with photos or a video attached. Every gist starts in a "submitted" state and isn't visible to the public feed until an admin approves it. This gives the team a manual content-moderation checkpoint before anything goes live. Users can react to gists (like/love/fire/sad/laugh), comment on them, report ones that break the rules, and see view counts.

**Technical details** (`src/modules/gist/`):
- **Lifecycle:** `gist_status` is `SUBMITTED` → `APPROVED` or `REJECTED`. Only `APPROVED` gists show in public feeds; the author and admins can still see their own regardless of status.
- **Text length limits** are enforced in application code (not the database): unverified accounts get a shorter cap (`UNVERIFIED_GIST_MAX`, 700 chars), verified accounts get more room (`VERIFIED_GIST_MAX`, 5000 chars).
- **`color_key`:** an optional, nullable field on `gists` letting a poster pick their own hero color for a short text-only gist, instead of always getting one deterministically hashed from the gist's id. Whitelisted against `GIST_COLOR_KEYS` (`gist.constants.ts`, currently `red`/`orange`/`yellow`/`green`/`teal`/`blue`/`purple`/`pink` — trimmed down from an original 12, mirrored by hand in `kampos-web/src/lib/brand.ts`) at **both** the Zod schema (`schemas/gist.ts`) and the controller (`gist.controller.ts`'s own `VALID_GIST_COLOR_KEYS` set) — belt-and-braces so it can never become a free-text field via a crafted request. Worth knowing for anyone touching `createGistSchema`: Zod's `z.object()` silently **strips** any key not explicitly declared in the schema before the controller ever sees it — this field being missing from the schema originally was the actual bug that first broke it, not the controller-side check.
- **Media:** each gist can have multiple images/videos attached (`gist_media` table), ordered by an `order_index`, uploaded to Cloudinary. Videos automatically get a generated thumbnail image, and — as of migration `0033` — the row also stores real `width`/`height` (Section 8).
- **Reactions:** one reaction per user per gist (`reactions` table has a uniqueness constraint on user+entity), type is one of LIKE/LOVE/FIRE/SAD/LAUGH. LAUGH was previously called WOW — migration `0029_rename_wow_reaction_to_laugh.sql` renamed the Postgres enum value in place (`ALTER TYPE ... RENAME VALUE`), so any reaction rows that were already WOW became LAUGH automatically rather than being orphaned. The same reactions table is also reused for comments and events.
- **Comments:** simple threaded-free comments tied to a gist, with edit tracking (`edit_count`, `edited_at`). List/fetch queries now join in each commenter's live profile data (name, avitag, image) rather than trusting a snapshot stored on the comment row.
- **Reports:** users can report a gist with a reason; reports sit in a `PENDING` queue until an admin accepts (which auto-rejects the gist) or dismisses it. Enforced as one report per (gist, reporter) at the database level (`gist_reports_gist_reporter_unique`, migration `0030`) — reporting the same gist twice no longer inflates its report count; the endpoint instead replies `"You already reported this"` with `already_reported: true` on a repeat attempt, without erroring.
- **Views:** every gist view is logged (`gist_views`), which feeds into...
- **Shares:** every real share is logged (`gist_shares`, migration `0031`) — `POST /:gist_id/share`, called by the frontend once a share actually completes (a platform link opened, or copy-link/native-share succeeded), not just when a share menu is opened. Takes an optional free-form `platform` label (`"whatsapp"`/`"x"`/`"facebook"`/`"copy_link"`/`"native"`, not enforced against a fixed list) for analytics. No dedup — sharing the same gist twice logs two rows, unlike reports. Feeds `shares_count` on `v_gist_counts`, same pattern as views.
- **Trending:** a SQL view (`v_gist_trending_3d`) computes a trending score directly in Postgres — `reactions + 2×comments` over the last 3 days. There's no separate "trending algorithm" service; it's a live database query.
- **Requires OTP verification:** creating, editing, and reporting gists all require the account to have completed email verification first.
- **Shared-link context (`GET /:gist_id/context`):** built for the frontend's public share pages — returns the target gist plus up to 15 (configurable, capped at 30) chronological neighbors before and after it in one call. The target is returned **regardless of its moderation status** (the one deliberate exception in the whole gist system — even a `REJECTED` or still-`SUBMITTED` gist resolves here, so a shared link never 401s or 404s for a stranger), while the sibling gists on either side stay `APPROVED`-only like everywhere else. Uses `fakeAuth` (attaches `req.user` if a session exists, never rejects otherwise) so guests can hit it too. Also logs a view and broadcasts `gist:viewed` on success, same as the normal single-gist view endpoint.

### Step-by-step: exactly what happens when someone posts a gist

1. **They must have an active profile selected.** If their login token isn't currently bound to a specific profile, the server rejects the request and tells them to "switch profile and retry."
2. **The text is checked.** It can't be empty, and its maximum length depends on whether their profile is verified: unverified accounts can write up to 700 characters, verified ones up to 5,000.
3. **The gist is saved to the database.** At this point it's automatically in `SUBMITTED` status — nobody but the author (and admins) can see it yet. It's tagged with the author's campus and major automatically, so it can later be filtered/searched by those.
4. **If photos or a video were attached**, each file is checked (images up to 10MB, videos up to 100MB; anything else is rejected) and uploaded to Cloudinary one at a time, keeping their order. Interestingly, if a media upload happens to fail, the gist itself is still created successfully — the text post goes through even if an attached photo didn't. Each successfully attached photo also triggers a live "media added" broadcast to anyone watching in real time.
5. **The response includes the full gist** with its (currently empty, until approved) engagement counts.

**What "submitted" really means in practice:** a gist sitting in `SUBMITTED` status is invisible in the normal public feed, search, and trending lists — those only show `APPROVED` gists (with one exception: the author can always see their own gists in their own feed/search results, regardless of status). Looking up a single gist by its ID has slightly more flexibility: the author or an admin can view it in any status; everyone else only sees it once approved.

### Step-by-step: exactly what happens when an admin approves a gist

1. An admin opens the moderation queue and approves a specific gist.
2. The gist's status flips from `SUBMITTED` to `APPROVED` directly in the database.
3. A permanent record is written to the audit log noting which admin approved which gist and when.
4. **A live notification is broadcast instantly** to every connected app (over all three real-time channels at once — see Section 7) with the message "a gist was just approved" plus the full gist data, so it can pop into people's feeds without anyone refreshing the page. Rejections work the same way but only broadcast the gist's ID, not its full contents, and a broadcast hiccup here is deliberately non-fatal — the rejection itself still goes through even if the live notification fails to send.

---

## 5. Events

**Plain-English:** Schools, companies, or students can post campus events with a title, description, date, location, and thumbnail. Other users can view them, register attendance, comment, and react — basically the same social layer as gists, but for events instead of posts.

**Technical details** (`src/modules/event/`, `event-registration/`, `event-comments/`):
- `events` table: up to 3 "host" avitags per event (`host_avi_tags`), campus/major tagging, thumbnail image.
- `event_registrations`: tracks which students signed up for which event.
- `event_comments` / reactions: mirror the gist comment/reaction system but scoped to events.
- `event_media` table exists in the database schema for multi-image events, but there's no dedicated module code handling it yet — event media may currently be handled only via the single `thumbnail_url` field.
- **Confirmed:** events only ever handle one image — a single `thumbnail` upload field (images only, max 10MB), stored to Cloudinary in a shared `kampos/events` folder (unlike gists, which get their own per-post folder) and saved as one `thumbnail_url` string. There is genuinely no gallery/multi-photo support wired up for events today, even though the database has a table ready for it — if a "swipe through event photos" feature is ever requested, the `event_media` table already exists and just needs application code written against it.

---

## 6. Moderation — The "Idiot" Admin Role

**Plain-English:** "Idiot" is the internal (slightly tongue-in-cheek) name for the admin/moderator profile type. People with this profile type get access to a review queue where they approve or reject pending gists, verify new profiles (so fake/spam accounts can't immediately look official), and resolve user reports. Every action an admin takes is written to a permanent audit trail, so there's always a record of who approved or rejected what, and why.

**Technical details** (`src/modules/idiot/`, `src/modules/audit/`):
- All moderation routes require both `isAuth` (logged in) and `isIdiot` (profile type is IDIOT, or the "king" bypass).
- Actions available: approve/reject a gist, verify/reject a profile (any of the 5 types), accept/reject a report.
- Accepting a report against a gist automatically rejects that gist and marks the report reviewed.
- Every action is logged to `audit_logs` (action type, target, admin's avitag, reason, timestamp) via a `safeAudit()` helper — if the audit write itself fails, it doesn't block the actual moderation action, it just fails silently.
- Gist approvals are broadcast live over WebSockets so connected apps update their feed instantly without refreshing.
- **Reports specifically:** when an admin "accepts" a report (agreeing the reported gist really did break the rules), two things happen in one action — the gist itself gets automatically rejected, and the report is marked reviewed. "Rejecting" a report (disagreeing with the reporter) just marks the report reviewed and leaves the gist untouched. Either way, the report leaves the pending queue.
- **Who actually gets this power:** a profile becomes an admin by being of the `IDIOT` profile type (created and verified like any other profile type, just with moderation privileges attached) — or by holding a "king" token, which bypasses the check entirely (see Section 3's login walkthrough for how rare/manual that is).

---

## 7. Real-Time Updates

**Plain-English:** When something happens — a gist gets approved, a comment is posted, a reaction is added — connected users can see it appear instantly instead of having to refresh the app. This backend actually runs **three different real-time systems at once** to support different client needs, which is unusual and worth knowing about if you're touching this code.

**Technical details** (`src/ws/`, `src/graphql/`):
1. **Raw WebSocket server** at `/ws` — a full request/response protocol over plain JSON messages, effectively mirroring much of the REST API (viewing gists, creating/listing comments and reactions) but over a persistent socket connection. Supports both logged-in and anonymous ("GUEST") connections.
2. **Socket.IO** at `/socket.io` — a simpler publish/subscribe system where clients subscribe to "topics" (rooms) and the server pushes `broadcast` events to them.
3. **GraphQL subscriptions** over `graphql-ws`, mounted at `/graphql` — lets clients subscribe to a `broadcast(topic)` feed via GraphQL syntax, backed by Redis pub/sub so it could scale across multiple server instances.

All three are fed from one central function, `WSGateway.broadcast(topic, payload)`, so a single event (like a gist getting approved) fans out to all three systems simultaneously — a connected client only needs to be listening on whichever one it prefers.

**What the raw WebSocket connection can actually do**, in plain terms: once connected, a client can ask (in real time, without a normal web request) to view a gist, and to create/fetch/list/update/delete comments and reactions, and to list/search/fetch gists including the trending list — essentially a second, live-updating copy of much of the regular API. Every one of these actions gets an immediate "ok" or "error" reply sent back to just that one client, and the ones that change data (like posting a comment) *also* trigger a broadcast to everyone else watching, plus an updated engagement-count broadcast where relevant. Connecting without logging in is allowed — you just get treated as an anonymous "guest" who can view public data but not post anything. If a connecting client's login token happens to be invalid or expired, the connection still succeeds — it just quietly becomes a guest connection rather than being rejected outright.

---

## 8. Uploading Photos & Videos

**Plain-English:** Profile pictures, gist photos/videos, and event thumbnails all get uploaded to Cloudinary, a third-party image/video hosting service — the backend never stores files on its own disk. Uploaded files go straight from memory into Cloudinary, which returns a permanent URL that gets saved to the database.

**Technical details** (`src/services/media/cloudinary.ts`):
- Uses `express-fileupload` configured to keep files in memory (not written to disk) with a 100MB request limit.
- Video uploads automatically generate a JPG thumbnail via Cloudinary's `eager` transformation.
- Each uploaded asset's Cloudinary `public_id` is stored (added specifically for gist media in migration 0019) so the file can be properly deleted from Cloudinary later, not just unlinked from the database.
- There's a special `avatar-preupload` endpoint for uploading a profile picture *before* the profile itself exists yet — useful during a multi-step signup wizard where the user picks their picture before finishing the rest of their profile.

**Gist media specifically now uploads a different way** (`media.controller.ts`'s `signature`/`finalize`, added after the note above was originally written): the file's actual bytes never touch this server or the frontend's own proxy at all — the browser uploads **directly to Cloudinary**. This exists because routing large files (especially video) through a serverless-hosted proxy hits hard platform request-size ceilings (e.g. Vercel's ~4.5MB serverless function body limit) that have nothing to do with any limit this backend configures — a real, previously-silent failure mode for anything but small images.
  - `GET /:gist_id/media/signature?resource_type=video|image` — signs a Cloudinary upload request server-side (using `CLOUDINARY_API_SECRET`, which never leaves the server), scoping the upload to this gist's own folder and, for video, requesting an eager thumbnail transformation. The browser can't redirect the upload elsewhere or skip the thumbnail — Cloudinary rejects any request whose actual params don't exactly match what was signed.
  - The browser then POSTs the file straight to Cloudinary's own API using that signature.
  - `POST /:gist_id/media/finalize` — called after the direct upload succeeds, with Cloudinary's own result (URL, `public_id`, `bytes`, `duration`). Re-validates against real policy using what Cloudinary reported — not anything the client claims — and deletes the just-uploaded asset from Cloudinary immediately if it's over the cap, rather than silently accepting it.
  - **Caps:** images 10MB; video 150MB **and** 120 seconds (both enforced — a short but huge file, or a long but small one, can each independently fail). Kampos gists are quick, in-the-moment posts, not a video platform — 2 minutes was chosen to comfortably cover a real phone-recorded clip while roughly matching Twitter/X's own *default*, non-Premium upload cap (140s), not the outlier multi-hour allowance some of their premium tiers get.
  - The older `POST /:gist_id/media` (multipart straight to this server, `GistMediaController.upload`) still exists and still works — the web frontend no longer calls it for real uploads, but it's left in place as-is (e.g. for the mobile app or any other direct API client).
  - **Ownership check (added after a real gap was caught):** every media-mutating endpoint in this controller (`signature`, `finalize`, `upload`, `attachByUrl`, `reorder`, and the media-id-scoped `update`/`remove`) now runs through one shared `assertCanEditGist()` gate first — the gist's actual owner, or an `IDIOT` (admin) profile (same bypass convention `GistController.remove` already uses), or a `403`. Previously **none** of these checked ownership at all — any logged-in user could attach, replace, reorder, or delete media on *anyone's* gist, not just their own. Live-verified: a second test account was correctly blocked (`403 "You can only manage media on your own gist"`) from a gist it didn't own, while the real owner's own requests kept working normally.

**Real media dimensions, stored and returned (migration `0033`):** `gist_media` gained nullable `width`/`height` integer columns, plumbed through every media-creation path — attached-at-gist-create, the legacy direct-upload (`GistMediaController.upload`), the `finalize` step of the direct-to-Cloudinary flow above, and now `attachByUrl` (GIF/sticker attach by URL) too, which accepts an optional `width`/`height` in the request body (same `typeof === 'number'` guard as everywhere else — GIPHY reports its own dimensions the same way Cloudinary does, so the frontend's GIF/sticker picker now sends them along). Every query that returns gist media (all ten `json_build_object(...)` call sites across `gist.repo.ts` — the main feed, trending, search, a single gist, the shared-link context, and a user's own gist list) includes them consistently. The point: a `<video>` element doesn't resolve its real dimensions until playback actually starts on most browsers, so a media tile with no known size used to visibly resize the moment someone hit play — with real dimensions available up front, the frontend can reserve the correct space before the media even loads. Nullable and backward-compatible: existing rows and anything attached without dimensions (an older GIF, pre-migration media) just fall back to the frontend's own client-side measurement, same as before this existed.

---

## 9. Email

**Plain-English:** The backend sends three kinds of emails: the OTP verification code, password reset codes, and a welcome email when someone creates a new profile.

**Technical details:**
- Sent via Brevo SMTP using `nodemailer`, with HTML templates written in Handlebars (`src/services/email/templates/`).
- If Brevo isn't configured (e.g., during local development), OTP codes are just printed to the server console instead of failing the request — a deliberate developer convenience.

---

## 10. Full API Reference

All endpoints are prefixed with `/api/v1` unless noted. "Auth required" means a valid login token must be sent; "optional auth" means the endpoint works either way but shows more/less depending on whether you're logged in.

### Auth (`/auth`)
| Method & Path | Auth | What it does |
|---|---|---|
| POST `/register` | none | Create a new account |
| POST `/login` | none | Log in, get tokens |
| POST `/refresh` | none (uses refresh token) | Get a new access token |
| POST `/logout` | required | Revoke current session |
| POST `/switch-profile` | required | Re-issue a token bound to a different profile on the same account |
| POST `/verify-otp/send` | none, rate-limited | Send/resend the email verification code |
| POST `/verify-otp` | none | Confirm the code |
| POST `/forgot-password` | none, rate-limited | Start password reset |
| POST `/reset-password` | none | Complete password reset |
| POST `/oauth/google` \| `/facebook` \| `/apple` | none | Sign in with a third-party provider |

### Account (`/account`)
| Method & Path | Auth | What it does |
|---|---|---|
| GET `/profile` | required | Get the logged-in account's info, plus `avitag`/`profileType` for whichever profile is currently active on this session's token (distinct from `profiles`, the full list of profiles the account owns) |
| PATCH `/update` | required | Change account email |
| PATCH `/change-password` | required | Change password |
| DELETE `/delete` | required | Soft-delete the account |

### Profiles (`/profiles/{students|kreators|kompanies|schools|idiots}`)
| Method & Path | Auth | What it does |
|---|---|---|
| POST `/` | required | Create a profile of this type |
| GET `/` | none | List profiles of this type |
| GET `/:avitag` | none | View one profile (students: also joins `campus_name`/`major_name` — Section 2) |
| PUT `/:avitag` | required | Update a profile |
| PATCH `/:avitag/verify` | admin only | Verify a profile |
| DELETE `/:avitag/delete` | admin only | Remove a profile |

### Profile Uploads (`/profiles`)
| Method & Path | Auth | What it does |
|---|---|---|
| POST `/upload-picture` | required | Upload/attach a profile picture |
| POST `/avatar-preupload` | required | Upload a picture before the profile exists (signup flow) |
| GET `/avitag-available/:avitag` | none | Check if a handle is free |

### Gists (`/gists`)
| Method & Path | Auth | What it does |
|---|---|---|
| POST `/` | required + verified | Create a gist (optional `color_key`, whitelisted — Section 4) |
| GET `/` | optional | List gists |
| GET `/trending` | optional | 3-day trending gists |
| GET `/search` | optional | Search gists, filter by campus/major |
| GET `/user/:avitag` | optional | Gists by a specific author |
| GET `/approved` | optional | Alias for approved gist list |
| GET `/:gist_id/counts` | none | Reaction/comment/view/report counts |
| GET `/:gist_id/context` | optional (fakeAuth) | Target gist (any status) + up to 15 chronological gists before/after it — powers shared-link pages |
| GET `/:gist_id` | optional | View one gist |
| PATCH `/:gist_id` | required + verified | Edit a gist's text |
| DELETE `/:gist_id` | required | Delete a gist (owner) |
| POST `/:gist_id/report` | required + verified | Report a gist |
| POST `/:gist_id/view` | none | Log a view |
| POST `/:gist_id/share` | optional (fakeAuth) | Log a real share, optional `{ platform }` body |
| GET/POST `/:gist_id/media` | varies | List media / upload directly through this server (legacy path, still works) |
| GET `/:gist_id/media/signature` | required | Sign a direct browser→Cloudinary upload |
| POST `/:gist_id/media/finalize` | required | Record a completed direct upload against the gist |
| POST `/:gist_id/media/url` | required | Attach media by external URL (e.g. GIF) — optional `width`/`height` (Section 8) |
| PATCH `/:gist_id/media/reorder` | required | Reorder media |
| PATCH/DELETE `/media/:media_id` | required | Edit / delete one media item |

### Comments (`/comments`)
Create, list by gist/user/batch, get one, update, delete — standard CRUD, matching the pattern above (create/update/delete require login).

### Reactions (`/reactions`)
Upsert (add or change your reaction), list by entity or user, delete by id or by entity — one reaction per user per item, enforced by the database.

### Events (`/events`), Event Registrations (`/event-registrations`), Event Comments (`/event-comments`)
Same CRUD shape as gists/comments, scoped to events instead — create/update/delete require login; viewing/listing is generally open.

### Moderation (`/idiot/moderation`) — admin only
List and approve/reject pending gists, list and verify/reject pending profiles, list and accept/reject reports.

### Misc (`/misc`)
`GET /campuses` and `GET /majors` — lookup lists used to populate dropdowns (e.g. during signup).

### Other
- `GET /`, `GET /health` — server health check, no auth.
- `/graphql` — GraphQL endpoint for read-only feed queries and live subscriptions (GraphiQL playground enabled outside production).

---

## 11. Things That Look Built But Aren't (Yet)

Worth knowing so nobody spends time debugging a feature that was never actually finished:

- **Notifications:** the README mentions a notifications feature, and a `notification_type` concept still exists, but the actual `notifications` database table was dropped early on and never rebuilt. There is no notifications code anywhere in the current backend.
- **Push notifications (Firebase):** the Firebase Admin SDK is installed and an `FCM_SERVER_KEY` setting exists, but no code actually sends a push notification anywhere.
- **Background jobs (BullMQ):** the job-queue library is installed but nothing uses it — there are no scheduled or background tasks running today.
- **Event media:** the database has a table for multiple event images (`event_media`), but there's no code wired up to use it — events currently only support a single thumbnail image.

---

## 12. Configuration (Environment Variables)

These control how the backend connects to its dependencies and behaves — actual values are kept secret and live in `.env`, never in this document.

| Variable | Purpose |
|---|---|
| `NODE_ENV`, `PORT` | Basic server setup |
| `POSTGRES_URI` | Database connection |
| `JWT_SECRET`, `ACCESS_TOKEN_EXPIRES` | Login token signing/lifetime |
| `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRES_DAYS` | Refresh token signing/lifetime |
| `CORS_ORIGIN` | Which frontend domains are allowed to call this API |
| `SERVER_BASE_URL`, `CLIENT_BASE_URL` | Reference URLs used in things like emails |
| `REDIS_URL` / `REDIS_HOST` | Redis connection (session revocation, live updates) |
| `BREVO_EMAIL`, `BREVO_PASSWORD`, `BREVO_FROM` | Outgoing email account |
| `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Image/video hosting |
| `DEFAULT_PROFILE_PIC_URL` | Fallback avatar image |
| `ADMIN_ACCOUNT_IDS` | Accounts granted elevated/admin access |
| `UNVERIFIED_GIST_MAX`, `VERIFIED_GIST_MAX` | Post length limits |
| `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET`, `APPLE_*` | Third-party sign-in credentials |
| `OAUTH_ENC_KEY` | Encrypts stored third-party login tokens |
| `SENTRY_DSN` | Error tracking — the setting exists but the Sentry error-tracking tool itself isn't installed or connected anywhere in the code; all error logging currently goes through a simple built-in logger instead |
| `FCM_SERVER_KEY` | Push notifications (configured but not actually wired into the code yet) |

---

## 13. Repository Layout

```
KamposBackend/
├── migrations/            SQL files defining every database table, applied in order
├── scripts/                Migration runner + test data seeder
├── public/                  Small static test page for trying out WebSockets
└── src/
    ├── app.ts                Express app setup, GraphQL schema, all route mounting
    ├── index.ts              Server startup, WebSocket setup, graceful shutdown
    ├── config/                Database, Redis, JWT, email, environment config
    ├── middleware/          Login checks, admin checks, OTP checks, validation, error handling
    ├── modules/               One folder per feature area (auth, account, gist, comment,
    │                          reaction, event, event-registration, event-comments,
    │                          profile/{students,kreators,kompanies,schools,idiots},
    │                          idiot moderation, misc, audit) — each has its own
    │                          routes, controller (handles requests), and repo (talks to the database)
    ├── schemas/                Zod validation rules for incoming request data
    ├── services/                Email sending and Cloudinary media upload logic
    ├── utils/                    Small helpers (logging, cookies, encryption, OTP generation)
    └── ws/                        Real-time WebSocket and Socket.IO servers
```

---

## 14. Glossary

- **Gist** — a post (Kampos's core content type).
- **Avitag** — a user's unique handle/username.
- **Profile** — a public identity (student, creator, company, school, or admin) tied to an account.
- **Account** — the private login (email + password or OAuth), can own multiple profiles.
- **Idiot** — internal codename for the admin/moderator profile type.
- **OTP** — one-time password, the numeric code emailed for verification.
- **JWT** — the signed token proving a user is logged in.
- **King** — a hardcoded superuser bypass built into the auth system.
