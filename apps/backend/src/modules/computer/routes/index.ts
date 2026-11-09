import { Hono } from "hono";
import { authGuard, type AuthGuardEnv } from "../../../middleware/auth-guard";
import accounts from "./accounts";
import appLogin from "./app-login";
import control from "./control";
import stream from "./stream";
import viewer from "./viewer";

/**
 * The user's computer, from the browser's side.
 *
 * Nothing here talks to E2B directly: every call goes to the user's own
 * UserComputer Durable Object (one per user, named by user id), so a user can
 * only ever reach their own computer.
 */
const computer = new Hono<AuthGuardEnv>()
  .use("*", async (c, next) => {
    // The panel socket and the live-view proxy carry their own signed, short-lived tokens.
    const path = c.req.path;
    if (path.endsWith("/computer/ws") || path.includes("/computer/stream/")) return next();
    return authGuard(c, next);
  })
  .route("/", control)
  .route("/", accounts)
  .route("/", appLogin)
  .route("/", viewer)
  .route("/", stream);

export default computer;
