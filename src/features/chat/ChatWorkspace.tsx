"use client";

import { GuestBanner } from "@/components/ui/GuestBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Sidebar } from "@/components/layout/Sidebar";
import { useChatWorkspace } from "@/hooks/useChatWorkspace";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ConnectionStatusBar } from "./ConnectionStatusBar";
import { MessagePanel } from "./MessagePanel";
import { SecondaryPanel } from "./SecondaryPanel";
import { UserSearchPanel } from "./UserSearchPanel";

/** Guest / preview UI — fixture directory + in-memory session state. */
export function ChatWorkspace({ fromChatRedirect = false }: { fromChatRedirect?: boolean }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const chat = useChatWorkspace();

  const showSidebar = isDesktop || (chat.view === "chat" && !chat.mobileShowChat);
  const showMain = isDesktop || chat.view !== "chat" || chat.mobileShowChat;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <GuestBanner fromChatRedirect={fromChatRedirect} />
      <ConnectionStatusBar loadState={chat.loadState} onChangeState={chat.simulateLoadState} />

      {chat.loadState === "loading" ? (
        <div className="flex flex-1 items-center justify-center bg-[var(--rc-canvas)]">
          <Spinner label="Loading RelayChat workspace…" />
        </div>
      ) : null}

      {chat.loadState === "error" ? (
        <div className="flex flex-1 items-center justify-center bg-[var(--rc-canvas)]">
          <EmptyState
            title="Something went wrong"
            description="Preview of the error state. Return to the guest workspace to continue."
            action={
              <button
                type="button"
                onClick={() => chat.simulateLoadState("ready")}
                className="rounded-xl bg-[var(--rc-accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Return to guest app
              </button>
            }
          />
        </div>
      ) : null}

      {chat.loadState === "disconnected" ? (
        <div className="flex flex-1 items-center justify-center bg-[var(--rc-canvas)]">
          <EmptyState
            title="Disconnected preview"
            description="This preview mimics an offline signaling/session state. WebRTC is not connected in Phase 3."
            action={
              <button
                type="button"
                onClick={() => chat.simulateLoadState("ready")}
                className="rounded-xl bg-[var(--rc-accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Return to guest app
              </button>
            }
          />
        </div>
      ) : null}

      {chat.loadState === "empty" ? (
        <div className="flex flex-1 items-center justify-center bg-[var(--rc-canvas)]">
          <EmptyState
            title="No conversations yet"
            description="Use New conversation to search the local development directory."
            action={
              <button
                type="button"
                onClick={() => {
                  chat.simulateLoadState("ready");
                  chat.setNewChatOpen(true);
                }}
                className="rounded-xl bg-[var(--rc-accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Start a chat
              </button>
            }
          />
        </div>
      ) : null}

      {chat.loadState === "ready" ? (
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {showSidebar ? (
            <div className="relative flex h-full w-full md:w-[22rem]">
              <Sidebar
                user={chat.currentUser}
                conversations={chat.conversations}
                selectedId={chat.selectedConversation?.id ?? null}
                searchQuery={chat.searchQuery}
                onSearchChange={chat.setSearchQuery}
                onSelect={chat.selectConversation}
                activeView={chat.view}
                onNavigate={chat.setView}
                onNewConversation={() => {
                  chat.setStartError(null);
                  chat.setStartNotice(null);
                  chat.setNewChatOpen(true);
                }}
              />
              <UserSearchPanel
                directory={chat.directory}
                open={chat.newChatOpen}
                onClose={() => chat.setNewChatOpen(false)}
                onSelectUser={(user) => void chat.handleStartWithUser(user)}
                startingUserId={chat.startingUserId}
                startError={chat.startError}
                startNotice={chat.startNotice}
              />
            </div>
          ) : null}

          {showMain ? (
            <main className="min-w-0 flex-1">
              {chat.view === "chat" ? (
                <MessagePanel
                  conversation={chat.selectedConversation}
                  messages={chat.messages}
                  transfers={chat.demoTransfers}
                  draft={chat.draft}
                  onDraftChange={chat.setDraft}
                  onSend={chat.handleSend}
                  onAttach={chat.handleAttachClick}
                  notice={chat.composerNotice}
                  showBack={!isDesktop}
                  onBack={chat.backToList}
                  replyTo={chat.replyTo}
                  onCancelReply={() => chat.setReplyTo(null)}
                  onReply={chat.handleReply}
                  onRetry={chat.handleRetry}
                  onToggleReaction={chat.handleToggleReaction}
                  showDeliverySimulator
                  onSimulateDelivered={chat.simulateDelivered}
                  onSimulateRead={chat.simulateRead}
                  onSimulateFailLastPending={chat.simulateFailLastPending}
                  composerPlaceholder="Message (guest session — not synced)"
                />
              ) : (
                <SecondaryPanel
                  view={chat.view}
                  user={chat.currentUser}
                  onBack={() => chat.setView("chat")}
                />
              )}
            </main>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
