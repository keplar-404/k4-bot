"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { authClient, signIn } from "@/features/auth/auth-client";
import { safeCallback } from "@/features/auth/auth-redirect";

/** Where the visitor was going before being sent here (a same-site path only). */
const callbackTarget = () =>
  safeCallback(new URL(window.location.href).searchParams.get("callbackUrl"));

/** The sign-in form: its fields, errors and submit handlers. */
export function useSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const submittingRef = useRef(false);

  async function resendVerification() {
    setResending(true);
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}${callbackTarget()}`,
    });
    setResending(false);
    if (error) toast.error(error.message ?? "Could not send the email.");
    else
      toast.success("Verification email sent", {
        description: `Check ${email}.`,
      });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    setUnverified(false);
    try {
      const { error } = await signIn.email({ email, password });
      if (error) {
        setUnverified(error.code === "EMAIL_NOT_VERIFIED");
        setError(error.message ?? "Sign in failed");
        return;
      }
      // replace, not push: Back must not return to the sign-in form.
      router.replace(callbackTarget());
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    await signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}${callbackTarget()}`,
    });
    setGoogleLoading(false);
  }

  return {
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
  };
}
