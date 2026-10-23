import type { UserProfile } from "./user";

/**
 * Auth contract for a future Supabase Auth integration.
 * Phase 1 does not authenticate users.
 */
export interface AuthSession {
  user: UserProfile;
  accessToken: string;
  expiresAt: string;
}

export interface AuthProvider {
  getSession(): Promise<AuthSession | null>;
  signInWithEmail(email: string, password: string): Promise<AuthSession>;
  signUpWithEmail(email: string, password: string, displayName: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  onAuthStateChange(listener: (session: AuthSession | null) => void): () => void;
}
