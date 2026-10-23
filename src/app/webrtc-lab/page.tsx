import { WebRtcLab } from "@/features/webrtc/WebRtcLab";

export const instant = false;

/**
 * Development-only harness for two-browser WebRTC signaling tests.
 * Does not require Supabase. Guest identity is rejected by the server in production.
 */
export default function WebRtcLabPage() {
  return <WebRtcLab />;
}
