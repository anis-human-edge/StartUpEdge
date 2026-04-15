import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TierSelector } from "./tier-selector";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-medium text-foreground">Settings</h1>
        <a
          href="/today"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to today
        </a>
      </div>

      <section className="mt-8 space-y-6">
        <div>
          <h2 className="text-sm font-medium text-foreground">Account</h2>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>

        <div>
          <h2 className="text-sm font-medium text-foreground">Timezone</h2>
          <p className="mt-1 text-sm text-muted-foreground">{profile.timezone}</p>
        </div>

        <div>
          <h2 className="text-sm font-medium text-foreground">Intelligence tier</h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">
            Controls which model powers your daily briefing. No billing yet.
          </p>
          <TierSelector currentTier={profile.tier} />
        </div>
      </section>
    </main>
  );
}
