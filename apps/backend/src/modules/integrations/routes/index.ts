import { Hono } from "hono";
import { authGuard, type AuthGuardEnv } from "../../../middleware/auth-guard";
import mcp from "./mcp";
import skills from "./skills";

/**
 * Skills and connected apps (MCP servers) of the signed-in user. Secrets go in (encrypted at once) and never come
 * back out: responses only say whether a secret is saved and its last characters.
 */
const integrations = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  .route("/", skills)
  .route("/", mcp);

export default integrations;
