import Link from "next/link";

interface GuestBannerProps {
  fromChatRedirect?: boolean;
}

export function GuestBanner({ fromChatRedirect = false }: GuestBannerProps) {
  return (
    <div className="border-b border-[var(--rc-border)] bg-[var(--rc-accent-soft)] px-4 py-2.5 text-center text-xs leading-relaxed text-[var(--rc-ink)] sm:text-sm">
      {fromChatRedirect ? (
        <span>
          You’re browsing as a <strong>guest</strong>. Real chats need an account.{" "}
        </span>
      ) : (
        <span>
          <strong>Guest preview</strong> — explore the app with sample data. Nothing is saved.{" "}
        </span>
      )}
      <Link href="/signup" className="font-semibold text-[var(--rc-accent)] underline-offset-2 hover:underline">
        Create account
      </Link>
      <span className="text-[var(--rc-muted)]"> · </span>
      <Link href="/login" className="font-semibold text-[var(--rc-accent)] underline-offset-2 hover:underline">
        Sign in
      </Link>
    </div>
  );
}
