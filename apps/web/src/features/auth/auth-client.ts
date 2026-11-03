import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:8787",
  basePath: "/api/v1/auth",
});

export const { useSession, signIn, signUp, signOut } = authClient;
