import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import fileUpload from 'express-fileupload';
import { env } from './config/env';
import { notFound, errorHandler } from './middleware/error';
import gistRoutes from './modules/gist/gist.routes';
import authRoutes from './modules/auth/auth.routes';
import accountRoutes from './modules/account/account.routes';
// Separated profile routes
import studentProfileRoutes from './modules/profile/students/routes';
import kreatorProfileRoutes from './modules/profile/kreators/routes';
import kompanyProfileRoutes from './modules/profile/kompanies/routes';
import schoolProfileRoutes from './modules/profile/schools/routes';
import idiotProfileRoutes from './modules/profile/idiots/routes';
import profileUploadRoutes from './modules/profile/upload.routes';
import moderationRoutes from './modules/idiot/moderation.routes';
import commentRoutes from './modules/comment/comment.routes';
import reactionRoutes from './modules/reaction/reaction.routes';
import eventRoutes from './modules/event/event.routes';
import registrationRoutes from './modules/event-registration/registration.routes';
import eventCommentRoutes from './modules/event-comments/event_comment.routes';
// rebuilt gist module mounts its own media handling inline; no separate media routes
import type { GraphQLSchema } from 'graphql';
import { graphqlHTTP } from 'express-graphql';
import { buildSchema } from 'graphql';
import { GistService } from './modules/gist/gist.service';
import * as CommentRepo from './modules/comment/comment.repo';
import * as ReactionRepo from './modules/reaction/reaction.repo';
import { PubSub } from './graphql/pubsub';
import { fakeAuth } from './middleware/auth';
import path from 'path';
import miscRoutes from './modules/misc/misc.routes';
import { mkdirSync } from 'fs';

// GraphQL schema (queries only; subscriptions can be added later with Apollo)
export const schema: GraphQLSchema = buildSchema(`
  enum ReactionEntity { GIST COMMENT }
  enum ReactionType { LIKE LOVE FIRE SAD LAUGH }

  type GistMedia { 
    media_id: ID!
    gist_id: ID!
    order_index: Int!
    media_type: String!
    media_url: String!
    thumbnail_url: String
    uploaded_at: String!
    edited_at: String
  }

  type Counts {
    gist_id: ID!
    reactions_count: Int!
    comments_count: Int!
    views_count: Int!
    reports_count: Int!
  }

  type Gist {
    gist_id: ID!
    avitag: String!
    gist_text: String!
    created_at: String!
    edited_at: String
    edit_count: Int!
    is_reported: Boolean!
    media: [GistMedia!]!
  }

  type Comment {
    comment_id: ID!
    gist_id: ID!
    avitag: String
    text: String!
    commented_at: String!
    edited_at: String
    edit_count: Int!
  }

  type Reaction {
    reaction_id: ID!
    avitag: String!
    entity_type: ReactionEntity!
    entity_id: ID!
    type: ReactionType!
    created_at: String!
  }

  type Broadcast {
    topic: String!
    payload: String!
  }

  type Query {
    gist(id: ID!): Gist
    gists(limit: Int = 20, cursor: ID): [Gist!]!
    counts(gist_id: ID!): Counts
    commentsByGist(gist_id: ID!, limit: Int = 20, cursor: ID): [Comment!]!
    reactionsByEntity(entity_type: ReactionEntity!, entity_id: ID!): [Reaction!]!
    mediaByGist(gist_id: ID!): [GistMedia!]!
  }

  type Subscription {
    broadcast(topic: String!): Broadcast!
  }
`);

export const root = {
  gist: async ({ id }: { id: string }, req: any) => {
    // Use viewer avitag to allow owner to see unapproved
    const approved = await GistService.findWithCounts(id);
    if (approved) return approved;
    const any = await GistService.findWithCountsAnyStatus(id);
    const isOwner = req?.user?.avitag && any && req.user.avitag === any.avitag;
    const isAdmin = req?.user?.role === 'IDIOT';
    return (isOwner || isAdmin) ? any : null;
  },
  gists: async ({ limit, cursor }: { limit?: number; cursor?: string }, req: any) => {
    return GistService.listRecent(limit, cursor, req?.user?.avitag);
  },
  counts: async ({ gist_id }: { gist_id: string }) => GistService.getCounts(gist_id),
  commentsByGist: async ({ gist_id, limit, cursor }: { gist_id: string; limit?: number; cursor?: string }) =>
    CommentRepo.listByGist(gist_id, limit, cursor),
  reactionsByEntity: async ({ entity_type, entity_id }: { entity_type: ReactionRepo.ReactionEntity; entity_id: string }) =>
    ReactionRepo.listByEntity(entity_type, entity_id),
  // mediaByGist: async ({ gist_id }: { gist_id: string }) => GistMediaRepo.listByGist(gist_id),
  // Subscriptions
  broadcast: ({ topic }: { topic: string }) => {
    const iter = PubSub.asyncIterator<any>(`broadcast:${topic}`) as any;
    const map = async function* () {
      for await (const payload of iter as AsyncIterable<any>) {
        yield { topic, payload: JSON.stringify(payload ?? {}) };
      }
    };
    return map();
  },
};

const app: Express = express();

// Cookie-based auth needs a real origin allow-list, not "*" — browsers
// reject Access-Control-Allow-Origin: * combined with credentials: true.
// CORS_ORIGIN supports a comma-separated list so both a local dev frontend
// and a deployed one can be allowed at once.
const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header (server-to-server calls, curl, Postman) — allow.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ limits: { fileSize: 100 * 1024 * 1024 } })); // up to 100MB (videos)
app.use(morgan('dev'));
// Static assets
app.use(express.static(path.join(process.cwd(), 'public')));

// 100 req/15min was shared across the *entire* API by one IP-keyed bucket —
// tight enough that a normal feed session (polling, media signatures,
// reactions) could burn through it and start 429ing unrelated things like
// login, which has no rate limiter of its own and rides this same bucket.
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 600 });
app.use('/api/v1', apiLimiter);

// Health
app.get('/', (_req, res) => res.json({ ok: true, message: "Welcome to Kampos Backend!!!" }));
app.get('/health', (_req, res) => res.json({ ok: true }));

// GraphQL (feeds only)
app.use('/graphql', fakeAuth as any, graphqlHTTP({ schema, rootValue: root, graphiql: env.NODE_ENV !== 'production' }));

app.use('/api/v1/misc', miscRoutes);
// REST routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/account', accountRoutes);
app.use('/api/v1/profiles/students', studentProfileRoutes);
app.use('/api/v1/profiles/kreators', kreatorProfileRoutes);
app.use('/api/v1/profiles/kompanies', kompanyProfileRoutes);
app.use('/api/v1/profiles/schools', schoolProfileRoutes);
app.use('/api/v1/profiles/idiots', idiotProfileRoutes);
app.use('/api/v1/profiles', profileUploadRoutes);
app.use('/api/v1/gists', gistRoutes);
app.use('/api/v1/comments', commentRoutes);
app.use('/api/v1/reactions', reactionRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/event-registrations', registrationRoutes);
app.use('/api/v1/event-comments', eventCommentRoutes);
app.use('/api/v1/idiot/moderation', moderationRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
