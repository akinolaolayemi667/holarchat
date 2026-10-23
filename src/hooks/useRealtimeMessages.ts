"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { MessageRow } from "@/types/database";
import type { MessageView } from "@/lib/messages/queries";
import { toMessageView } from "@/lib/messages/queries";

interface UseRealtimeMessagesArgs {
  conversationId: string | null;
  userId: string;
  onUpsert: (message: MessageView) => void;
  enabled?: boolean;
}

/**
 * Subscribe to authorized postgres_changes for one conversation.
 * RLS on messages ensures unrelated conversations are not readable.
 */
export function useRealtimeMessages({
  conversationId,
  userId,
  onUpsert,
  enabled = true,
}: UseRealtimeMessagesArgs) {
  const onUpsertRef = useRef(onUpsert);

  useEffect(() => {
    onUpsertRef.current = onUpsert;
  }, [onUpsert]);

  useEffect(() => {
    if (!enabled || !conversationId) return;

    const supabase = createClient();
    let channel: RealtimeChannel | null = null;

    channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          onUpsertRef.current(toMessageView(row, userId, []));
        },
      )
      .subscribe();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [conversationId, userId, enabled]);
}
