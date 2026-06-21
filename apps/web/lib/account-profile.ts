import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type AccountProfile = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export const normalizeDisplayName = (value: string) => value.trim().replace(/\s+/g, " ");

export const validateDisplayName = (value: string) => {
  const normalized = normalizeDisplayName(value);
  if (normalized.length < 2) {
    throw new Error("Display name must be at least 2 characters.");
  }
  if (normalized.length > 32) {
    throw new Error("Display name must be 32 characters or fewer.");
  }
  return normalized;
};

export async function getProfile(userId: string): Promise<AccountProfile | null> {
  const { data, error } = await getSupabaseAdmin()
    .schema("core")
    .from("profiles")
    .select("id,display_name,avatar_url")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
  };
}

export async function updateProfile({
  userId,
  displayName,
  avatarUrl,
}: {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
}) {
  const normalizedDisplayName = validateDisplayName(displayName);
  const { data, error } = await getSupabaseAdmin()
    .schema("core")
    .from("profiles")
    .upsert(
      {
        id: userId,
        display_name: normalizedDisplayName,
        ...(avatarUrl === undefined ? {} : { avatar_url: avatarUrl }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id,display_name,avatar_url")
    .single<ProfileRow>();

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  return {
    id: data.id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
  };
}
