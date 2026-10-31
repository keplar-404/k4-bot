"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"pending" | "success" | "error">(
    "pending",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }
    authClient.verifyEmail({ query: { token } }).then(({ error }) => {
      if (error) {
        setStatus("error");
        setMessage(error.message ?? "Verification failed");
      } else {
        setStatus("success");
        setMessage("Email verified. You can now sign in.");
      }
    });
  }, [token]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Email verification</CardTitle>
        <CardDescription>Confirming your email address.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          {status === "pending" ? "Verifying..." : message}
        </p>
        <Button
          className="w-full"
          onClick={() => router.push("/sign-in")}
          disabled={status === "pending"}
        >
          Go to sign in
        </Button>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full max-w-md" />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
