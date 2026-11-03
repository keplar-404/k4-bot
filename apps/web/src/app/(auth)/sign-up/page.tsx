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
import { useSignUp } from "@/features/auth/hooks/use-sign-up";

export default function SignUpPage() {
  const {
    notice,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    error,
    loading,
    googleLoading,
    handleSubmit,
    handleGoogle,
  } = useSignUp();

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Get started with K4 Bot.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            id="name"
            label="Name"
            value={name}
            onValue={setName}
            required
          />
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
            minLength={8}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
          <Button
            type="submit"
            className="w-full cursor-pointer"
            disabled={loading || googleLoading}
          >
            {loading && <Loader2Icon className="animate-spin" />}
            {loading ? "Creating..." : "Create account"}
          </Button>
        </form>
        <GoogleButton
          loading={googleLoading}
          disabled={loading || googleLoading}
          onClick={handleGoogle}
        />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
