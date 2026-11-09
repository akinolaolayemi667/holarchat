import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { signUpAction } from "@/lib/auth/actions";
import { SITE_NAME } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Create account",
  description: `Create a ${SITE_NAME} (Hola) account founded by Akinola Olayemi — real-time chat and WebRTC file sharing.`,
  alternates: { canonical: "/signup" },
};

export default function SignupPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <AuthForm mode="signup" action={signUpAction} />
    </main>
  );
}
