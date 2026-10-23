"use client";

import { useDeferredValue, useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { OnlineDot } from "@/components/ui/OnlineDot";
import { Spinner } from "@/components/ui/Spinner";
import { DEV_DIRECTORY_LABEL } from "@/lib/dev/directory";
import type { ConversationDirectory } from "@/lib/conversations/fixture-store";
import type { ChatParticipant } from "@/types/chat";

interface UserSearchPanelProps {
  directory: ConversationDirectory;
  open: boolean;
  onClose: () => void;
  onSelectUser: (user: ChatParticipant) => void;
  startingUserId: string | null;
  startError: string | null;
  startNotice: string | null;
}

export function UserSearchPanel({
  directory,
  open,
  onClose,
  onSelectUser,
  startingUserId,
  startError,
  startNotice,
}: UserSearchPanelProps) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [results, setResults] = useState<ChatParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      try {
        const users = await directory.searchUsers(deferred);
        if (cancelled) return;
        setResults(users);
        setError(null);
        setLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Search failed.");
        setResults([]);
        setLoading(false);
      }
    })();

    startTransition(() => {
      setLoading(true);
    });

    return () => {
      cancelled = true;
    };
  }, [directory, deferred, open, startTransition]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col bg-[var(--rc-surface)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-chat-title"
    >
      <div className="flex items-center gap-2 border-b border-[var(--rc-border)] px-3 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-3 py-2 text-sm text-[var(--rc-muted)] hover:bg-[var(--rc-surface-2)] hover:text-[var(--rc-ink)]"
        >
          Cancel
        </button>
        <h2 id="new-chat-title" className="flex-1 font-semibold text-[var(--rc-ink)]">
          New conversation
        </h2>
      </div>

      <p className="border-b border-[var(--rc-border)] bg-[var(--rc-warning-soft)] px-4 py-2 text-xs text-[var(--rc-warning)]">
        {DEV_DIRECTORY_LABEL}
      </p>

      <label className="block px-3 py-3">
        <span className="sr-only">Search people</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          autoFocus
          className="w-full rounded-xl border border-[var(--rc-border)] bg-[var(--rc-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--rc-accent)] focus:ring-2 focus:ring-[var(--rc-accent-soft)]"
        />
      </label>

      {startError ? (
        <p
          className="mx-3 mb-2 rounded-xl bg-[var(--rc-danger-soft)] px-3 py-2 text-xs text-[var(--rc-danger)]"
          role="alert"
        >
          {startError}
        </p>
      ) : null}
      {startNotice ? (
        <p
          className="mx-3 mb-2 rounded-xl bg-[var(--rc-accent-soft)] px-3 py-2 text-xs text-[var(--rc-ink)]"
          role="status"
        >
          {startNotice}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {loading || pending ? (
          <div className="flex justify-center py-10">
            <Spinner label="Searching directory…" />
          </div>
        ) : null}

        {!loading && error ? (
          <EmptyState title="Search unavailable" description={error} />
        ) : null}

        {!loading && !error && results.length === 0 ? (
          <EmptyState
            title="No people found"
            description={
              deferred.trim()
                ? "Try another name. This list is a local fixture directory only."
                : "The local development directory is empty for this filter."
            }
          />
        ) : null}

        {!loading && !error
          ? results.map((user) => (
              <button
                key={user.id}
                type="button"
                disabled={startingUserId === user.id}
                onClick={() => startTransition(() => onSelectUser(user))}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-[var(--rc-surface-2)] disabled:opacity-60"
              >
                <div className="relative">
                  <Avatar user={{ id: user.id, displayName: user.displayName }} />
                  {user.presence ? (
                    <span className="absolute right-0 bottom-0">
                      <OnlineDot status={user.presence.status} />
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--rc-ink)]">{user.displayName}</p>
                  <p className="truncate text-xs text-[var(--rc-muted)]">{user.email}</p>
                  {user.presence?.simulated ? (
                    <p className="text-[10px] text-[var(--rc-muted)]">
                      Simulated · {user.presence.status}
                    </p>
                  ) : null}
                </div>
                <span className="text-xs font-medium text-[var(--rc-accent)]">
                  {startingUserId === user.id ? "Starting…" : "Message"}
                </span>
              </button>
            ))
          : null}
      </div>
    </div>
  );
}
