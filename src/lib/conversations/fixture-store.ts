import { DEV_CURRENT_USER, DEV_DIRECTORY_USERS } from "@/lib/dev/directory";
import { resolveStartDirectConversation } from "@/lib/conversations/start-conversation";
import type {
  ChatMessageView,
  ChatParticipant,
  ConversationSummary,
  MessageDeliveryStatus,
  StartConversationOutcome,
} from "@/types/chat";

/**
 * In-memory fixture store for guest/dev UI only.
 * Lives in React state — NOT localStorage, NOT multi-user truth.
 */
export interface FixtureChatState {
  conversations: ConversationSummary[];
  messagesByConversation: Record<string, ChatMessageView[]>;
}

function participantFromDirectory(id: string): ChatParticipant | undefined {
  if (id === DEV_CURRENT_USER.id) return DEV_CURRENT_USER;
  return DEV_DIRECTORY_USERS.find((u) => u.id === id);
}

export function createInitialFixtureState(): FixtureChatState {
  const now = "2026-10-22T14:42:00.000Z";
  const conversations: ConversationSummary[] = [
    {
      id: "conv-1",
      kind: "direct",
      title: null,
      peer: participantFromDirectory("user-maya") ?? null,
      lastMessagePreview: "I'll send the brand kit over the peer channel.",
      lastMessageAt: now,
      updatedAt: now,
      unreadCount: 2,
    },
    {
      id: "conv-2",
      kind: "direct",
      title: null,
      peer: participantFromDirectory("user-jordan") ?? null,
      lastMessagePreview: "Can we review the onboarding flow tomorrow?",
      lastMessageAt: "2026-10-22T12:15:00.000Z",
      updatedAt: "2026-10-22T12:15:00.000Z",
      unreadCount: 0,
    },
    {
      id: "conv-3",
      kind: "direct",
      title: null,
      peer: participantFromDirectory("user-sam") ?? null,
      lastMessagePreview: "Thanks — got the zip once the transfer finished.",
      lastMessageAt: "2026-10-21T18:05:00.000Z",
      updatedAt: "2026-10-21T18:05:00.000Z",
      unreadCount: 0,
    },
  ];

  const messagesByConversation: Record<string, ChatMessageView[]> = {
    "conv-1": [
      {
        id: "msg-1a",
        conversationId: "conv-1",
        senderId: "user-maya",
        body: "Hey Alex — ready to try a peer-to-peer handoff of the brand assets?",
        createdAt: "2026-10-22T14:30:00.000Z",
        isOwn: false,
        status: "sent",
        clientId: null,
        replyTo: null,
        reactions: [{ emoji: "👍", count: 1, reactedByMe: false }],
      },
      {
        id: "msg-1b",
        conversationId: "conv-1",
        senderId: "user-me",
        body: "Yes. Keep the transfer under 100 MB for now while we finalize limits.",
        createdAt: "2026-10-22T14:32:00.000Z",
        isOwn: true,
        status: "sent",
        clientId: null,
        replyTo: null,
        reactions: [],
      },
      {
        id: "msg-1d",
        conversationId: "conv-1",
        senderId: "user-maya",
        body: "I'll send the brand kit over the peer channel.",
        createdAt: now,
        isOwn: false,
        status: "sent",
        clientId: null,
        replyTo: {
          id: "msg-1b",
          body: "Yes. Keep the transfer under 100 MB for now while we finalize limits.",
          authorName: "You",
        },
        reactions: [],
      },
    ],
    "conv-2": [
      {
        id: "msg-2a",
        conversationId: "conv-2",
        senderId: "user-jordan",
        body: "Can we review the onboarding flow tomorrow?",
        createdAt: "2026-10-22T12:15:00.000Z",
        isOwn: false,
        status: "sent",
        clientId: null,
        replyTo: null,
        reactions: [],
      },
    ],
    "conv-3": [
      {
        id: "msg-3a",
        conversationId: "conv-3",
        senderId: "user-sam",
        body: "Thanks — got the zip once the transfer finished.",
        createdAt: "2026-10-21T18:05:00.000Z",
        isOwn: false,
        status: "sent",
        clientId: null,
        replyTo: null,
        reactions: [],
      },
    ],
  };

  return { conversations, messagesByConversation };
}

