"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import {
  assertAvatarFile,
  parseProfileUpdateInput,
  ProfileValidationError,
} from "./validation";

export type ProfileActionResult<T> =
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

/** Read: load the signed-in user's profile row. */
export async function getOwnProfileAction(): Promise<ProfileActionResult<Profile>> {
  try {
    const { supabase, userId } = await requireUserId();
    if (!userId) {
      return { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return { ok: false, error: { code: error.code ?? "QUERY_FAILED", message: error.message } };
    }
    if (!data) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Profile not found. Create one to continue." },
      };
    }
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load profile.";
    return { ok: false, error: { code: "READ_FAILED", message } };
  }
}

/**
 * Create: insert own profile if missing (Auth trigger normally does this).
 * Does not create auth users — only the public.profiles row for the current session.
 */
export async function createOwnProfileAction(input: {
  displayName: string;
}): Promise<ProfileActionResult<Profile>> {
  try {
    const { supabase, userId } = await requireUserId();
    if (!userId) {
      return { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
    }

    const parsed = parseProfileUpdateInput({
      displayName: input.displayName,
      phoneNumber: null,
      bio: null,
      statusMessage: null,
    });

    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (existing) {
      return { ok: true, data: existing };
    }

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        display_name: parsed.displayName,
      })
      .select("*")
      .single();

    if (error) {
      return { ok: false, error: { code: error.code ?? "INSERT_FAILED", message: error.message } };
    }

    revalidatePath("/chat");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ProfileValidationError) {
      return { ok: false, error: { code: err.code, message: err.message } };
    }
    const message = err instanceof Error ? err.message : "Failed to create profile.";
    return { ok: false, error: { code: "CREATE_FAILED", message } };
  }
}

/** Update: display name, phone, bio, status. */
export async function updateOwnProfileAction(input: {
  displayName: string;
  phoneNumber?: string | null;
  bio?: string | null;
  statusMessage?: string | null;
}): Promise<ProfileActionResult<Profile>> {
  try {
    const { supabase, userId } = await requireUserId();
    if (!userId) {
      return { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
    }

    const parsed = parseProfileUpdateInput(input);

    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.displayName,
        phone_number: parsed.phoneNumber,
        bio: parsed.bio,
        status_message: parsed.statusMessage,
      })
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      return { ok: false, error: { code: error.code ?? "UPDATE_FAILED", message: error.message } };
    }

    revalidatePath("/chat");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ProfileValidationError) {
      return { ok: false, error: { code: err.code, message: err.message } };
    }
    const message = err instanceof Error ? err.message : "Failed to update profile.";
    return { ok: false, error: { code: "UPDATE_FAILED", message } };
  }
}

/** Upload avatar image to Storage and set profiles.avatar_url. */
export async function uploadOwnAvatarAction(
  formData: FormData,
): Promise<ProfileActionResult<Profile>> {
  try {
    const { supabase, userId } = await requireUserId();
    if (!userId) {
      return { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
    }

    const file = formData.get("avatar");
    if (!(file instanceof File)) {
      return {
        ok: false,
        error: { code: "MISSING_FILE", message: "Choose an image file to upload." },
      };
    }

    assertAvatarFile(file);

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "jpg";
    const path = `${userId}/avatar.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, bytes, {
      contentType: file.type,
      upsert: true,
      cacheControl: "3600",
    });

    if (uploadError) {
      return {
        ok: false,
        error: { code: "UPLOAD_FAILED", message: uploadError.message },
      };
    }

    const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;

    const { data, error } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      return { ok: false, error: { code: error.code ?? "UPDATE_FAILED", message: error.message } };
    }

    revalidatePath("/chat");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ProfileValidationError) {
      return { ok: false, error: { code: err.code, message: err.message } };
    }
    const message = err instanceof Error ? err.message : "Failed to upload avatar.";
    return { ok: false, error: { code: "UPLOAD_FAILED", message } };
  }
}

/**
 * Delete (safe): clear optional fields and remove avatar object.
 * Does not delete auth.users or the profiles PK (would break conversation FKs).
 */
export async function clearOwnProfileExtrasAction(): Promise<ProfileActionResult<Profile>> {
  try {
    const { supabase, userId } = await requireUserId();
    if (!userId) {
      return { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
    }

    const { data: current } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!current) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Profile not found." } };
    }

    // Best-effort remove stored objects under the user's folder.
    const { data: listed } = await supabase.storage.from("avatars").list(userId);
    if (listed && listed.length > 0) {
      const paths = listed.map((obj) => `${userId}/${obj.name}`);
      await supabase.storage.from("avatars").remove(paths);
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        phone_number: null,
        bio: null,
        status_message: null,
        avatar_url: null,
      })
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      return { ok: false, error: { code: error.code ?? "CLEAR_FAILED", message: error.message } };
    }

    revalidatePath("/chat");
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to clear profile extras.";
    return { ok: false, error: { code: "CLEAR_FAILED", message } };
  }
}

/** Delete avatar only (keep name/phone/bio). */
export async function removeOwnAvatarAction(): Promise<ProfileActionResult<Profile>> {
  try {
    const { supabase, userId } = await requireUserId();
    if (!userId) {
      return { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
    }

    const { data: listed } = await supabase.storage.from("avatars").list(userId);
    if (listed && listed.length > 0) {
      await supabase.storage.from("avatars").remove(listed.map((obj) => `${userId}/${obj.name}`));
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      return { ok: false, error: { code: error.code ?? "UPDATE_FAILED", message: error.message } };
    }

    revalidatePath("/chat");
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove avatar.";
    return { ok: false, error: { code: "REMOVE_FAILED", message } };
  }
}
