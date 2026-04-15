import type { SupabaseClient } from "@supabase/supabase-js";
import type { User, UserTier } from "@startup-edge/schema";

export async function getUser(
  client: SupabaseClient,
  userId: string,
): Promise<User | null> {
  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data as User;
}

export async function updateUser(
  client: SupabaseClient,
  userId: string,
  updates: { tier?: UserTier; timezone?: string },
): Promise<User | null> {
  const { data, error } = await client
    .from("users")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();

  if (error) return null;
  return data as User;
}

export async function setOnboarded(
  client: SupabaseClient,
  userId: string,
): Promise<User | null> {
  const { data, error } = await client
    .from("users")
    .update({
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) return null;
  return data as User;
}
