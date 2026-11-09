import type { Metadata } from "next";
import Link from "next/link";
import { FOUNDER, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: `About ${SITE_NAME} & founder ${FOUNDER.name}`,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    title: `${FOUNDER.name} — Founder of ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    url: `${SITE_URL}/about`,
    type: "profile",
  },
};

export default function AboutPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-medium tracking-wide text-[var(--rc-accent)] uppercase">
          About
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--rc-ink)] sm:text-5xl">
          {SITE_NAME}
          <span className="block text-2xl font-medium text-[var(--rc-muted)] sm:text-3xl">
            also known as Hola / RelayChat
          </span>
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-[var(--rc-muted)]">
          {SITE_NAME} is a real-time messaging product for teams: conversations,
          profiles, and peer-to-peer file transfer over WebRTC. People searching for{" "}
          <strong className="font-semibold text-[var(--rc-ink)]">Hola</strong>,{" "}
          <strong className="font-semibold text-[var(--rc-ink)]">Holarchat</strong>, or{" "}
          <strong className="font-semibold text-[var(--rc-ink)]">RelayChat</strong>{" "}
          are looking at the same product family.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-3xl border border-[var(--rc-border)] bg-[var(--rc-surface)] p-6">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--rc-ink)]">
          Founder: {FOUNDER.name}
        </h2>
        <p className="leading-relaxed text-[var(--rc-muted)]">
          <strong className="font-semibold text-[var(--rc-ink)]">{FOUNDER.name}</strong>{" "}
          is the founder of {SITE_NAME}. He builds the product around practical
          real-time collaboration: signed-in chat with Supabase, guest demos for
          quick exploration, and a WebRTC lab for connection diagnostics and file
          transfer experiments.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--rc-muted)]">
          <li>Product: {SITE_NAME} (Hola / RelayChat)</li>
          <li>Role: {FOUNDER.jobTitle}</li>
          <li>
            Source:{" "}
            <a
              className="text-[var(--rc-accent)] underline-offset-2 hover:underline"
              href="https://github.com/akinolaolayemi667/holarchat"
            >
              github.com/akinolaolayemi667/holarchat
            </a>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--rc-ink)]">
          What you can do
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-[var(--rc-muted)]">
          <li>Try the guest demo without creating an account</li>
          <li>Sign up for persistent conversations and profile management</li>
          <li>Use the WebRTC lab to inspect signaling, ICE, and file transfer</li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-xl bg-[var(--rc-accent)] px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
        >
          Back to home
        </Link>
        <Link
          href="/demo"
          className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-surface)] px-5 py-3 text-sm font-semibold text-[var(--rc-ink)] hover:bg-[var(--rc-surface-2)]"
        >
          Open guest demo
        </Link>
        <Link
          href="/signup"
          className="rounded-xl px-5 py-3 text-sm font-medium text-[var(--rc-muted)] hover:text-[var(--rc-ink)]"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
