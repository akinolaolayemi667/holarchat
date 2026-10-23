import type { ChatParticipant } from "@/types/chat";

/**
 * LOCAL DEVELOPMENT DIRECTORY
 * ---------------------------
 * Sample people for UI work when Supabase is not connected.
 * This is NOT a real user directory and NOT multi-user data.
 * Do not treat matches as live accounts.
 */

export const DEV_DIRECTORY_LABEL =
  "Local development directory (fixtures — not real users)";

export const DEV_CURRENT_USER: ChatParticipant = {
  id: "user-me",
  displayName: "Alex Rivera",
  email: "alex@example.com",
  presence: { status: "online", simulated: true },
};

/** People you can search and start fixture DMs with in guest/dev mode. */
export const DEV_DIRECTORY_USERS: ChatParticipant[] = [
  {
    id: "user-maya",
    displayName: "Maya Chen",
    email: "maya@example.com",
    presence: { status: "online", simulated: true },
  },
  {
    id: "user-jordan",
    displayName: "Jordan Blake",
    email: "jordan@example.com",
    presence: { status: "away", simulated: true },
  },
  {
    id: "user-sam",
    displayName: "Sam Okonkwo",
    email: "sam@example.com",
    presence: { status: "offline", simulated: true },
  },
  {
    id: "user-riley",
    displayName: "Riley Nguyen",
    email: "riley@example.com",
    presence: { status: "online", simulated: true },
  },
  {
    id: "user-priya",
    displayName: "Priya Nair",
    email: "priya@example.com",
    presence: { status: "away", simulated: true },
  },
  {
    id: "user-leo",
    displayName: "Leo Martins",
    email: "leo@example.com",
    presence: { status: "offline", simulated: true },
  },
];

export function searchDevDirectory(query: string): ChatParticipant[] {
  const q = query.trim().toLowerCase();
  const pool = DEV_DIRECTORY_USERS.filter((u) => u.id !== DEV_CURRENT_USER.id);
  if (!q) return pool;
  return pool.filter(
    (u) =>
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q),
  );
}
