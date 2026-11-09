import type { Metadata } from "next";
import { WebRtcLab } from "@/features/webrtc/WebRtcLab";
import { SITE_NAME } from "@/lib/seo/site";

export const instant = false;

export const metadata: Metadata = {
  title: "WebRTC lab",
  description: `${SITE_NAME} WebRTC lab — signaling, ICE/TURN diagnostics, and peer-to-peer file transfer experiments.`,
  alternates: { canonical: "/webrtc-lab" },
};

/**
 * Development-only harness for two-browser WebRTC signaling tests.
 * Does not require Supabase. Guest identity is rejected by the server in production.
 */
export default function WebRtcLabPage() {
  return <WebRtcLab />;
}
