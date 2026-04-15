import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

export default async function TodayPage() {
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

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-medium text-foreground">Today</h1>
        <div className="flex items-center gap-4">
          <a
            href="/settings"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Settings
          </a>
          <SignOutButton />
        </div>
      </div>

      <div className="mt-8 rounded-md border border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No briefing yet. Connect your data sources in{" "}
          <a href="/settings" className="underline underline-offset-4">
            settings
          </a>{" "}
          to get started.
        </p>
        {profile && (
          <p className="mt-4 text-xs text-muted-foreground">
            Signed in as {user.email} on the {profile.tier} tier.
          </p>
        )}
      </div>
    </main>
  );
}