export function startFixtureDirectConversation(
  state: FixtureChatState,
  peerId: string,
): { next: FixtureChatState; outcome: StartConversationOutcome } {
  const peer = participantFromDirectory(peerId);
  if (!peer) {
    return {
      next: state,
      outcome: {
        status: "error",
        code: "USER_NOT_FOUND",
        message: "That person is not in the local development directory.",
      },
    };
  }

  const resolved = resolveStartDirectConversation({
    peerId,
    existing: state.conversations,
    createId: () => `conv-local-${crypto.randomUUID()}`,
    nowIso: () => new Date().toISOString(),
    peerDisplayName: peer.displayName,
  });

  if (resolved.status === "error") {
    return { next: state, outcome: resolved };
  }

  if (resolved.status === "existing") {
    return { next: state, outcome: resolved };
  }

  const conversation = resolved.conversation!;
  conversation.peer = peer;

  return {
    next: {
      conversations: [conversation, ...state.conversations],
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversation.id]: [],
      },
    },
    outcome: { status: "created", conversationId: conversation.id },
  };
}

export function appendFixtureMessage(
  state: FixtureChatState,
  message: ChatMessageView,
): FixtureChatState {
  const list = state.messagesByConversation[message.conversationId] ?? [];
  const conversations = state.conversations.map((c) =>
    c.id === message.conversationId
      ? {
          ...c,
          lastMessagePreview: message.body,
          lastMessageAt: message.createdAt,
          updatedAt: message.createdAt,
          unreadCount: message.isOwn ? c.unreadCount : c.unreadCount,
        }
      : c,
  );

  return {
    conversations,
    messagesByConversation: {
      ...state.messagesByConversation,
      [message.conversationId]: [...list, message],
    },
  };
}

export function updateFixtureMessageStatus(
  state: FixtureChatState,
  conversationId: string,
  messageId: string,
  status: MessageDeliveryStatus,
  errorMessage?: string,
): FixtureChatState {
  const list = state.messagesByConversation[conversationId] ?? [];
  return {
    ...state,
    messagesByConversation: {
      ...state.messagesByConversation,
      [conversationId]: list.map((m) =>
        m.id === messageId ? { ...m, status, errorMessage } : m,
      ),
    },
  };
}

export function replaceFixtureMessage(
  state: FixtureChatState,
  conversationId: string,
  clientId: string,
  nextMessage: ChatMessageView,
): FixtureChatState {
  const list = state.messagesByConversation[conversationId] ?? [];
  return {
    ...state,
    messagesByConversation: {
      ...state.messagesByConversation,
      [conversationId]: list.map((m) => (m.clientId === clientId ? nextMessage : m)),
    },
  };
}

export interface ConversationDirectory {
  searchUsers(query: string): Promise<ChatParticipant[]>;
  startDirect(peerId: string, state: FixtureChatState): Promise<{
    next: FixtureChatState;
    outcome: StartConversationOutcome;
  }>;
}

/** Replaceable adapter — swap for Supabase-backed directory later. */
export const fixtureConversationDirectory: ConversationDirectory = {
  async searchUsers(query) {
    const { searchDevDirectory } = await import("@/lib/dev/directory");
    // Tiny delay so loading UI is visible in guest mode
    await new Promise((r) => setTimeout(r, 180));
    return searchDevDirectory(query);
  },
  async startDirect(peerId, state) {
    await new Promise((r) => setTimeout(r, 220));
    return startFixtureDirectConversation(state, peerId);
  },
};
