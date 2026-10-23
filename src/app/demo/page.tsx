import { Suspense } from "react";
import { ChatWorkspace } from "@/features/chat/ChatWorkspace";
import { Spinner } from "@/components/ui/Spinner";

export const instant = false;

/**
 * Public guest app preview — no account required.
 * Authenticated messaging lives at /chat.
 */
async function DemoApp({
  searchParams,
}: {
  searchParams: Promise<{ guest?: string }>;
}) {
  const params = await searchParams;
  return <ChatWorkspace fromChatRedirect={params.guest === "1"} />;
}

export default function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ guest?: string }>;
}) {
  return (
    <div className="flex h-dvh min-h-0 flex-col p-0 md:p-4 lg:p-6">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden md:rounded-3xl md:border md:border-[var(--rc-border)] md:bg-[var(--rc-surface)] md:shadow-[0_24px_60px_rgba(20,32,43,0.08)]">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <Spinner label="Opening app…" />
            </div>
          }
        >
          <DemoApp searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
