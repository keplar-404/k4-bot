"use client";

import { useRef, useState } from "react";
import { signIn, signUp } from "@/features/auth/auth-client";

/** The sign-up form: its fields, errors and submit handlers. */
export function useSignUp() {
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const submittingRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      // Accounts must verify their email before they get a session, so there is
      // nothing to redirect to yet. The emailed link verifies, signs in, and
      // lands on callbackURL.
      const { error } = await signUp.email({
        name,
        email,
        password,
        callbackURL: `${window.location.origin}/dashboard`,
      });
      if (error) {
        setError(error.message ?? "Sign up failed");
        return;
      }
      setNotice(
        `We sent a verification link to ${email}. Open it to finish signing up.`,
      );
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    await signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/dashboard`,
    });
    setGoogleLoading(false);
  }

  return {
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
  };
}
