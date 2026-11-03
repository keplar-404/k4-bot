import { Hono } from "hono";
import { authGuard, type AuthGuardEnv } from "../../../middleware/auth-guard";
import list from "./list";
import manage from "./manage";

const bots = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  .route("/", list)
  .route("/", manage);

export default bots;
