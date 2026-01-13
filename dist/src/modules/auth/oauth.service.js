import { OAuth2Client } from 'google-auth-library';
import fetch from 'node-fetch';
import * as accountRepo from '../account/account.repo';
import * as oauthRepo from './oauth.repo';
import { signToken } from '../../config/jwt';
import { env } from '../../config/env';
import { encrypt } from '../../utils/crypto';
import jwt, {} from 'jsonwebtoken';
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
export const OAuthService = {
    googleLogin: async (params) => {
        const ticket = await googleClient.verifyIdToken({ idToken: params.id_token, audience: env.GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload || !payload.sub) {
            throw Object.assign(new Error('Invalid Google token'), { statusCode: 401 });
        }
        const oauth_id = `google:${payload.sub}`;
        const email = (payload.email || null);
        let account = await accountRepo.findAccountByOauth(oauth_id);
        if (!account) {
            // If an account exists with this email (EMAIL provider), link it; otherwise create new OAuth account
            account = email ? await accountRepo.findAccountByEmail(email) : null;
            if (account) {
                await accountRepo.linkOauthToAccount(account.account_id, 'GOOGLE', oauth_id);
            }
            else {
                account = await accountRepo.createAccountOAuth(email, 'GOOGLE', oauth_id);
            }
        }
        // Store refresh token if provided
        if (params.refresh_token) {
            const enc = env.OAUTH_ENC_KEY ? encrypt(params.refresh_token) : params.refresh_token;
            await oauthRepo.createOrUpdateSession({
                account_id: account.account_id,
                auth_provider: 'GOOGLE',
                encrypted_refresh_token: enc || null,
                token_expires_at: params.refresh_expires_at ?? null,
            });
        }
        await accountRepo.updateLastLogin(account.account_id);
        const token = signToken({ account_id: account.account_id, is_otp_verified: true, role: 'USER' });
        return { account, token };
    },
    facebookLogin: async (params) => {
        // Basic validation of token by hitting Facebook Graph API for the user profile
        const resp = await fetch(`https://graph.facebook.com/me?fields=id,email&access_token=${encodeURIComponent(params.access_token)}`);
        if (!resp.ok) {
            throw Object.assign(new Error('Invalid Facebook token'), { statusCode: 401 });
        }
        const data = await resp.json();
        if (!data || !data.id) {
            throw Object.assign(new Error('Invalid Facebook token payload'), { statusCode: 401 });
        }
        const oauth_id = `facebook:${data.id}`;
        const email = data.email ?? null;
        let account = await accountRepo.findAccountByOauth(oauth_id);
        if (!account) {
            account = email ? await accountRepo.findAccountByEmail(email) : null;
            if (account) {
                await accountRepo.linkOauthToAccount(account.account_id, 'FACEBOOK', oauth_id);
            }
            else {
                account = await accountRepo.createAccountOAuth(email, 'FACEBOOK', oauth_id);
            }
        }
        if (params.refresh_token) {
            const enc = env.OAUTH_ENC_KEY ? encrypt(params.refresh_token) : params.refresh_token;
            await oauthRepo.createOrUpdateSession({
                account_id: account.account_id,
                auth_provider: 'FACEBOOK',
                encrypted_refresh_token: enc || null,
                token_expires_at: params.refresh_expires_at ?? null,
            });
        }
        await accountRepo.updateLastLogin(account.account_id);
        const token = signToken({ account_id: account.account_id, is_otp_verified: true, role: 'USER' });
        return { account, token };
    },
    appleLogin: async (params) => {
        // Verify Apple identity token signature using Apple's JWKS
        const jwks = await getAppleJWKS();
        const decodedHeader = decodeJwtHeader(params.identity_token);
        const kid = decodedHeader.kid;
        const key = jwks.keys.find((k) => k.kid === kid);
        if (!key) {
            throw Object.assign(new Error('Apple key not found'), { statusCode: 401 });
        }
        const pubKey = jwkToPem(key);
        let payload;
        try {
            payload = jwt.verify(params.identity_token, pubKey, {
                algorithms: ['RS256'],
                audience: env.APPLE_CLIENT_ID,
                issuer: 'https://appleid.apple.com',
            });
        }
        catch (_e) {
            throw Object.assign(new Error('Invalid Apple token'), { statusCode: 401 });
        }
        if (!payload || !payload.sub) {
            throw Object.assign(new Error('Invalid Apple token payload'), { statusCode: 401 });
        }
        const oauth_id = `apple:${payload.sub}`;
        // Email may be absent depending on Apple privacy settings
        const email = payload.email ?? null;
        let account = await accountRepo.findAccountByOauth(oauth_id);
        if (!account) {
            account = email ? await accountRepo.findAccountByEmail(email) : null;
            if (account) {
                await accountRepo.linkOauthToAccount(account.account_id, 'APPLE', oauth_id);
            }
            else {
                account = await accountRepo.createAccountOAuth(email, 'APPLE', oauth_id);
            }
        }
        if (params.refresh_token) {
            const enc = env.OAUTH_ENC_KEY ? encrypt(params.refresh_token) : params.refresh_token;
            await oauthRepo.createOrUpdateSession({
                account_id: account.account_id,
                auth_provider: 'APPLE',
                encrypted_refresh_token: enc || null,
                token_expires_at: params.refresh_expires_at ?? null,
            });
        }
        await accountRepo.updateLastLogin(account.account_id);
        const token = signToken({ account_id: account.account_id, is_otp_verified: true, role: 'USER' });
        return { account, token };
    },
};
// --- Apple JWKS helpers ---
let _appleJWKSCache = null;
async function getAppleJWKS() {
    const now = Date.now();
    if (_appleJWKSCache && now - _appleJWKSCache.fetchedAt < 6 * 60 * 60 * 1000) {
        return { keys: _appleJWKSCache.keys };
    }
    const resp = await fetch('https://appleid.apple.com/auth/keys');
    if (!resp.ok)
        throw new Error('Failed to fetch Apple JWKS');
    const data = await resp.json();
    _appleJWKSCache = { keys: data.keys || [], fetchedAt: now };
    return { keys: _appleJWKSCache.keys };
}
function decodeJwtHeader(token) {
    const [h] = token.split('.');
    const header = JSON.parse(Buffer.from(h, 'base64').toString('utf8'));
    return header;
}
function jwkToPem(jwk) {
    // Minimal conversion for RSA public keys (n, e)
    const { n, e } = jwk;
    const pubKey = rsaPublicKeyPem(n, e);
    return pubKey;
}
function base64ToBufferUrl(b64url) {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(b64, 'base64');
}
function rsaPublicKeyPem(modulusB64Url, exponentB64Url) {
    // Build ASN.1 DER sequence for RSA public key and convert to PEM
    const modulus = base64ToBufferUrl(modulusB64Url);
    const exponent = base64ToBufferUrl(exponentB64Url);
    function derLength(len) {
        if (len < 0x80)
            return Buffer.from([len]);
        const hex = len.toString(16);
        const bytes = Math.ceil(hex.length / 2);
        return Buffer.concat([Buffer.from([0x80 | bytes]), Buffer.from(hex.padStart(bytes * 2, '0'), 'hex')]);
    }
    function derInteger(buf) {
        if (buf[0] & 0x80)
            buf = Buffer.concat([Buffer.from([0x00]), buf]);
        return Buffer.concat([Buffer.from([0x02]), derLength(buf.length), buf]);
    }
    const seq = Buffer.concat([
        derInteger(modulus),
        derInteger(exponent),
    ]);
    const derPubKey = Buffer.concat([Buffer.from([0x30]), derLength(seq.length), seq]);
    // Add ASN.1 SubjectPublicKeyInfo wrapper for RSA
    const rsaOid = Buffer.from('300d06092a864886f70d0101010500', 'hex');
    const bitString = Buffer.concat([Buffer.from([0x03]), derLength(derPubKey.length + 1), Buffer.from([0x00]), derPubKey]);
    const spki = Buffer.concat([Buffer.from([0x30]), derLength(rsaOid.length + bitString.length), rsaOid, bitString]);
    const pem = '-----BEGIN PUBLIC KEY-----\n' + spki.toString('base64').match(/.{1,64}/g).join('\n') + '\n-----END PUBLIC KEY-----\n';
    return pem;
}
