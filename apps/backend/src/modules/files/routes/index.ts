import { Hono } from "hono";
import { authGuard, type AuthGuardEnv } from "../../../middleware/auth-guard";
import browse from "./browse";
import upload from "./upload";

/**
 * The user's files: uploads, images bots created, and files bots shared from the computer.
 * Every route is the signed-in user's own files only; bytes are served from R2, never from the computer.
 */
const files = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  .use("*", async (c, next) => {
    if (!c.env.FILES) return c.json({ error: "UNAVAILABLE", message: "File storage is not configured." }, 503);
    await next();
  })
  .route("/", upload)
  .route("/", browse);

export default files;
