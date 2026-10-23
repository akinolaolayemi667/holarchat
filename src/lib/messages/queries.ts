import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MessageDelivery, MessageRow, Profile } from "@/types/database";

export type AppSupabaseClient = SupabaseClient<Database>;

export interface ConversationListItem {
  id: string;
  type: "direct" | "group";
  title: string | null;
  updatedAt: string;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  peer: Profile | null;
  unreadCount: number;
}

export interface MessageView {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  messageType: "text" | "system";
  clientId: string | null;
  createdAt: string;
  isOwn: boolean;
  /** Aggregate receipt state for the sender's own messages. */
  receipt: "persisted" | "delivered" | "read";
}

const PAGE_SIZE = 50;

export async function listConversationsForUser(
  supabase: AppSupabaseClient,
  userId: string,
): Promise<ConversationListItem[]> {
  const { data: memberships, error: memberError } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);

  if (memberError) throw memberError;

  const conversationIds = (memberships ?? []).map((m) => m.conversation_id);
  if (conversationIds.length === 0) return [];

  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select("id, type, title, updated_at")
    .in("id", conversationIds)
    .order("updated_at", { ascending: false });

  if (convError) throw convError;

  const items: ConversationListItem[] = [];

  for (const conversation of conversations ?? []) {
    const { data: members } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversation.id);

    const otherIds = (members ?? []).map((m) => m.user_id).filter((id) => id !== userId);

    let peer: Profile | null = null;
    if (conversation.type === "direct" && otherIds[0]) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", otherIds[0])
        .maybeSingle();
      peer = profile;
    }

    const { data: latest } = await supabase
      .from("messages")
      .select("body, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    items.push({
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      updatedAt: conversation.updated_at,
      lastMessagePreview: latest?.body ?? "No messages yet",
      lastMessageAt: latest?.created_at ?? null,
      peer,
      unreadCount: 0,
    });
  }

  return items;
}

export async function listMessagesPage(
  supabase: AppSupabaseClient,
  args: {
    conversationId: string;
    userId: string;
    before?: { createdAt: string; id: string } | null;
    limit?: number;
  },
): Promise<MessageView[]> {
  const limit = args.limit ?? PAGE_SIZE;

  let query = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", args.conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (args.before) {
    // Keyset pagination: rows strictly older than the cursor
    query = query.or(
      `created_at.lt.${args.before.createdAt},and(created_at.eq.${args.before.createdAt},id.lt.${args.before.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as MessageRow[];
  const messageIds = rows.map((r) => r.id);

  let deliveries: MessageDelivery[] = [];
  if (messageIds.length > 0) {
    const { data: deliveryRows, error: deliveryError } = await supabase
      .from("message_deliveries")
      .select("*")
      .in("message_id", messageIds);
    if (deliveryError) throw deliveryError;
    deliveries = deliveryRows ?? [];
  }

  const views = rows.map((row) => toMessageView(row, args.userId, deliveries));
  return views.reverse();
}

export function toMessageView(
  row: MessageRow,
  userId: string,
  deliveries: MessageDelivery[],
): MessageView {
  const isOwn = row.sender_id === userId;
  let receipt: MessageView["receipt"] = "persisted";

  if (isOwn) {
    const related = deliveries.filter((d) => d.message_id === row.id);
    if (related.some((d) => d.read_at)) receipt = "read";
    else if (related.some((d) => d.delivered_at)) receipt = "delivered";
  }

  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    messageType: row.message_type,
    clientId: row.client_id,
    createdAt: row.created_at,
    isOwn,
    receipt,
  };
}
