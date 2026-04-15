"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { USER_TIERS } from "@startup-edge/schema";

const TIER_INFO = {
  essential: {
    label: "Essential",
    price: "\u00a3150/mo",
    description: "Haiku-powered briefing. Good for early pre-seed with a light pipeline.",
  },
  core: {
    label: "Core",
    price: "\u00a3500/mo",
    description: "Sonnet-powered briefing. For active fundraising or enterprise sales.",
  },
  edge: {
    label: "Edge",
    price: "\u00a31,800/mo",
    description: "Opus advisor + Sonnet executor. For large enterprise deals and high-stakes fundraising.",
  },
} as const;

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tier, setTier] = useState<(typeof USER_TIERS)[number]>("essential");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          tier,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/today");
    router.refresh();
  }

  async function handleGoogleSignUp() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a tier, then sign up. You can change your tier later in settings.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">Intelligence tier</label>
          <div className="space-y-2">
            {USER_TIERS.map((t) => {
              const info = TIER_INFO[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
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
                  <p className="mt-0.5 text-xs text-muted-foreground">{info.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="At least 8 characters"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignUp}
        >
          Continue with Google
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <a href="/sign-in" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
