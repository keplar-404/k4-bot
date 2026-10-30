import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors";
import routes from "./routes";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use("*", corsMiddleware);
app.route("/", routes);

export default app;