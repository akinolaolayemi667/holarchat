"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthFormState } from "@/lib/auth/actions";

const initialState: AuthFormState = { error: null };

interface AuthFormProps {
  mode: "login" | "signup";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  nextPath?: string;
  banner?: string | null;
}

export function AuthForm({ mode, action, nextPath = "/chat", banner }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-[var(--rc-border)] bg-[var(--rc-surface)] p-6 shadow-[0_24px_60px_rgba(20,32,43,0.08)] sm:p-8">
      <div className="mb-6">
        <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--rc-ink)]">
          Relay<span className="text-[var(--rc-accent)]">Chat</span>
        </p>
        <h1 className="mt-3 text-xl font-semibold text-[var(--rc-ink)]">
          {mode === "login" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-[var(--rc-muted)]">
          {mode === "login"
            ? "Welcome back. Your conversations stay on Supabase."
            : "Start messaging with secure server-side sessions."}
        </p>
      </div>

      {banner ? (
        <p className="mb-4 rounded-xl bg-[var(--rc-accent-soft)] px-3 py-2 text-sm text-[var(--rc-ink)]">
          {banner}
        </p>
      ) : null}

      {state.error ? (
        <p className="mb-4 rounded-xl bg-[var(--rc-danger-soft)] px-3 py-2 text-sm text-[var(--rc-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={nextPath} />

        {mode === "signup" ? (
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-[var(--rc-ink)]">Display name</span>
            <input
              name="displayName"
              type="text"
              required
              maxLength={80}
              autoComplete="nickname"
              className="w-full rounded-xl border border-[var(--rc-border)] bg-[var(--rc-surface-2)] px-3 py-2.5 outline-none focus:border-[var(--rc-accent)] focus:ring-2 focus:ring-[var(--rc-accent-soft)]"
            />
            {state.fieldErrors?.displayName ? (
              <span className="mt-1 block text-xs text-[var(--rc-danger)]">
                {state.fieldErrors.displayName}
              </span>
            ) : null}
          </label>
        ) : null}

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-[var(--rc-ink)]">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-[var(--rc-border)] bg-[var(--rc-surface-2)] px-3 py-2.5 outline-none focus:border-[var(--rc-accent)] focus:ring-2 focus:ring-[var(--rc-accent-soft)]"
          />
          {state.fieldErrors?.email ? (
            <span className="mt-1 block text-xs text-[var(--rc-danger)]">{state.fieldErrors.email}</span>
          ) : null}
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-[var(--rc-ink)]">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="w-full rounded-xl border border-[var(--rc-border)] bg-[var(--rc-surface-2)] px-3 py-2.5 outline-none focus:border-[var(--rc-accent)] focus:ring-2 focus:ring-[var(--rc-accent-soft)]"
          />
          {state.fieldErrors?.password ? (
            <span className="mt-1 block text-xs text-[var(--rc-danger)]">
              {state.fieldErrors.password}
            </span>
          ) : null}
        </label>

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-xl bg-[var(--rc-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--rc-muted)]">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link href="/signup" className="font-medium text-[var(--rc-accent)] hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link href="/login" className="font-medium text-[var(--rc-accent)] hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
