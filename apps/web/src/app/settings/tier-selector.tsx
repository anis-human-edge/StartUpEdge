"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { USER_TIERS } from "@startup-edge/schema";

const TIER_INFO = {
  essential: { label: "Essential", price: "\u00a3150/mo" },
  core: { label: "Core", price: "\u00a3500/mo" },
  edge: { label: "Edge", price: "\u00a31,800/mo" },
} as const;

export function TierSelector({ currentTier }: { currentTier: string }) {
  const [tier, setTier] = useState(currentTier);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleChange(newTier: string) {
    setTier(newTier);
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("users")
      .update({ tier: newTier, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {USER_TIERS.map((t) => {
        const info = TIER_INFO[t];
        return (
          <button
            key={t}
            type="button"
            onClick={() => handleChange(t)}
            disabled={saving}
            className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
              tier === t
                ? "border-foreground bg-foreground/5"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-foreground">{info.label}</span>
              <span className="text-sm text-muted-foreground">{info.price}</span>
            </div>
          </button>
        );
      })}
      {saving && (
        <p className="text-xs text-muted-foreground">Saving...</p>
      )}
    </div>
  );
}
