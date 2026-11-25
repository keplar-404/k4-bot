import { expect, test } from "bun:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { userFromBearer } from "./auth";

const issuer = "https://auth.example";
const { publicKey, privateKey } = await generateKeyPair("EdDSA");
const other = await generateKeyPair("EdDSA");
const sign = (key = privateKey, over: { iss?: string; exp?: string } = {}) =>
	new SignJWT({ email: "a@b.c" })
		.setProtectedHeader({ alg: "EdDSA" })
		.setSubject("user-1")
		.setIssuer(over.iss ?? issuer)
		.setAudience(issuer)
		.setExpirationTime(over.exp ?? "5m")
		.sign(key);
const check = async (token: string) =>
	userFromBearer(`Bearer ${token}`, { key: async () => publicKey, issuer });

test("a valid token gives the user", async () => {
	expect(await check(await sign())).toEqual({ id: "user-1", email: "a@b.c" });
	await exportJWK(publicKey); // the key shape Neon publishes
});

test("missing, forged, expired and foreign tokens give nobody", async () => {
	expect(await userFromBearer(undefined)).toBeNull();
	expect(await userFromBearer("Basic abc")).toBeNull();
	expect(await check(await sign(other.privateKey))).toBeNull(); // wrong signer
	expect(await check(await sign(privateKey, { exp: "-1m" }))).toBeNull();
	expect(
		await check(await sign(privateKey, { iss: "https://evil" })),
	).toBeNull();
	const noExpiry = await new SignJWT({})
		.setProtectedHeader({ alg: "EdDSA" })
		.setSubject("user-1")
		.setIssuer(issuer)
		.setAudience(issuer)
		.sign(privateKey);
	expect(await check(noExpiry)).toBeNull();
});
