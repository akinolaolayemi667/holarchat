import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { SiteJsonLd } from "@/components/seo/JsonLd";
import {
  FOUNDER,
  SEO_KEYWORDS,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/seo/site";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — real-time chat by ${FOUNDER.name}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [...SEO_KEYWORDS],
  authors: [{ name: FOUNDER.name, url: `${SITE_URL}/about` }],
  creator: FOUNDER.name,
  publisher: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} (Hola) — real-time messaging`,
    description: SITE_TAGLINE,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} (Hola)`,
    description: SITE_TAGLINE,
    creator: FOUNDER.name,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: "NfnZfRlo8_2taoHjVyYNMbA6SAFNTdB0ju_K8tRora4",
  },
  category: "technology",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteJsonLd />
        {children}
      </body>
    </html>
  );
}
