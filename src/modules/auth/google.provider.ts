import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env.config";
import logger from "../../utils/logger";

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export interface GoogleVerifiedPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/**
 * Verifies a Google id_token and returns the payload (sub, email, name, ...).
 * Throws on invalid token.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleVerifiedPayload> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error("Invalid Google token payload");
  }
  logger.info(`Google token verified for sub=${payload.sub}, email=${payload.email}`);
  return {
    sub: String(payload.sub),
    email: payload.email,
    email_verified: payload.email_verified,
    name: payload.name,
    given_name: payload.given_name,
    family_name: payload.family_name,
    picture: payload.picture,
  };
}