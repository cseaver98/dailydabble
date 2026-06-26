import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type AccountProfile = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  marketingEmailOptIn: boolean;
  dailyReminderOptIn: boolean;
  dailyReminderOptedInAt: string | null;
  dailyReminderPromptedAt: string | null;
  dailyReminderLastSentFor: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  marketing_email_opt_in: boolean | null;
  daily_reminder_opt_in: boolean | null;
  daily_reminder_opted_in_at: string | null;
  daily_reminder_prompted_at: string | null;
  daily_reminder_last_sent_for: string | null;
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
  if (!/^[A-Za-z0-9]+$/.test(normalized)) {
    throw new Error("Display name can only use letters and numbers.");
  }
  return normalized;
};

export async function getProfile(userId: string): Promise<AccountProfile | null> {
  const { data, error } = await getSupabaseAdmin()
    .schema("core")
    .from("profiles")
    .select("id,display_name,avatar_url,marketing_email_opt_in,daily_reminder_opt_in,daily_reminder_opted_in_at,daily_reminder_prompted_at,daily_reminder_last_sent_for")
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
    marketingEmailOptIn: Boolean(data.marketing_email_opt_in),
    dailyReminderOptIn: Boolean(data.daily_reminder_opt_in),
    dailyReminderOptedInAt: data.daily_reminder_opted_in_at,
    dailyReminderPromptedAt: data.daily_reminder_prompted_at,
    dailyReminderLastSentFor: data.daily_reminder_last_sent_for,
  };
}

export async function updateProfile({
  userId,
  displayName,
  avatarUrl,
  marketingEmailOptIn,
  dailyReminderOptIn,
  markDailyReminderPrompted,
}: {
  userId: string;
  displayName?: string;
  avatarUrl?: string | null;
  marketingEmailOptIn?: boolean;
  dailyReminderOptIn?: boolean;
  markDailyReminderPrompted?: boolean;
}) {
  const normalizedDisplayName = typeof displayName === "string" ? validateDisplayName(displayName) : undefined;
  const updatePayload = {
    id: userId,
    ...(normalizedDisplayName === undefined ? {} : { display_name: normalizedDisplayName }),
    ...(avatarUrl === undefined ? {} : { avatar_url: avatarUrl }),
    ...(marketingEmailOptIn === undefined ? {} : { marketing_email_opt_in: marketingEmailOptIn }),
    ...(dailyReminderOptIn === undefined
      ? {}
      : {
          daily_reminder_opt_in: dailyReminderOptIn,
          daily_reminder_opted_in_at: dailyReminderOptIn ? new Date().toISOString() : null,
        }),
    ...(markDailyReminderPrompted ? { daily_reminder_prompted_at: new Date().toISOString() } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await getSupabaseAdmin()
    .schema("core")
    .from("profiles")
    .upsert(updatePayload, { onConflict: "id" })
    .select("id,display_name,avatar_url,marketing_email_opt_in,daily_reminder_opt_in,daily_reminder_opted_in_at,daily_reminder_prompted_at,daily_reminder_last_sent_for")
    .single<ProfileRow>();

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  return {
    id: data.id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    marketingEmailOptIn: Boolean(data.marketing_email_opt_in),
    dailyReminderOptIn: Boolean(data.daily_reminder_opt_in),
    dailyReminderOptedInAt: data.daily_reminder_opted_in_at,
    dailyReminderPromptedAt: data.daily_reminder_prompted_at,
    dailyReminderLastSentFor: data.daily_reminder_last_sent_for,
  };
}
