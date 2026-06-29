"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ensureProfile } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import type { UserRole } from "@/types/database";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [message, setMessage] = useState("Create a real Taxiro account stored in Supabase.");
  const [loading, setLoading] = useState(false);

  function validateForm() {
    if (!email.includes("@")) {
      return "Enter a valid email address.";
    }
    if (password.length < 6) {
      return "Password must be at least 6 characters.";
    }
    if (mode === "signup" && !fullName.trim()) {
      return "Enter your full name.";
    }
    return null;
  }

  function authMessage(error: unknown) {
    const status = typeof error === "object" && error && "status" in error
      ? Number((error as { status?: number }).status)
      : null;
    const message = error instanceof Error ? error.message : "Authentication failed.";

    if (status === 429 || message.toLowerCase().includes("rate")) {
      return "Too many signup attempts. Taxiro now uses auto-confirm for new accounts, but Supabase may need a minute before accepting another signup. Please wait briefly and try once.";
    }
    if (message.toLowerCase().includes("already registered")) {
      return "This email already has an account. Switch to Sign in.";
    }
    return message;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      setMessage(validationError);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setMessage("Supabase env variables are missing.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone,
              role,
            },
          },
        });
        if (error) {
          setMessage(authMessage(error));
          return;
        }
        if (!data.session) {
          setMessage("Account created. If confirmation is enabled later, check email before signing in.");
          return;
        }
        if (data.user) {
          const profile = await ensureProfile(supabase, data.user, role);
          router.push(profile.role === "rider" ? "/dashboard/rider" : "/dashboard/user");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error || !data.user) {
          setMessage(error ? authMessage(error) : "Sign in failed.");
          return;
        }
        const profile = await ensureProfile(supabase, data.user, role);
        router.push(profile.role === "rider" ? "/dashboard/rider" : "/dashboard/user");
      }
      router.refresh();
    } catch (error) {
      setMessage(authMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[100svh] overflow-hidden bg-[#101713] px-3 py-4 text-white sm:px-4 sm:py-6">
      <div className="mx-auto grid min-h-[calc(100svh-2rem)] max-w-6xl items-center gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block">
          <p className="mb-4 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/70">
            Taxiro account
          </p>
          <h1 className="max-w-xl text-6xl font-black tracking-tight">
            One login. Two real ride modes.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-white/60">
            Users book and confirm rides. Riders go online, accept ready jobs, verify the private code, and complete trips.
          </p>
        </section>

        <Card className="animate-in mx-auto max-h-[calc(100svh-2rem)] w-full max-w-xl overflow-y-auto rounded-[1.75rem] border-white/10 bg-white p-3 text-[#101713] shadow-2xl sm:rounded-[2rem] sm:p-5">
          <CardHeader>
            <CardTitle className="text-3xl font-black tracking-tight">
              {mode === "signup" ? "Join Taxiro" : "Welcome back"}
            </CardTitle>
            <CardDescription>
              Real Supabase account, no local duplicate users.
            </CardDescription>
          </CardHeader>
          <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
            <div className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
              <button
                className={`rounded-full px-3 py-3 text-sm font-bold ${mode === "signup" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setMode("signup")}
                type="button"
              >
                Sign up
              </button>
              <button
                className={`rounded-full px-3 py-3 text-sm font-bold ${mode === "signin" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setMode("signin")}
                type="button"
              >
                Sign in
              </button>
            </div>

            {mode === "signup" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Your name"
                    value={fullName}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+91..."
                    value={phone}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="role">Account type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["user", "rider"] as const).map((accountRole) => (
                      <button
                        className={`rounded-2xl border p-4 text-left transition ${
                          role === accountRole
                            ? "border-[#101713] bg-[#101713] text-white"
                            : "border-border bg-muted text-[#101713]"
                        }`}
                        key={accountRole}
                        onClick={() => setRole(accountRole)}
                        type="button"
                      >
                        <span className="block text-sm font-black capitalize">{accountRole}</span>
                        <span className="mt-1 block text-xs opacity-70">
                          {accountRole === "user" ? "Book rides" : "Accept jobs"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                type="password"
                value={password}
              />
            </div>
            <Button className="h-12 rounded-full text-base font-bold" disabled={loading} type="submit">
              {loading ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
            <p className="text-sm text-muted-foreground">{message}</p>
          </form>
        </Card>
      </div>
    </main>
  );
}
