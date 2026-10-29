"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  getConversationsAction,
  getMessagesAction,
  markDeliveredAction,
  sendMessageAction,
} from "@/lib/messages/actions";
import type { ConversationListItem, MessageView } from "@/lib/messages/queries";
import type { Profile } from "@/types/database";
import type { WorkspaceView } from "@/types/ui";
import { useRealtimeMessages } from "./useRealtimeMessages";

function mergeMessage(existing: MessageView[], incoming: MessageView): MessageView[] {
  const byId = existing.findIndex((m) => m.id === incoming.id);
  if (byId >= 0) {
    const copy = [...existing];
    copy[byId] = { ...copy[byId], ...incoming };
    return copy;
  }

  if (incoming.clientId) {
    const byClient = existing.findIndex((m) => m.clientId === incoming.clientId);
    if (byClient >= 0) {
      const copy = [...existing];
      copy[byClient] = incoming;
      return copy;
    }
  }

  return [...existing, incoming].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

interface UseLiveChatArgs {
  userId: string;
  profile: Profile;
  initialConversations: ConversationListItem[];
}

export function useLiveChat({ userId, profile, initialConversations }: UseLiveChatArgs) {
  const [view, setView] = useState<WorkspaceView>("chat");
  const [liveProfile, setLiveProfile] = useState<Profile>(profile);
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] =
    useState<ConversationListItem[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversations[0]?.id ?? null,
  );
  const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, MessageView[]>
  >({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreByConversation, setHasMoreByConversation] = useState<Record<string, boolean>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [realtimeTick, setRealtimeTick] = useState(0);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const messages = selectedId ? (messagesByConversation[selectedId] ?? []) : [];
  const hasMore = selectedId ? (hasMoreByConversation[selectedId] ?? true) : false;

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = c.peer?.display_name ?? c.title ?? "";
      return (
        name.toLowerCase().includes(q) || c.lastMessagePreview.toLowerCase().includes(q)
      );
    });
  }, [conversations, searchQuery]);

  const connectionLabel = selectedId
    ? realtimeTick > 0
      ? "Realtime connected"
      : "Realtime listening (RLS-filtered)"
    : "Select a conversation";

  const refreshConversations = useCallback(async () => {
    const result = await getConversationsAction();
    if (result.ok) setConversations(result.data);
  }, []);

  useEffect(() => {
    if (!selectedId) return;

    let cancelled = false;

    void (async () => {
      const result = await getMessagesAction({ conversationId: selectedId });
      if (cancelled) return;

      if (!result.ok) {
        setError(result.error.message);
        setMessagesByConversation((prev) => ({ ...prev, [selectedId]: [] }));
        setLoadingMessages(false);
        return;
      }

      setError(null);
      setMessagesByConversation((prev) => ({ ...prev, [selectedId]: result.data }));
      setHasMoreByConversation((prev) => ({
        ...prev,
        [selectedId]: result.data.length >= 50,
      }));
      setLoadingMessages(false);

      const incomingIds = result.data.filter((m) => !m.isOwn).map((m) => m.id);
      if (incomingIds.length > 0) {
        void markDeliveredAction(incomingIds);
      }
    })();

    // Mark loading only after scheduling async work via transition to avoid sync setState lint
    startTransition(() => {
      setLoadingMessages(true);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedId, startTransition]);

  useRealtimeMessages({
    conversationId: selectedId,
    userId,
    enabled: Boolean(selectedId),
    onUpsert: (message) => {
      setRealtimeTick((n) => n + 1);
      setMessagesByConversation((prev) => ({
        ...prev,
        [message.conversationId]: mergeMessage(prev[message.conversationId] ?? [], message),
      }));
      if (!message.isOwn) {
        void markDeliveredAction([message.id]);
      }
      void refreshConversations();
    },
  });

  function selectConversation(id: string) {
    startTransition(() => {
      setSelectedId(id);
      setMobileShowChat(true);
      setComposerNotice(null);
      setView("chat");
      setError(null);
    });
  }

  async function loadOlder() {
    if (!selectedId || messages.length === 0 || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    const oldest = messages[0];
    const result = await getMessagesAction({
      conversationId: selectedId,
      beforeCreatedAt: oldest.createdAt,
      beforeId: oldest.id,
    });
    setLoadingOlder(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    if (result.data.length === 0) {
      setHasMoreByConversation((prev) => ({ ...prev, [selectedId]: false }));
      return;
    }
    setMessagesByConversation((prev) => {
      let next = prev[selectedId] ?? [];
      for (const msg of result.data) next = mergeMessage(next, msg);
      return { ...prev, [selectedId]: next };
    });
    setHasMoreByConversation((prev) => ({
      ...prev,
      [selectedId]: result.data.length >= 50,
    }));
  }

  async function handleSend() {
    if (!selectedId) return;
    const body = draft.trim();
    if (!body) return;

    const clientId = crypto.randomUUID();
    const optimistic: MessageView = {
      id: `optimistic-${clientId}`,
      conversationId: selectedId,
      senderId: userId,
      body,
      messageType: "text",
      clientId,
      createdAt: new Date().toISOString(),
      isOwn: true,
      receipt: "persisted",
    };

    setDraft("");
    setComposerNotice(null);
    setMessagesByConversation((prev) => ({
      ...prev,
      [selectedId]: mergeMessage(prev[selectedId] ?? [], optimistic),
    }));

    const result = await sendMessageAction({
      conversationId: selectedId,
      body,
      clientId,
    });

    if (!result.ok) {
      setMessagesByConversation((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] ?? []).filter((m) => m.clientId !== clientId),
      }));
      setComposerNotice(result.error.message);
      setDraft(body);
      return;
    }

    setMessagesByConversation((prev) => ({
      ...prev,
      [selectedId]: mergeMessage(prev[selectedId] ?? [], result.data),
    }));
    void refreshConversations();
  }

  function handleAttachClick() {
    setComposerNotice(
      "Peer-to-peer file transfer via WebRTC DataChannels is planned for a later phase. Not available yet.",
    );
  }

  return {
    liveProfile,
    setLiveProfile,
    currentUser: {
      id: liveProfile.id,
      displayName: liveProfile.display_name,
      email: "",
      avatarUrl: liveProfile.avatar_url ?? undefined,
      phoneNumber: liveProfile.phone_number ?? undefined,
      bio: liveProfile.bio ?? undefined,
      statusMessage: liveProfile.status_message ?? undefined,
    },
    view,
    setView,
    searchQuery,
    setSearchQuery,
    conversations: filteredConversations,
    selectedConversation,
    messages,
    mobileShowChat,
    draft,
    setDraft,
    composerNotice,
    isPending,
    loadingMessages,
    loadingOlder,
    hasMore,
    error,
    connectionLabel,
    selectConversation,
    backToList: () => setMobileShowChat(false),
    handleSend,
    handleAttachClick,
    loadOlder,
  };
}
