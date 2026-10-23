import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LiveChatWorkspace } from "@/features/chat/LiveChatWorkspace";
import { Spinner } from "@/components/ui/Spinner";
import { listConversationsForUser } from "@/lib/messages/queries";
import { tryGetSupabasePublicEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

async function ChatPageContent() {
  if (!tryGetSupabasePublicEnv()) {
    // Let guests explore the app even before Supabase is configured.
    redirect("/demo?guest=1");
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/demo?guest=1");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    redirect("/login?message=Profile missing. Sign out and sign up again, or contact support.");
  }

  let initialConversations: Awaited<ReturnType<typeof listConversationsForUser>> = [];
  try {
    initialConversations = await listConversationsForUser(supabase, userId);
  } catch {
    initialConversations = [];
  }

  return (
    <LiveChatWorkspace
      userId={userId}
      profile={profile}
      initialConversations={initialConversations}
    />
  );
}

export default function ChatPage() {
  return (
    <div className="flex h-dvh min-h-0 flex-col p-0 md:p-4 lg:p-6">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden md:rounded-3xl md:border md:border-[var(--rc-border)] md:bg-[var(--rc-surface)] md:shadow-[0_24px_60px_rgba(20,32,43,0.08)]">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <Spinner label="Loading your chats…" />
            </div>
          }
        >
          <ChatPageContent />
        </Suspense>
      </div>
    </div>
  );
}
