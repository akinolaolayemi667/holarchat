export const MESSAGE_BODY_MIN = 1;
export const MESSAGE_BODY_MAX = 4000;

export type MessageValidationErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_CONVERSATION_ID"
  | "INVALID_BODY"
  | "INVALID_CLIENT_ID"
  | "EMPTY_BODY"
  | "BODY_TOO_LONG";

export class MessageValidationError extends Error {
  readonly code: MessageValidationErrorCode;

  constructor(code: MessageValidationErrorCode, message: string) {
    super(message);
    this.name = "MessageValidationError";
    this.code = code;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertUuid(value: string, code: MessageValidationErrorCode, label: string): string {
  const trimmed = value.trim();
  if (!UUID_RE.test(trimmed)) {
    throw new MessageValidationError(code, `${label} must be a valid UUID.`);
  }
  return trimmed;
}

export function normalizeMessageBody(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new MessageValidationError("INVALID_BODY", "Message body must be a string.");
  }

  const body = raw.trim();
  if (body.length < MESSAGE_BODY_MIN) {
    throw new MessageValidationError("EMPTY_BODY", "Message cannot be empty.");
  }
  if (body.length > MESSAGE_BODY_MAX) {
    throw new MessageValidationError(
      "BODY_TOO_LONG",
      `Message cannot exceed ${MESSAGE_BODY_MAX} characters.`,
    );
  }
  return body;
}

export function normalizeClientId(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new MessageValidationError("INVALID_CLIENT_ID", "client_id must be a UUID string.");
  }
  return assertUuid(raw, "INVALID_CLIENT_ID", "client_id");
}

export interface SendMessageInput {
  conversationId: string;
  body: string;
  clientId: string;
}

export function parseSendMessageInput(input: {
  conversationId: unknown;
  body: unknown;
  clientId: unknown;
}): SendMessageInput {
  return {
    conversationId: assertUuid(
      String(input.conversationId ?? ""),
      "INVALID_CONVERSATION_ID",
      "conversationId",
    ),
    body: normalizeMessageBody(input.body),
    clientId: normalizeClientId(input.clientId),
  };
}
