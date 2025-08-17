import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { env } from "../../config/env.config";
import { loadApplePrivateKey } from "../../config/appleKey";

export interface AppleTokenResponse {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
  error?: string;
}

/**
 * Generate client secret (JWT) to authenticate with Apple's token endpoint.
 * Uses ES256, header must include kid.
 */
export function generateAppleClientSecret(): string {
  const privateKey = loadApplePrivateKey();
  const now = Math.floor(Date.now() / 1000);

  const claims = {
    iss: env.APPLE_TEAM_ID,
    iat: now,
    exp: now + 60 * 60 * 24 * 180, // valid up to 6 months (tune as needed)
    aud: "https://appleid.apple.com",
    sub: env.APPLE_CLIENT_ID,
  };

  const header = {
    alg: "ES256",
    kid: env.APPLE_KEY_ID,
  };

  // NOTE: jwt.sign will sign with ES256 using the provided private key PEM
  return jwt.sign(claims as any, privateKey, { algorithm: "ES256", header });
}

/**
 * Exchange an authorization code for tokens at Apple's token endpoint.
 * Returns parsed JSON (may contain id_token).
 */
export async function exchangeAppleAuthCode(code: string): Promise<AppleTokenResponse> {
  const clientSecret = generateAppleClientSecret();

  const body = new URLSearchParams({
    client_id: env.APPLE_CLIENT_ID,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = (await res.json()) as AppleTokenResponse;
  if (!res.ok) {
    throw new Error(`Apple token exchange failed: ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

/**
 * Very small verifier: decodes id_token and returns payload.
 * NOTE: Proper production verification should validate signature using Apple's JWKS.
 * This helper is useful after exchange to extract sub/email/name, but consider full verification.
 */
export function decodeAppleIdToken(idToken: string): any {
  const decoded = jwt.decode(idToken, { json: true });
  if (!decoded) throw new Error("Invalid Apple id_token");
  return decoded;
}