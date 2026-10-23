"use server";

import { redirect } from "next/navigation";
import { tryGetSupabasePublicEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error: string | null;
  fieldErrors?: {
    email?: string;
    password?: string;
    displayName?: string;
  };
};

function validateEmail(email: string): string | null {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address.";
  }
  return null;
}

function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/chat");

  const fieldErrors = {
    email: validateEmail(email) ?? undefined,
    password: validatePassword(password) ?? undefined,
  };

  if (fieldErrors.email || fieldErrors.password) {
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  if (!tryGetSupabasePublicEnv()) {
    return {
      error:
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(next.startsWith("/") ? next : "/chat");
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  const fieldErrors = {
    email: validateEmail(email) ?? undefined,
    password: validatePassword(password) ?? undefined,
    displayName:
      displayName.length < 1 || displayName.length > 80
        ? "Display name must be 1–80 characters."
        : undefined,
  };

  if (fieldErrors.email || fieldErrors.password || fieldErrors.displayName) {
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  if (!tryGetSupabasePublicEnv()) {
    return {
      error:
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.",
    };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is disabled, session exists immediately.
  if (data.session) {
    redirect("/chat");
  }

  redirect("/login?message=Check your email to confirm your account, then sign in.");
}
