import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import fileUpload from 'express-fileupload';
import { env } from './config/env';
import { notFound, errorHandler } from './middleware/error';
import type { GraphQLSchema } from 'graphql';
import { graphqlHTTP } from 'express-graphql';
import { buildSchema } from 'graphql';

// Placeholder GraphQL schema (feeds only in later phases)
const schema: GraphQLSchema = buildSchema(`
  type Gist {
    gist_id: ID!
    gist_text: String!
    avitag: String!
    created_at: String!
  }

  type FeedEdge { cursor: String!, node: Gist! }
  type FeedConnection {
    edges: [FeedEdge!]!
    endCursor: String
    hasNextPage: Boolean!
  }

  input FeedFilter { campus: String, major: String, level: Int }
  enum FeedSort { LATEST, TRENDING_3D }

  type Query {
    feed(filters: FeedFilter, sort: FeedSort = LATEST, after: String, limit: Int = 10): FeedConnection!
  }
`);

const root = {
  feed: async () => ({ edges: [], endCursor: null, hasNextPage: false }),
};

const app: Express = express();

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ limits: { fileSize: 100 * 1024 * 1024 } })); // up to 100MB (videos)
app.use(morgan('dev'));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/v1', apiLimiter);

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// GraphQL (feeds only)
app.use('/graphql', graphqlHTTP({ schema, rootValue: root, graphiql: env.NODE_ENV !== 'production' }));

// TODO: mount REST routes as we implement modules

app.use(notFound);
app.use(errorHandler);

export default app;
