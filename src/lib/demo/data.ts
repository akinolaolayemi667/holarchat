import { formatBytes, formatListTime, formatMessageTime } from "@/lib/format";
import type { ConversationPreview } from "@/types/conversation";
import type { FileTransferProgress } from "@/types/file-transfer";
import type { ChatMessage } from "@/types/message";
import type { UserProfile } from "@/types/user";

export { formatBytes, formatListTime, formatMessageTime };

/** Local demo identity — not a real authenticated session. */
export const DEMO_CURRENT_USER: UserProfile = {
  id: "user-me",
  displayName: "Alex Rivera",
  email: "alex@example.com",
  demoStatus: "online",
};

export const DEMO_CONVERSATIONS: ConversationPreview[] = [
  {
    id: "conv-1",
    participant: {
      id: "user-maya",
      displayName: "Maya Chen",
      email: "maya@example.com",
      demoStatus: "online",
    },
    lastMessagePreview: "I'll send the brand kit over the peer channel.",
    lastMessageAt: "2026-10-22T14:42:00.000Z",
    unreadCount: 2,
    demoPeerStatus: "online",
  },
  {
    id: "conv-2",
    participant: {
      id: "user-jordan",
      displayName: "Jordan Blake",
      email: "jordan@example.com",
      demoStatus: "away",
    },
    lastMessagePreview: "Can we review the onboarding flow tomorrow?",
    lastMessageAt: "2026-10-22T12:15:00.000Z",
    unreadCount: 0,
    demoPeerStatus: "away",
  },
  {
    id: "conv-3",
    participant: {
      id: "user-sam",
      displayName: "Sam Okonkwo",
      email: "sam@example.com",
      demoStatus: "offline",
    },
    lastMessagePreview: "Thanks — got the zip once the transfer finished.",
    lastMessageAt: "2026-10-21T18:05:00.000Z",
    unreadCount: 0,
    demoPeerStatus: "offline",
  },
  {
    id: "conv-4",
    participant: {
      id: "user-riley",
      displayName: "Riley Nguyen",
      email: "riley@example.com",
      demoStatus: "online",
    },
    lastMessagePreview: "RelayChat looks sharp in the mockups.",
    lastMessageAt: "2026-10-21T09:30:00.000Z",
    unreadCount: 1,
    demoPeerStatus: "online",
  },
];

export const DEMO_MESSAGES: Record<string, ChatMessage[]> = {
  "conv-1": [
    {
      id: "msg-1a",
      conversationId: "conv-1",
      senderId: "user-maya",
      kind: "text",
      body: "Hey Alex — ready to try a peer-to-peer handoff of the brand assets?",
      createdAt: "2026-10-22T14:30:00.000Z",
      isOwn: false,
    },
    {
      id: "msg-1b",
      conversationId: "conv-1",
      senderId: "user-me",
      kind: "text",
      body: "Yes. Keep the transfer under 100 MB for now while we finalize limits.",
      createdAt: "2026-10-22T14:32:00.000Z",
      isOwn: true,
    },
    {
      id: "msg-1c",
      conversationId: "conv-1",
      senderId: "user-maya",
      kind: "file_notice",
      body: "File notice (demo only — transfer not active)",
      createdAt: "2026-10-22T14:40:00.000Z",
      isOwn: false,
      fileMeta: {
        name: "brand-kit.zip",
        sizeBytes: 48_200_000,
        mimeType: "application/zip",
      },
    },
    {
      id: "msg-1d",
      conversationId: "conv-1",
      senderId: "user-maya",
      kind: "text",
      body: "I'll send the brand kit over the peer channel.",
      createdAt: "2026-10-22T14:42:00.000Z",
      isOwn: false,
    },
  ],
  "conv-2": [
    {
      id: "msg-2a",
      conversationId: "conv-2",
      senderId: "user-jordan",
      kind: "text",
      body: "Can we review the onboarding flow tomorrow?",
      createdAt: "2026-10-22T12:15:00.000Z",
      isOwn: false,
    },
    {
      id: "msg-2b",
      conversationId: "conv-2",
      senderId: "user-me",
      kind: "text",
      body: "Works for me. I'll bring the latest wireframes.",
      createdAt: "2026-10-22T12:18:00.000Z",
      isOwn: true,
    },
  ],
  "conv-3": [
    {
      id: "msg-3a",
      conversationId: "conv-3",
      senderId: "user-sam",
      kind: "text",
      body: "Thanks — got the zip once the transfer finished.",
      createdAt: "2026-10-21T18:05:00.000Z",
      isOwn: false,
    },
  ],
  "conv-4": [
    {
      id: "msg-4a",
      conversationId: "conv-4",
      senderId: "user-riley",
      kind: "text",
      body: "RelayChat looks sharp in the mockups.",
      createdAt: "2026-10-21T09:30:00.000Z",
      isOwn: false,
    },
  ],
};

/** Visual-only transfer rows for the status panel. Not real transfers. */
export const DEMO_FILE_TRANSFERS: FileTransferProgress[] = [
  {
    id: "xfer-demo-1",
    conversationId: "conv-1",
    direction: "receive",
    peerUserId: "user-maya",
    fileName: "brand-kit.zip",
    mimeType: "application/zip",
    sizeBytes: 48_200_000,
    bytesTransferred: 31_200_000,
    status: "transferring",
    isDemo: true,
  },
  {
    id: "xfer-demo-2",
    conversationId: "conv-3",
    direction: "send",
    peerUserId: "user-sam",
    fileName: "sprint-notes.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2_400_000,
    bytesTransferred: 2_400_000,
    status: "completed",
    isDemo: true,
  },
];
