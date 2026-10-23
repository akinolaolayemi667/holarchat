import { EmptyState } from "@/components/ui/EmptyState";
import type { ConversationSummary } from "@/types/chat";
import { ConversationItem } from "./ConversationItem";

interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searching: boolean;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  searching,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <EmptyState
        title={searching ? "No matches" : "No conversations yet"}
        description={
          searching
            ? "Try a different name or clear the search field."
            : "Start a new chat with the + button. Guest chats use the local fixture directory only."
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-1 px-2 pb-4" role="list">
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <ConversationItem
            conversation={conversation}
            selected={conversation.id === selectedId}
            onSelect={() => onSelect(conversation.id)}
          />
        </li>
      ))}
    </ul>
  );
}
