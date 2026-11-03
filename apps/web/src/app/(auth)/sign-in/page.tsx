"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/features/auth/components/field";
import { GoogleButton } from "@/features/auth/components/google-button";
import { useSignIn } from "@/features/auth/hooks/use-sign-in";

export default function SignInPage() {
  const {
    email,
    setEmail,
    password,
    setPassword,
    error,
    loading,
    googleLoading,
    unverified,
    resending,
    resendVerification,
    handleSubmit,
    handleGoogle,
  } = useSignIn();

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back to K4 Bot.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            id="email"
            label="Email"
            type="email"
            value={email}
            onValue={setEmail}
            required
          />
          <Field
            id="password"
            label="Password"
            type="password"
            value={password}
            onValue={setPassword}
            required
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {unverified && (
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-sm"
              disabled={resending}
              onClick={() => void resendVerification()}
            >
              {resending && <Loader2Icon className="animate-spin" />}
              Resend the verification email
            </Button>
          )}
          <Button
            type="submit"
            className="w-full cursor-pointer"
            disabled={loading || googleLoading}
          >
            {loading && <Loader2Icon className="animate-spin" />}
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <GoogleButton
          loading={googleLoading}
          disabled={loading || googleLoading}
          onClick={handleGoogle}
        />
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/sign-up" className="underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
