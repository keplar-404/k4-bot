import { Hono } from "hono";
import { authGuard, type AuthGuardEnv } from "../../middleware/auth-guard";
import threads from "./threads";
import runs from "./runs";
import realtime from "./realtime";

const chat = new Hono<AuthGuardEnv>()
  .use("*", async (c, next) => {
    // The WS upgrade authenticates with its own short-lived signed token;
    // browsers cannot attach an Authorization header to a WebSocket.
    if (c.req.method === "GET" && c.req.path.endsWith("/ws")) return next();
    return authGuard(c, next);
  })
  .route("/", threads)
  .route("/", runs)
  .route("/", realtime);

export default chat;
