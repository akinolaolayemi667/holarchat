import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { Spinner } from "@/components/ui/Spinner";
import { signInAction } from "@/lib/auth/actions";

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; message?: string; error?: string }>;
}) {
  const params = await searchParams;
  const banner =
    params.message ??
    (params.error === "auth_callback_failed"
      ? "Email confirmation failed. Try signing in again or request a new link."
      : null);

  return (
    <AuthForm
      mode="login"
      action={signInAction}
      nextPath={params.next?.startsWith("/") ? params.next : "/chat"}
      banner={banner}
    />
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; message?: string; error?: string }>;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Suspense fallback={<Spinner label="Loading sign-in…" />}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
