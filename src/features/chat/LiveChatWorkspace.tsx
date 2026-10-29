"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Sidebar } from "@/components/layout/Sidebar";
import { useLiveChat } from "@/hooks/useLiveChat";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { signOutAction } from "@/lib/messages/actions";
import { toChatMessageView, toConversationSummary } from "@/lib/messages/adapters";
import type { ConversationListItem } from "@/lib/messages/queries";
import type { Profile } from "@/types/database";
import { MessagePanel } from "./MessagePanel";
import { SecondaryPanel } from "./SecondaryPanel";

interface LiveChatWorkspaceProps {
  userId: string;
  profile: Profile;
  initialConversations: ConversationListItem[];
}

export function LiveChatWorkspace({
  userId,
  profile,
  initialConversations,
}: LiveChatWorkspaceProps) {
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const chat = useLiveChat({ userId, profile, initialConversations });

  const conversations = useMemo(
    () => chat.conversations.map(toConversationSummary),
    [chat.conversations],
  );
  const selectedConversation = chat.selectedConversation
    ? toConversationSummary(chat.selectedConversation)
    : null;
  const messages = useMemo(
    () => chat.messages.map(toChatMessageView),
    [chat.messages],
  );

  const showSidebar = isDesktop || (chat.view === "chat" && !chat.mobileShowChat);
  const showMain = isDesktop || chat.view !== "chat" || chat.mobileShowChat;

  async function handleSignOut() {
    await signOutAction();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DemoBanner text="Phase 3 UI + Phase 2 Supabase path. Connect env vars for real accounts. WebRTC is interface-only." />
      <p className="border-b border-[var(--rc-border)] bg-[var(--rc-surface)] px-4 py-2 text-xs text-[var(--rc-muted)]">
        {chat.connectionLabel}
      </p>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showSidebar ? (
          <Sidebar
            user={chat.currentUser}
            conversations={conversations}
            selectedId={selectedConversation?.id ?? null}
            searchQuery={chat.searchQuery}
            onSearchChange={chat.setSearchQuery}
            onSelect={chat.selectConversation}
            activeView={chat.view}
            onNavigate={chat.setView}
            onSignOut={handleSignOut}
            subtitle="Signed-in · Supabase when configured"
          />
        ) : null}

        {showMain ? (
          <main className="min-w-0 flex-1">
            {chat.view === "chat" ? (
              <MessagePanel
                conversation={selectedConversation}
                messages={messages}
                draft={chat.draft}
                onDraftChange={chat.setDraft}
                onSend={() => void chat.handleSend()}
                onAttach={chat.handleAttachClick}
                notice={chat.composerNotice}
                showBack={!isDesktop}
                onBack={chat.backToList}
                loadingMessages={chat.loadingMessages}
                loadingOlder={chat.loadingOlder}
                hasMore={chat.hasMore}
                onLoadOlder={() => void chat.loadOlder()}
                error={chat.error}
                connectionLabel={chat.connectionLabel}
                composerPlaceholder="Write a message"
              />
            ) : (
              <SecondaryPanel
                view={chat.view}
                user={chat.currentUser}
                onBack={() => chat.setView("chat")}
                liveProfile={chat.liveProfile}
                onLiveProfileChange={chat.setLiveProfile}
              />
            )}
          </main>
        ) : null}
      </div>
    </div>
  );
}
