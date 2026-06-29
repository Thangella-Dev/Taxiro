"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, BriefcaseBusiness, UserRound } from "lucide-react";

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
    <main className="min-h-[100svh] overflow-x-clip bg-[#e9eee9] p-3 text-[#101713] sm:p-5 lg:bg-[#101713] lg:p-6">
      <div className="mx-auto grid min-h-[calc(100svh-1.5rem)] max-w-7xl items-stretch gap-5 sm:min-h-[calc(100svh-2.5rem)] lg:min-h-[calc(100svh-3rem)] lg:grid-cols-[minmax(0,1fr)_minmax(32rem,0.82fr)]">
        <section className="hidden flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#101713] p-10 text-white lg:flex xl:p-14">
          <div className="flex items-center gap-3 text-lg font-black">
            <span className="flex size-11 items-center justify-center rounded-lg bg-secondary text-primary"><Bike className="size-5" /></span>
            Taxiro
          </div>
          <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-white/50">Move with confidence</p>
          <h1 className="max-w-xl text-5xl font-black tracking-tight xl:text-6xl">One account. A complete ride journey.</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-white/60">
            Users book and confirm rides. Riders go online, accept ready jobs, verify the private code, and complete trips.
          </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-white/10 p-3"><p className="text-white/45">Maps</p><p className="mt-1 font-bold">Live routes</p></div>
            <div className="rounded-lg border border-white/10 p-3"><p className="text-white/45">Safety</p><p className="mt-1 font-bold">Ride code</p></div>
            <div className="rounded-lg border border-white/10 p-3"><p className="text-white/45">Updates</p><p className="mt-1 font-bold">Realtime</p></div>
          </div>
        </section>

        <Card className="animate-in my-auto w-full border-white/50 bg-white p-4 shadow-[var(--shadow-float)] sm:p-6 lg:max-h-[calc(100svh-3rem)] lg:overflow-y-auto xl:p-8">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-white"><Bike className="size-5" /></span>
            <div><p className="font-black">Taxiro</p><p className="text-xs text-muted-foreground">Bike taxi account</p></div>
          </div>
          <CardHeader className="mb-5">
            <CardTitle className="text-3xl font-black tracking-tight">
              {mode === "signup" ? "Join Taxiro" : "Welcome back"}
            </CardTitle>
            <CardDescription>
              Real Supabase account, no local duplicate users.
            </CardDescription>
          </CardHeader>
          <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              <button
                className={`rounded-md px-3 py-2.5 text-sm font-bold transition ${mode === "signup" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setMode("signup")}
                type="button"
              >
                Sign up
              </button>
              <button
                className={`rounded-md px-3 py-2.5 text-sm font-bold transition ${mode === "signin" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
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
                        className={`rounded-lg border p-4 text-left transition ${
                          role === accountRole
                            ? "border-[#101713] bg-[#101713] text-white"
                            : "border-border bg-muted text-[#101713]"
                        }`}
                        key={accountRole}
                        onClick={() => setRole(accountRole)}
                        type="button"
                      >
                        <span className="flex items-center gap-2 text-sm font-black capitalize">
                          {accountRole === "user" ? <UserRound className="size-4" /> : <BriefcaseBusiness className="size-4" />}
                          {accountRole}
                        </span>
                        <span className="mt-1.5 block text-xs opacity-70">
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
            <Button className="h-12 w-full text-base font-bold" disabled={loading} type="submit">
              {loading ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
            <p aria-live="polite" className="rounded-lg bg-muted px-3 py-2.5 text-sm leading-5 text-muted-foreground">{message}</p>
          </form>
        </Card>
      </div>
    </main>
  );
}
