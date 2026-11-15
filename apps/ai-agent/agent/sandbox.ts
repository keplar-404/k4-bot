import { defineSandbox } from "eve/sandbox";
import { E2BSandbox } from "./lib/e2b-sandbox";

export const environment = E2BSandbox.environment({});

export default defineSandbox(() => environment.open());
