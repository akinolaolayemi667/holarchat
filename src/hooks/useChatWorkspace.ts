"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import {
  appendFixtureMessage,
  createInitialFixtureState,
  fixtureConversationDirectory,
  replaceFixtureMessage,
  updateFixtureMessageStatus,
  type FixtureChatState,
} from "@/lib/conversations/fixture-store";
import { DEV_CURRENT_USER } from "@/lib/dev/directory";
import { DEMO_FILE_TRANSFERS } from "@/lib/demo/data";
import { applySimulatedReceipt } from "@/lib/messages/status";
import type {
  ChatMessageView,
  ChatParticipant,
  MessageReplyPreview,
} from "@/types/chat";
import type { WorkspaceLoadState, WorkspaceView } from "@/types/ui";

export function useChatWorkspace() {
  const [loadState, setLoadState] = useState<WorkspaceLoadState>("ready");
  const [view, setView] = useState<WorkspaceView>("chat");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);
  const [state, setState] = useState<FixtureChatState>(() => createInitialFixtureState());
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    // Same seed as createInitialFixtureState — deterministic fixture ids.
    return "conv-1";
  });
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [draft, setDraft] = useState("");
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MessageReplyPreview | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [startingUserId, setStartingUserId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [startNotice, setStartNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const conversations = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return state.conversations;
    return state.conversations.filter(
      (c) =>
        (c.peer?.displayName ?? "").toLowerCase().includes(q) ||
        c.lastMessagePreview.toLowerCase().includes(q),
    );
  }, [state.conversations, deferredQuery]);

  const selectedConversation = useMemo(
    () => state.conversations.find((c) => c.id === selectedId) ?? null,
    [state.conversations, selectedId],
  );

  const messages = selectedId ? (state.messagesByConversation[selectedId] ?? []) : [];

  function selectConversation(id: string) {
    startTransition(() => {
      setSelectedId(id);
      setMobileShowChat(true);
      setComposerNotice(null);
      setReplyTo(null);
      setView("chat");
      setNewChatOpen(false);
      setState((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.id === id ? { ...c, unreadCount: 0 } : c,
        ),
      }));
    });
  }

  function backToList() {
    setMobileShowChat(false);
  }

  function simulateLoadState(next: WorkspaceLoadState) {
    setLoadState(next);
    if (next === "ready" && !selectedId && state.conversations[0]) {
      setSelectedId(state.conversations[0].id);
    }
  }

  async function handleStartWithUser(user: ChatParticipant) {
    setStartingUserId(user.id);
    setStartError(null);
    setStartNotice(null);
    const { next, outcome } = await fixtureConversationDirectory.startDirect(user.id, state);
    setStartingUserId(null);

    if (outcome.status === "error") {
      setStartError(outcome.message);
      return;
    }

    if (outcome.status === "existing") {
      setStartNotice("Conversation already exists — opening it.");
      setState(next);
      selectConversation(outcome.conversationId);
      return;
    }

    setState(next);
    setNewChatOpen(false);
    selectConversation(outcome.conversationId);
    setComposerNotice(
      "Fixture conversation created in this browser session only — not saved to a server.",
    );
  }

  function handleSend() {
    if (!selectedId) return;
    const body = draft.trim();
    if (!body) return;

    const clientId = crypto.randomUUID();
    const pending: ChatMessageView = {
      id: `local-${clientId}`,
      conversationId: selectedId,
      senderId: DEV_CURRENT_USER.id,
      body,
      createdAt: new Date().toISOString(),
      isOwn: true,
      status: "pending",
      clientId,
      replyTo,
      reactions: [],
    };

    setDraft("");
    setReplyTo(null);
    setComposerNotice(null);
    setState((prev) => appendFixtureMessage(prev, pending));

    // Simulate network accept → sent (not delivered)
    window.setTimeout(() => {
      setState((prev) =>
        replaceFixtureMessage(prev, selectedId, clientId, {
          ...pending,
          id: `msg-${clientId}`,
          status: "sent",
        }),
      );
    }, 350);
  }

  function handleRetry(message: ChatMessageView) {
    if (!message.clientId || !selectedId) return;
    setState((prev) =>
      updateFixtureMessageStatus(prev, selectedId, message.id, "pending"),
    );
    window.setTimeout(() => {
      setState((prev) =>
        updateFixtureMessageStatus(prev, selectedId, message.id, "sent"),
      );
    }, 350);
  }

  function handleReply(message: ChatMessageView) {
    const authorName = message.isOwn
      ? "You"
      : (selectedConversation?.peer?.displayName ?? "Participant");
    setReplyTo({ id: message.id, body: message.body, authorName });
  }

  function handleToggleReaction(message: ChatMessageView, emoji: string) {
    if (!selectedId) return;
    setState((prev) => {
      const list = prev.messagesByConversation[selectedId] ?? [];
      return {
        ...prev,
        messagesByConversation: {
          ...prev.messagesByConversation,
          [selectedId]: list.map((m) => {
            if (m.id !== message.id) return m;
            const existing = m.reactions.find((r) => r.emoji === emoji);
            if (!existing) {
              return {
                ...m,
                reactions: [...m.reactions, { emoji, count: 1, reactedByMe: true }],
              };
            }
            if (existing.reactedByMe) {
              const count = existing.count - 1;
              return {
                ...m,
                reactions:
                  count <= 0
                    ? m.reactions.filter((r) => r.emoji !== emoji)
                    : m.reactions.map((r) =>
                        r.emoji === emoji
                          ? { ...r, count, reactedByMe: false }
                          : r,
                      ),
              };
            }
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === emoji
                  ? { ...r, count: r.count + 1, reactedByMe: true }
                  : r,
              ),
            };
          }),
        },
      };
    });
  }

  function simulateDelivered() {
    if (!selectedId) return;
    setState((prev) => {
      const list = [...(prev.messagesByConversation[selectedId] ?? [])].reverse();
      const target = list.find((m) => m.isOwn && m.status === "sent");
      if (!target) return prev;
      const next = applySimulatedReceipt(target.status, "delivered");
      if (!next) return prev;
      return updateFixtureMessageStatus(prev, selectedId, target.id, next);
    });
  }

  function simulateRead() {
    if (!selectedId) return;
    setState((prev) => {
      const list = [...(prev.messagesByConversation[selectedId] ?? [])].reverse();
      const target = list.find((m) => m.isOwn && m.status === "delivered");
      if (!target) {
        // Prefer marking delivered first; if none, try last sent via delivered step only
        return prev;
      }
      const next = applySimulatedReceipt(target.status, "read");
      if (!next) return prev;
      return updateFixtureMessageStatus(prev, selectedId, target.id, next);
    });
  }

  function simulateFailLastPending() {
    if (!selectedId) return;
    setState((prev) => {
      const list = [...(prev.messagesByConversation[selectedId] ?? [])].reverse();
      const target = list.find((m) => m.isOwn && m.status === "pending");
      if (!target) return prev;
      return updateFixtureMessageStatus(
        prev,
        selectedId,
        target.id,
        "failed",
        "Simulated send failure",
      );
    });
  }

  function handleAttachClick() {
    setComposerNotice(
      "WebRTC file transfer is prepared as interfaces only — not connected in Phase 3.",
    );
  }

  return {
    currentUser: {
      id: DEV_CURRENT_USER.id,
      displayName: DEV_CURRENT_USER.displayName,
      email: DEV_CURRENT_USER.email,
    },
    loadState,
    view,
    setView,
    searchQuery,
    setSearchQuery,
    conversations,
    selectedConversation,
    messages,
    demoTransfers: DEMO_FILE_TRANSFERS,
    mobileShowChat,
    draft,
    setDraft,
    composerNotice,
    replyTo,
    setReplyTo,
    isPending,
    newChatOpen,
    setNewChatOpen,
    startingUserId,
    startError,
    setStartError,
    startNotice,
    setStartNotice,
    directory: fixtureConversationDirectory,
    selectConversation,
    backToList,
    simulateLoadState,
    handleSend,
    handleAttachClick,
    handleStartWithUser,
    handleRetry,
    handleReply,
    handleToggleReaction,
    simulateDelivered,
    simulateRead,
    simulateFailLastPending,
  };
}
