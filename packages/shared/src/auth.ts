// Neon Auth (Managed Better Auth) signs a short-lived EdDSA token for each signed-in
// user. The backend and the agent check it here, locally, against Neon's public keys
// (NEON_AUTH_JWKS_URL), so neither needs the browser's cookie.
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";

export interface AppUser {
	readonly id: string;
	readonly email: string;
}

let remote: JWTVerifyGetKey | undefined;
const neonKeys = () => {
	const url = process.env.NEON_AUTH_JWKS_URL;
	if (!url) throw new Error("NEON_AUTH_JWKS_URL is not defined");
	remote ??= createRemoteJWKSet(new URL(url)); // caches keys, re-fetches on a new key id
	return remote;
};

/**
 * The user behind an `Authorization: Bearer <token>` header, or null when the header
 * is missing or the token is forged, expired or for another auth server.
 * `key` and `issuer` are for tests; production reads them from the environment.
 */
export async function userFromBearer(
	header: string | null | undefined,
	options: { key?: JWTVerifyGetKey; issuer?: string } = {},
): Promise<AppUser | null> {
	const token = header?.match(/^Bearer (.+)$/i)?.[1];
	if (!token) return null;
	try {
		const key = options.key ?? neonKeys();
		// Neon sets both issuer and audience to the auth host's origin.
		const issuer =
			options.issuer ?? new URL(process.env.NEON_AUTH_JWKS_URL ?? "").origin;
		const { payload } = await jwtVerify(token, key, {
			algorithms: ["EdDSA"],
			issuer,
			audience: issuer,
			// A token without an expiry or subject would otherwise never expire.
			requiredClaims: ["exp", "sub"],
		});
		if (typeof payload.sub !== "string") return null;
		return { id: payload.sub, email: String(payload.email ?? "") };
	} catch {
		return null;
	}
}
