export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ConversationType = "direct" | "group";
export type MemberRole = "owner" | "member";
export type MessageType = "text" | "system";

/**
 * Delivery vocabulary (beginner-friendly):
 * - persisted: the message row exists in Postgres (server accepted the write).
 * - delivered: a recipient recorded receipt in message_deliveries.delivered_at.
 * - read: a recipient recorded read in message_deliveries.read_at.
 * Persisting ≠ delivered to every recipient.
 */
export type DeliveryReceiptState = "persisted" | "delivered" | "read";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          type: ConversationType;
          title: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: ConversationType;
          title?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          user_id: string;
          role: MemberRole;
          joined_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          role?: MemberRole;
          joined_at?: string;
        };
        Update: {
          role?: MemberRole;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          message_type: MessageType;
          client_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id?: string;
          body: string;
          message_type?: MessageType;
          client_id?: string | null;
          created_at?: string;
        };
        Update: {
          body?: string;
        };
        Relationships: [];
      };
      message_deliveries: {
        Row: {
          message_id: string;
          user_id: string;
          delivered_at: string | null;
          read_at: string | null;
        };
        Insert: {
          message_id: string;
          user_id: string;
          delivered_at?: string | null;
          read_at?: string | null;
        };
        Update: {
          delivered_at?: string | null;
          read_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_direct_conversation: {
        Args: { other_user_id: string };
        Returns: string;
      };
      create_group_conversation: {
        Args: { p_title: string; member_ids: string[] };
        Returns: string;
      };
      mark_messages_delivered: {
        Args: { p_message_ids: string[] };
        Returns: undefined;
      };
      mark_messages_read: {
        Args: { p_message_ids: string[] };
        Returns: undefined;
      };
    };
    Enums: {
      conversation_type: ConversationType;
      member_role: MemberRole;
      message_type: MessageType;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type ConversationMember = Database["public"]["Tables"]["conversation_members"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type MessageDelivery = Database["public"]["Tables"]["message_deliveries"]["Row"];
