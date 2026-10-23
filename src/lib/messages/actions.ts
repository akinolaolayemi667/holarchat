"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  MessageValidationError,
  parseSendMessageInput,
} from "@/lib/messages/validation";
import { listConversationsForUser, listMessagesPage, toMessageView } from "@/lib/messages/queries";
import type { MessageView } from "@/lib/messages/queries";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

async function requireUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    return { supabase, userId: null as string | null };
  }
  return { supabase, userId: data.claims.sub as string };
}

export async function getConversationsAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof listConversationsForUser>>>
> {
  try {
    const { supabase, userId } = await requireUserId();
    if (!userId) {
      return { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
    }
    const data = await listConversationsForUser(supabase, userId);
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load conversations.";
    return { ok: false, error: { code: "QUERY_FAILED", message } };
  }
}

export async function getMessagesAction(input: {
  conversationId: string;
  beforeCreatedAt?: string;
  beforeId?: string;
}): Promise<ActionResult<MessageView[]>> {
  try {
    const { supabase, userId } = await requireUserId();
    if (!userId) {
      return { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
    }

    const data = await listMessagesPage(supabase, {
      conversationId: input.conversationId,
      userId,
      before:
        input.beforeCreatedAt && input.beforeId
          ? { createdAt: input.beforeCreatedAt, id: input.beforeId }
          : null,
    });
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load messages.";
    return { ok: false, error: { code: "QUERY_FAILED", message } };
  }
}

export async function sendMessageAction(input: {
  conversationId: string;
  body: string;
  clientId: string;
}): Promise<ActionResult<MessageView>> {
  try {
    const parsed = parseSendMessageInput(input);
    const { supabase, userId } = await requireUserId();
    if (!userId) {
      return { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
    }

    // Idempotent path: if this client_id already exists for the user, return it.
    const { data: existing } = await supabase
      .from("messages")
      .select("*")
      .eq("client_id", parsed.clientId)
      .maybeSingle();

    if (existing) {
      if (existing.sender_id !== userId) {
        return {
          ok: false,
          error: { code: "CLIENT_ID_CONFLICT", message: "Duplicate client_id conflict." },
        };
      }
      return { ok: true, data: toMessageView(existing, userId, []) };
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: parsed.conversationId,
        body: parsed.body,
        message_type: "text",
        client_id: parsed.clientId,
        sender_id: userId,
      })
      .select("*")
      .single();

    if (error) {
      // Unique violation on client_id — fetch and return
      if (error.code === "23505") {
        const { data: raced } = await supabase
          .from("messages")
          .select("*")
          .eq("client_id", parsed.clientId)
          .maybeSingle();
        if (raced && raced.sender_id === userId) {
          return { ok: true, data: toMessageView(raced, userId, []) };
        }
      }
      return { ok: false, error: { code: error.code ?? "INSERT_FAILED", message: error.message } };
    }

    revalidatePath("/chat");
    return { ok: true, data: toMessageView(data, userId, []) };
  } catch (err) {
    if (err instanceof MessageValidationError) {
      return { ok: false, error: { code: err.code, message: err.message } };
    }
    const message = err instanceof Error ? err.message : "Failed to send message.";
    return { ok: false, error: { code: "SEND_FAILED", message } };
  }
}

export async function createDirectConversationAction(
  otherUserId: string,
): Promise<ActionResult<{ conversationId: string }>> {
  try {
    const { supabase, userId } = await requireUserId();
    if (!userId) {
      return { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
    }

    const { data, error } = await supabase.rpc("create_direct_conversation", {
      other_user_id: otherUserId,
    });

    if (error) {
      return { ok: false, error: { code: error.code ?? "RPC_FAILED", message: error.message } };
    }

    revalidatePath("/chat");
    return { ok: true, data: { conversationId: data } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create conversation.";
    return { ok: false, error: { code: "CREATE_FAILED", message } };
  }
}

export async function markDeliveredAction(messageIds: string[]): Promise<ActionResult<null>> {
  try {
    const { supabase, userId } = await requireUserId();
    if (!userId) {
      return { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
    }
    if (messageIds.length === 0) return { ok: true, data: null };

    const { error } = await supabase.rpc("mark_messages_delivered", {
      p_message_ids: messageIds,
    });
    if (error) {
      return { ok: false, error: { code: error.code ?? "RPC_FAILED", message: error.message } };
    }
    return { ok: true, data: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to mark delivered.";
    return { ok: false, error: { code: "DELIVERY_FAILED", message } };
  }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}
