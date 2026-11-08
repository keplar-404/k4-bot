import { Hono } from "hono";
import { z } from "zod";
import { authGuard, type AuthGuardEnv } from "../../middleware/auth-guard";
import { userLimit } from "../../middleware/rate-limit";
import { getRequestContext } from "../../shared/context";
import { secretHint, SecretsUnavailableError } from "../../shared/secrets";
import { validate } from "../../shared/validate";
import { deleteSecret, listSecrets, MAX_SECRETS, SECRET_NAME, saveSecret, workflowsUsingSecret } from "./store";

const nameParam = z.object({ name: z.string().regex(SECRET_NAME) });
const putBody = z.object({
  value: z.string().min(1).max(4096),
  label: z.string().max(120).default(""),
});

/** The user's secrets vault (/api/v1/secrets). Values go in encrypted and never come back: only names and a hint. */
const secrets = new Hono<AuthGuardEnv>()
  .use("*", authGuard)
  .get("/", async (c) => {
    const { db } = getRequestContext(c);
    const items = await listSecrets(db, c.get("session").user.id);
    c.header("Cache-Control", "no-store");
    return c.json({ items });
  })

  .put("/:name", userLimit, validate("param", nameParam), validate("json", putBody), async (c) => {
    const { db, env } = getRequestContext(c);
    const { name } = c.req.valid("param");
    const { value, label } = c.req.valid("json");

    let saved: Awaited<ReturnType<typeof saveSecret>>;
    try {
      saved = await saveSecret(env, db, c.get("session").user.id, { name, label, value });
    } catch (error) {
      if (error instanceof SecretsUnavailableError) {
        return c.json({ error: "NOT_CONFIGURED", message: "Secrets are not set up on this server." }, 503);
      }
      console.error("[secrets] save failed", error);
      return c.json({ error: "SERVER_ERROR", message: "Could not save the secret. Try again." }, 500);
    }

    if (saved === "limit") {
      return c.json({ error: "LIMIT", message: `You can save up to ${MAX_SECRETS} secrets.` }, 409);
    }
    return c.json({ ok: true, name, hint: secretHint(value) }, saved === "created" ? 201 : 200);
  })

  .delete("/:name", userLimit, validate("param", nameParam), async (c) => {
    const { db } = getRequestContext(c);
    const userId = c.get("session").user.id;
    const { name } = c.req.valid("param");

    const usedBy = await workflowsUsingSecret(db, userId, name);
    if (usedBy.length > 0) {
      const message = `Used by ${usedBy.join(", ")}. Turn those workflows off first.`;
      return c.json({ error: "IN_USE", message }, 409);
    }
    if (!(await deleteSecret(db, userId, name))) {
      return c.json({ error: "NOT_FOUND", message: "Secret not found." }, 404);
    }
    return c.json({ ok: true });
  });

export default secrets;
