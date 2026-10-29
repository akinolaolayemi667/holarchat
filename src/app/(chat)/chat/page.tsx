import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { LiveChatWorkspace } from "@/features/chat/LiveChatWorkspace";
import { Spinner } from "@/components/ui/Spinner";
import { listConversationsForUser } from "@/lib/messages/queries";
import { tryGetSupabasePublicEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

async function ChatPageContent() {
  // Auth JWT validation uses Date.now() internally. With Cache Components,
  // defer this whole tree to a real request (Suspense fallback stays in the shell).
  await connection();

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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    redirect(
      "/login?message=" +
        encodeURIComponent(
          "Could not load your profile (database not ready or access denied). Apply the messaging migration, then sign in again.",
        ),
    );
  }

  if (!profile) {
    redirect(
      "/login?message=" +
        encodeURIComponent(
          "Profile missing. Your auth user has no profiles row (signup trigger not applied, or account created before the migration). Sign out, apply supabase/migrations, then sign up again.",
        ),
    );
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
