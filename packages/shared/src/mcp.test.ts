import { expect, test } from "bun:test";
import { checkMcpUrl, keyHeader, openKey, privateIp, sealKey } from "./mcp";

process.env.MCP_SECRET_KEY = Buffer.alloc(32, 7).toString("base64");

test("a sealed key opens only for its user and server", () => {
	const s = sealKey("sk-123", "u1", "docs");
	expect(s).not.toContain("sk-123");
	expect(openKey(s, "u1", "docs")).toBe("sk-123");
	expect(() => openKey(s, "u2", "docs")).toThrow();
	expect(() => openKey(s, "u1", "other")).toThrow();
});

test("private addresses and non-https URLs are refused", async () => {
	for (const ip of [
		"127.0.0.1",
		"10.1.2.3",
		"169.254.169.254",
		"192.168.0.1",
		"::1",
		"fd00::1",
		"::ffff:127.0.0.1",
	])
		expect(privateIp(ip)).toBe(true);
	expect(privateIp("8.8.8.8")).toBe(false);
	expect(await checkMcpUrl("http://example.com/mcp")).not.toBeNull();
	expect(await checkMcpUrl("http://localhost:3001/mcp")).toBeNull(); // dev only
	process.env.NODE_ENV = "production";
	expect(await checkMcpUrl("http://localhost:3001/mcp")).not.toBeNull();
	expect(await checkMcpUrl("https://localhost/mcp")).not.toBeNull();
	expect(await checkMcpUrl("https://169.254.169.254/")).not.toBeNull();
	expect(await checkMcpUrl("https://a:b@example.com/")).not.toBeNull();
});

test("key header", () => {
	expect(keyHeader("Authorization", "abc")).toEqual({
		Authorization: "Bearer abc",
	});
	expect(keyHeader("x-api-key", "abc")).toEqual({ "x-api-key": "abc" });
});
