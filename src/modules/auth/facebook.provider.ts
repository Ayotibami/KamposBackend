import fetch from "node-fetch";

export interface FacebookVerifiedPayload {
  id: string;
  email?: string;
  name?: string;
}

/**
 * Verifies a Facebook user access token via Graph API and returns basic profile.
 * Throws on invalid token / non-200 response.
 */
export async function verifyFacebookAccessToken(accessToken: string): Promise<FacebookVerifiedPayload> {
  const url = `https://graph.facebook.com/me?fields=id,email,name&access_token=${encodeURIComponent(
    accessToken
  )}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Facebook token verification failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as any;
  if (!data || !data.id) throw new Error("Invalid Facebook token payload");

  return {
    id: String(data.id),
    email: data.email,
    name: data.name,
  };
}