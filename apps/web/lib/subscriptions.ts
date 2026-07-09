import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type SubscriptionStatus = "inactive" | "trialing" | "active" | "canceled" | "expired";
export type SubscriptionTier = "plus";

export type SubscriptionRecord = {
  id: string;
  userId: string;
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  source: string | null;
  startedAt: string | null;
  endsAt: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  source: string | null;
  started_at: string | null;
  ends_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionFeatureFlags = {
  subscriptionsEnabled: boolean;
  archiveSubscriptionsEnabled: boolean;
  premiumStatsEnabled: boolean;
  subscriberBadgesEnabled: boolean;
  testControlsEnabled: boolean;
};

export type SubscriptionAccess = {
  status: SubscriptionStatus;
  tier: SubscriptionTier | null;
  isSubscriber: boolean;
  canAccessArchive: boolean;
  canAccessPremiumStats: boolean;
  canAccessSubscriberBadges: boolean;
  flags: SubscriptionFeatureFlags;
  subscription: SubscriptionRecord | null;
};

const truthyValues = new Set(["1", "true", "yes", "on"]);

const readFlag = (name: string, fallback = false) => {
  const value = process.env[name];
  if (typeof value !== "string") {
    return fallback;
  }
  return truthyValues.has(value.trim().toLowerCase());
};

export const getSubscriptionFeatureFlags = (): SubscriptionFeatureFlags => {
  const subscriptionsEnabled = readFlag("SUBSCRIPTIONS_ENABLED");

  return {
    subscriptionsEnabled,
    archiveSubscriptionsEnabled: subscriptionsEnabled && readFlag("ARCHIVE_SUBSCRIPTIONS_ENABLED"),
    premiumStatsEnabled: subscriptionsEnabled && readFlag("PREMIUM_STATS_ENABLED"),
    subscriberBadgesEnabled: readFlag("SUBSCRIBER_BADGES_ENABLED", true),
    testControlsEnabled: process.env.NODE_ENV !== "production" || Boolean(process.env.SUBSCRIPTION_TEST_TOKEN),
  };
};

const mapSubscription = (row: SubscriptionRow): SubscriptionRecord => ({
  id: row.id,
  userId: row.user_id,
  status: row.status,
  tier: row.tier,
  source: row.source,
  startedAt: row.started_at,
  endsAt: row.ends_at,
  trialEndsAt: row.trial_ends_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const isFutureDate = (value: string | null) => {
  if (!value) {
    return true;
  }
  return new Date(value).getTime() > Date.now();
};

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .schema("core")
    .from("subscriptions")
    .select("id,user_id,status,tier,source,started_at,ends_at,trial_ends_at,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle<SubscriptionRow>();

  if (error) {
    throw new Error(`Failed to load subscription status: ${error.message}`);
  }

  return data ? mapSubscription(data) : null;
}

export const isSubscriptionActive = (subscription: SubscriptionRecord | null): boolean => {
  if (!subscription) {
    return false;
  }

  if (subscription.status === "active") {
    return isFutureDate(subscription.endsAt);
  }

  if (subscription.status === "trialing") {
    return isFutureDate(subscription.trialEndsAt);
  }

  return false;
};

export async function isSubscriber(userId: string): Promise<boolean> {
  return isSubscriptionActive(await getSubscriptionStatus(userId));
}

export async function getSubscriptionAccess(userId: string): Promise<SubscriptionAccess> {
  const flags = getSubscriptionFeatureFlags();
  const subscription = await getSubscriptionStatus(userId);
  const activeSubscriber = isSubscriptionActive(subscription);

  return {
    status: subscription?.status ?? "inactive",
    tier: subscription?.tier ?? null,
    isSubscriber: activeSubscriber,
    canAccessArchive: flags.archiveSubscriptionsEnabled && activeSubscriber,
    canAccessPremiumStats: flags.premiumStatsEnabled && activeSubscriber,
    canAccessSubscriberBadges: flags.subscriberBadgesEnabled && activeSubscriber,
    flags,
    subscription,
  };
}

export async function canAccessArchive(userId: string): Promise<boolean> {
  return (await getSubscriptionAccess(userId)).canAccessArchive;
}

export async function canAccessPremiumStats(userId: string): Promise<boolean> {
  return (await getSubscriptionAccess(userId)).canAccessPremiumStats;
}

export async function canAccessSubscriberBadges(userId: string): Promise<boolean> {
  return (await getSubscriptionAccess(userId)).canAccessSubscriberBadges;
}

export async function setTestSubscriptionStatus({
  userId,
  active,
  source = "manual_test",
}: {
  userId: string;
  active: boolean;
  source?: string;
}) {
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    status: active ? "active" as SubscriptionStatus : "inactive" as SubscriptionStatus,
    tier: "plus" as SubscriptionTier,
    source,
    started_at: active ? now : null,
    ends_at: null,
    trial_ends_at: null,
  };

  const { data, error } = await getSupabaseAdmin()
    .schema("core")
    .from("subscriptions")
    .upsert(payload, { onConflict: "user_id" })
    .select("id,user_id,status,tier,source,started_at,ends_at,trial_ends_at,created_at,updated_at")
    .single<SubscriptionRow>();

  if (error) {
    throw new Error(`Failed to update test subscription: ${error.message}`);
  }

  return mapSubscription(data);
}
