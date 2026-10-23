import type { MessageDeliveryStatus } from "@/types/chat";

const ORDER: MessageDeliveryStatus[] = ["pending", "sent", "delivered", "read"];

/**
 * Allowed transitions. Delivered/read require an explicit receipt event —
 * never auto-advance from sent → delivered in UI code.
 */
export function canTransitionMessageStatus(
  from: MessageDeliveryStatus,
  to: MessageDeliveryStatus,
): boolean {
  if (from === to) return true;
  if (from === "failed") return to === "pending" || to === "sent";
  if (to === "failed") return from === "pending" || from === "sent";
  if (from === "pending" && to === "sent") return true;

  const fromIdx = ORDER.indexOf(from);
  const toIdx = ORDER.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  // Only forward one step at a time for receipt states
  return toIdx === fromIdx + 1;
}

export function applySimulatedReceipt(
  status: MessageDeliveryStatus,
  event: "delivered" | "read",
): MessageDeliveryStatus | null {
  if (event === "delivered") {
    return canTransitionMessageStatus(status, "delivered") ? "delivered" : null;
  }
  return canTransitionMessageStatus(status, "read") ? "read" : null;
}

export function statusLabel(status: MessageDeliveryStatus): string {
  switch (status) {
    case "pending":
      return "Sending…";
    case "sent":
      return "Sent";
    case "delivered":
      return "Delivered";
    case "read":
      return "Read";
    case "failed":
      return "Failed";
  }
}
