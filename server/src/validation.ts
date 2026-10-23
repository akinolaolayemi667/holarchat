import { z } from "zod";

const roomIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "roomId must be alphanumeric, underscore, or hyphen");

const guestIdSchema = z
  .string()
  .trim()
  .regex(/^guest_[a-f0-9-]{8,}$/i, "invalid guestId");

const displayNameSchema = z.string().trim().min(1).max(40);

export const guestAuthSchema = z.object({
  mode: z.literal("guest"),
  displayName: displayNameSchema,
});

export const roomJoinSchema = z.object({
  roomId: roomIdSchema,
});

export const roomLeaveSchema = z.object({
  roomId: roomIdSchema,
});

function payloadString(maxChars: number) {
  return z.string().min(1).max(maxChars);
}

export function createOfferSchema(maxChars: number) {
  return z.object({
    roomId: roomIdSchema,
    toGuestId: guestIdSchema,
    sdp: payloadString(maxChars),
  });
}

export function createAnswerSchema(maxChars: number) {
  return z.object({
    roomId: roomIdSchema,
    toGuestId: guestIdSchema,
    sdp: payloadString(maxChars),
  });
}

export function createIceSchema(maxChars: number) {
  return z.object({
    roomId: roomIdSchema,
    toGuestId: guestIdSchema,
    candidate: payloadString(maxChars),
  });
}

export type GuestAuthInput = z.infer<typeof guestAuthSchema>;
export type RoomJoinInput = z.infer<typeof roomJoinSchema>;
