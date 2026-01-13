"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.root = exports.schema = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const env_1 = require("./config/env");
const error_1 = require("./middleware/error");
const gist_routes_1 = __importDefault(require("./modules/gist/gist.routes"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const account_routes_1 = __importDefault(require("./modules/account/account.routes"));
// Separated profile routes
const routes_1 = __importDefault(require("./modules/profile/students/routes"));
const routes_2 = __importDefault(require("./modules/profile/kreators/routes"));
const routes_3 = __importDefault(require("./modules/profile/kompanies/routes"));
const routes_4 = __importDefault(require("./modules/profile/schools/routes"));
const routes_5 = __importDefault(require("./modules/profile/idiots/routes"));
const upload_routes_1 = __importDefault(require("./modules/profile/upload.routes"));
const moderation_routes_1 = __importDefault(require("./modules/idiot/moderation.routes"));
const comment_routes_1 = __importDefault(require("./modules/comment/comment.routes"));
const reaction_routes_1 = __importDefault(require("./modules/reaction/reaction.routes"));
const event_routes_1 = __importDefault(require("./modules/event/event.routes"));
const registration_routes_1 = __importDefault(require("./modules/event-registration/registration.routes"));
const event_comment_routes_1 = __importDefault(require("./modules/event-comments/event_comment.routes"));
const express_graphql_1 = require("express-graphql");
const graphql_1 = require("graphql");
const gist_service_1 = require("./modules/gist/gist.service");
const CommentRepo = __importStar(require("./modules/comment/comment.repo"));
const ReactionRepo = __importStar(require("./modules/reaction/reaction.repo"));
const pubsub_1 = require("./graphql/pubsub");
const auth_1 = require("./middleware/auth");
const path_1 = __importDefault(require("path"));
const misc_routes_1 = __importDefault(require("./modules/misc/misc.routes"));
// GraphQL schema (queries only; subscriptions can be added later with Apollo)
exports.schema = (0, graphql_1.buildSchema)(`
  enum ReactionEntity { GIST COMMENT }
  enum ReactionType { LIKE LOVE FIRE SAD WOW }

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
exports.root = {
    gist: async ({ id }, req) => {
        // Use viewer avitag to allow owner to see unapproved
        const approved = await gist_service_1.GistService.findWithCounts(id);
        if (approved)
            return approved;
        const any = await gist_service_1.GistService.findWithCountsAnyStatus(id);
        const isOwner = req?.user?.avitag && any && req.user.avitag === any.avitag;
        const isAdmin = req?.user?.role === 'IDIOT';
        return (isOwner || isAdmin) ? any : null;
    },
    gists: async ({ limit, cursor }, req) => {
        return gist_service_1.GistService.listRecent(limit, cursor, req?.user?.avitag);
    },
    counts: async ({ gist_id }) => gist_service_1.GistService.getCounts(gist_id),
    commentsByGist: async ({ gist_id, limit, cursor }) => CommentRepo.listByGist(gist_id, limit, cursor),
    reactionsByEntity: async ({ entity_type, entity_id }) => ReactionRepo.listByEntity(entity_type, entity_id),
    // mediaByGist: async ({ gist_id }: { gist_id: string }) => GistMediaRepo.listByGist(gist_id),
    // Subscriptions
    broadcast: ({ topic }) => {
        const iter = pubsub_1.PubSub.asyncIterator(`broadcast:${topic}`);
        const map = async function* () {
            for await (const payload of iter) {
                yield { topic, payload: JSON.stringify(payload ?? {}) };
            }
        };
        return map();
    },
};
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: env_1.env.CORS_ORIGIN, credentials: true }));
app.use((0, helmet_1.default)());
app.use(express_1.default.json({ limit: '2mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, express_fileupload_1.default)({ limits: { fileSize: 100 * 1024 * 1024 } })); // up to 100MB (videos)
app.use((0, morgan_1.default)('dev'));
// Static assets
app.use(express_1.default.static(path_1.default.join(process.cwd(), 'public')));
const apiLimiter = (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/v1', apiLimiter);
// Health
app.get('/', (_req, res) => res.json({ ok: true, message: "Welcome to Kampos Backend!!!" }));
app.get('/health', (_req, res) => res.json({ ok: true }));
// GraphQL (feeds only)
app.use('/graphql', auth_1.fakeAuth, (0, express_graphql_1.graphqlHTTP)({ schema: exports.schema, rootValue: exports.root, graphiql: env_1.env.NODE_ENV !== 'production' }));
app.use('/api/v1/misc', misc_routes_1.default);
// REST routes
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/account', account_routes_1.default);
app.use('/api/v1/profiles/students', routes_1.default);
app.use('/api/v1/profiles/kreators', routes_2.default);
app.use('/api/v1/profiles/kompanies', routes_3.default);
app.use('/api/v1/profiles/schools', routes_4.default);
app.use('/api/v1/profiles/idiots', routes_5.default);
app.use('/api/v1/profiles', upload_routes_1.default);
app.use('/api/v1/gists', gist_routes_1.default);
app.use('/api/v1/comments', comment_routes_1.default);
app.use('/api/v1/reactions', reaction_routes_1.default);
app.use('/api/v1/events', event_routes_1.default);
app.use('/api/v1/event-registrations', registration_routes_1.default);
app.use('/api/v1/event-comments', event_comment_routes_1.default);
app.use('/api/v1/idiot/moderation', moderation_routes_1.default);
app.use(error_1.notFound);
app.use(error_1.errorHandler);
exports.default = app;
