export class ProfileValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export type ProfileUpdateInput = {
  displayName: string;
  phoneNumber: string | null;
  bio: string | null;
  statusMessage: string | null;
};

const PHONE_RE = /^\+?[0-9][0-9\s\-().]{5,18}[0-9]$/;

export function normalizeDisplayName(raw: string): string {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < 1 || value.length > 80) {
    throw new ProfileValidationError(
      "INVALID_DISPLAY_NAME",
      "Display name must be 1–80 characters.",
    );
  }
  return value;
}

export function normalizePhoneNumber(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.length < 7 || value.length > 20 || !PHONE_RE.test(value)) {
    throw new ProfileValidationError(
      "INVALID_PHONE",
      "Enter a valid phone number (7–20 digits; country code optional).",
    );
  }
  return value;
}

export function normalizeBio(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.length > 280) {
    throw new ProfileValidationError("INVALID_BIO", "Bio must be at most 280 characters.");
  }
  return value;
}

export function normalizeStatusMessage(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return null;
  if (value.length > 120) {
    throw new ProfileValidationError(
      "INVALID_STATUS",
      "Status must be at most 120 characters.",
    );
  }
  return value;
}

export function parseProfileUpdateInput(input: {
  displayName: string;
  phoneNumber?: string | null;
  bio?: string | null;
  statusMessage?: string | null;
}): ProfileUpdateInput {
  return {
    displayName: normalizeDisplayName(input.displayName),
    phoneNumber: normalizePhoneNumber(input.phoneNumber),
    bio: normalizeBio(input.bio),
    statusMessage: normalizeStatusMessage(input.statusMessage),
  };
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function assertAvatarFile(file: { type: string; size: number }): void {
  if (!AVATAR_MIME.has(file.type)) {
    throw new ProfileValidationError(
      "INVALID_AVATAR_TYPE",
      "Avatar must be JPEG, PNG, WebP, or GIF.",
    );
  }
  if (file.size <= 0 || file.size > AVATAR_MAX_BYTES) {
    throw new ProfileValidationError(
      "INVALID_AVATAR_SIZE",
      "Avatar must be between 1 byte and 2 MB.",
    );
  }
}
