export type UserId = string;

export interface UserProfile {
  id: UserId;
  displayName: string;
  email: string;
  avatarUrl?: string;
  /** Demo-only visual hint. Real presence comes from a later signaling phase. */
  demoStatus?: "online" | "away" | "offline";
}
