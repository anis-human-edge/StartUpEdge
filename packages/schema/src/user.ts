import { z } from "zod/v4";

export const USER_TIERS = ["essential", "core", "edge"] as const;

export const userTierSchema = z.enum(USER_TIERS);
export type UserTier = z.infer<typeof userTierSchema>;

export const userSchema = z.object({
  id: z.uuid(),
  tier: userTierSchema,
  timezone: z.string(),
  onboarded_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export type User = z.infer<typeof userSchema>;
