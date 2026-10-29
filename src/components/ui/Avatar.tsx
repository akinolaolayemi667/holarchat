import type { UserProfile } from "@/types/user";

const PALETTE = ["#0d7a63", "#1f6f8b", "#b45309", "#7c3a5f", "#3f5b4d"];

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % 997;
  }
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0];
}

interface AvatarProps {
  user: Pick<UserProfile, "id" | "displayName"> & { avatarUrl?: string };
  size?: "sm" | "md" | "lg";
}

const sizeClass = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

export function Avatar({ user, size = "md" }: AvatarProps) {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Supabase public storage URL; avoid remotePatterns coupling
      <img
        src={user.avatarUrl}
        alt=""
        className={`inline-block shrink-0 rounded-full object-cover ${sizeClass[size]}`}
      />
    );
  }

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${sizeClass[size]}`}
      style={{ backgroundColor: colorFor(user.id) }}
      aria-hidden
    >
      {initials(user.displayName)}
    </div>
  );
}
