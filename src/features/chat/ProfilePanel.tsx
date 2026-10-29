"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import {
  clearOwnProfileExtrasAction,
  createOwnProfileAction,
  removeOwnAvatarAction,
  updateOwnProfileAction,
  uploadOwnAvatarAction,
} from "@/lib/profiles/actions";
import type { Profile } from "@/types/database";

interface ProfilePanelProps {
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
  onBack: () => void;
}

export function ProfilePanel({ profile, onProfileChange, onBack }: ProfilePanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [statusMessage, setStatusMessage] = useState(profile.status_message ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply(next: Profile, notice: string) {
    onProfileChange(next);
    setDisplayName(next.display_name);
    setPhoneNumber(next.phone_number ?? "");
    setBio(next.bio ?? "");
    setStatusMessage(next.status_message ?? "");
    setError(null);
    setMessage(notice);
  }

  function saveProfile() {
    startTransition(async () => {
      const result = await updateOwnProfileAction({
        displayName,
        phoneNumber,
        bio,
        statusMessage,
      });
      if (!result.ok) {
        setMessage(null);
        setError(result.error.message);
        return;
      }
      apply(result.data, "Profile saved.");
    });
  }

  function createIfMissing() {
    startTransition(async () => {
      const result = await createOwnProfileAction({ displayName: displayName || "User" });
      if (!result.ok) {
        setMessage(null);
        setError(result.error.message);
        return;
      }
      apply(result.data, "Profile created.");
    });
  }

  function onPickAvatar(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("avatar", file);
    startTransition(async () => {
      const result = await uploadOwnAvatarAction(formData);
      if (fileRef.current) fileRef.current.value = "";
      if (!result.ok) {
        setMessage(null);
        setError(result.error.message);
        return;
      }
      apply(result.data, "Photo updated.");
    });
  }

  function removeAvatar() {
    startTransition(async () => {
      const result = await removeOwnAvatarAction();
      if (!result.ok) {
        setMessage(null);
        setError(result.error.message);
        return;
      }
      apply(result.data, "Photo removed.");
    });
  }

  function clearExtras() {
    if (
      !window.confirm(
        "Clear phone, bio, status, and photo? Your display name will be kept.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await clearOwnProfileExtrasAction();
      if (!result.ok) {
        setMessage(null);
        setError(result.error.message);
        return;
      }
      apply(result.data, "Optional profile fields cleared.");
    });
  }

  const user = {
    id: profile.id,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url ?? undefined,
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--rc-canvas)]">
      <div className="flex items-center gap-3 border-b border-[var(--rc-border)] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl px-3 py-2 text-sm text-[var(--rc-muted)] hover:bg-[var(--rc-surface-2)] hover:text-[var(--rc-ink)]"
        >
          ← Back to chat
        </button>
        <h2 className="font-semibold text-[var(--rc-ink)]">Your profile</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--rc-border)] bg-[var(--rc-surface)] p-5">
            <Avatar user={user} size="lg" />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => fileRef.current?.click()}
                className="rounded-xl bg-[var(--rc-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Upload photo
              </button>
              {profile.avatar_url ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={removeAvatar}
                  className="rounded-xl border border-[var(--rc-border)] px-4 py-2 text-sm text-[var(--rc-ink)] disabled:opacity-60"
                >
                  Remove photo
                </button>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => onPickAvatar(e.target.files)}
            />
            <p className="text-center text-xs text-[var(--rc-muted)]">
              JPEG, PNG, WebP, or GIF · max 2 MB
            </p>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-[var(--rc-border)] bg-[var(--rc-surface)] p-5">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--rc-ink)]">Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                className="w-full rounded-xl border border-[var(--rc-border)] bg-[var(--rc-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--rc-accent)]"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--rc-ink)]">Phone</span>
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 555 010 2233"
                inputMode="tel"
                autoComplete="tel"
                className="w-full rounded-xl border border-[var(--rc-border)] bg-[var(--rc-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--rc-accent)]"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--rc-ink)]">Status</span>
              <input
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                maxLength={120}
                placeholder="Available"
                className="w-full rounded-xl border border-[var(--rc-border)] bg-[var(--rc-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--rc-accent)]"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--rc-ink)]">Bio</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                rows={4}
                placeholder="A short intro"
                className="w-full resize-y rounded-xl border border-[var(--rc-border)] bg-[var(--rc-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--rc-accent)]"
              />
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={saveProfile}
                className="rounded-xl bg-[var(--rc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Save changes
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={createIfMissing}
                className="rounded-xl border border-[var(--rc-border)] px-4 py-2 text-sm text-[var(--rc-ink)] disabled:opacity-60"
              >
                Create profile row
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={clearExtras}
                className="rounded-xl px-4 py-2 text-sm text-[var(--rc-danger)] hover:bg-[var(--rc-danger-soft)] disabled:opacity-60"
              >
                Clear optional fields
              </button>
            </div>
          </section>

          {error ? (
            <p className="rounded-xl bg-[var(--rc-danger-soft)] px-3 py-2 text-sm text-[var(--rc-danger)]" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-xl bg-[var(--rc-accent-soft)] px-3 py-2 text-sm text-[var(--rc-ink)]" role="status">
              {message}
            </p>
          ) : null}
          {pending ? (
            <p className="text-xs text-[var(--rc-muted)]" role="status">
              Working…
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
