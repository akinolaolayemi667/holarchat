import Link from "next/link";
import { redirect } from "next/navigation";
import { tryGetSupabasePublicEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function HomePage() {
  const env = tryGetSupabasePublicEnv();

  if (env) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      if (data?.claims?.sub) {
        redirect("/chat");
      }
    } catch {
      // Fall through to public landing when env/session is unavailable.
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div>
        <p className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--rc-ink)] sm:text-5xl">
          Relay<span className="text-[var(--rc-accent)]">Chat</span>
        </p>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--rc-muted)]">
          Real-time messaging for teams. Open the app and explore as a guest — no account
          required. Create an account when you are ready to save real conversations.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/demo"
          className="rounded-xl bg-[var(--rc-accent)] px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
        >
          Open app
        </Link>
        <Link
          href="/webrtc-lab"
          className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-surface)] px-5 py-3 text-sm font-semibold text-[var(--rc-ink)] hover:bg-[var(--rc-surface-2)]"
        >
          WebRTC lab
        </Link>
        <Link
          href="/signup"
          className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-surface)] px-5 py-3 text-sm font-semibold text-[var(--rc-ink)] hover:bg-[var(--rc-surface-2)]"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="rounded-xl px-5 py-3 text-sm font-medium text-[var(--rc-muted)] hover:text-[var(--rc-ink)]"
        >
          Sign in
        </Link>
      </div>
      <p className="text-sm text-[var(--rc-muted)]">
        Guest mode shows a realistic preview. Messaging, history, and file transfer for your
        own account unlock after sign-up.
      </p>
      {!env ? (
        <p className="rounded-xl bg-[var(--rc-warning-soft)] px-4 py-3 text-sm text-[var(--rc-warning)]">
          Supabase env vars are not configured yet. You can still open the guest app preview.
          Add `.env.local` when you are ready for real accounts.
        </p>
      ) : null}
    </main>
  );
}
