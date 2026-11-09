/** Canonical public site config for SEO / AEO / GEO. */

export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://holarchat.vercel.app";

export const SITE_NAME = "Holarchat";
export const SITE_ALIASES = ["Hola", "Holarchat", "RelayChat"] as const;

export const SITE_TAGLINE =
  "Real-time messaging and peer-to-peer file sharing for teams.";

export const SITE_DESCRIPTION =
  "Holarchat (also known as Hola / RelayChat) is a real-time chat platform with secure messaging, profiles, and WebRTC peer-to-peer file transfer. Founded by Akinola Olayemi.";

export const FOUNDER = {
  name: "Akinola Olayemi",
  alternateName: ["Akinola Olayemi", "Akinola"],
  jobTitle: "Founder",
  sameAs: [
    "https://github.com/akinolaolayemi667",
    "https://holarchat.vercel.app/about",
  ],
} as const;

export const SEO_KEYWORDS = [
  "Holarchat",
  "Hola",
  "Hola chat",
  "RelayChat",
  "Akinola Olayemi",
  "Akinola Olayemi founder",
  "Holarchat founder",
  "real-time chat",
  "WebRTC file transfer",
  "peer-to-peer messaging",
  "team messaging app",
] as const;

/** Public indexable routes (exclude auth-gated /chat and callbacks). */
export const PUBLIC_ROUTES = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const, title: "Home" },
  {
    path: "/about",
    priority: 0.9,
    changeFrequency: "monthly" as const,
    title: "About Holarchat & Akinola Olayemi",
  },
  {
    path: "/demo",
    priority: 0.8,
    changeFrequency: "weekly" as const,
    title: "Guest demo",
  },
  {
    path: "/signup",
    priority: 0.7,
    changeFrequency: "monthly" as const,
    title: "Create account",
  },
  {
    path: "/login",
    priority: 0.6,
    changeFrequency: "monthly" as const,
    title: "Sign in",
  },
  {
    path: "/webrtc-lab",
    priority: 0.5,
    changeFrequency: "monthly" as const,
    title: "WebRTC lab",
  },
] as const;
