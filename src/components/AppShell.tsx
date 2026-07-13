"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bike,
  CalendarClock,
  Home,
  LogOut,
  MapPinned,
  Route,
  ShieldCheck,
} from "lucide-react";

import { LiveNotificationBanner } from "@/components/LiveNotificationBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase";
import type { Profile, UserRole } from "@/types/database";

const roleNavigation: Record<
  UserRole,
  Array<{ href: string; icon: typeof Home; label: string }>
> = {
  user: [
    { href: "/dashboard/user", icon: Home, label: "Book" },
    { href: "/dashboard/user#rides", icon: CalendarClock, label: "My rides" },
  ],
  rider: [
    { href: "/dashboard/rider", icon: Bike, label: "Work" },
    { href: "/dashboard/rider#demand", icon: MapPinned, label: "Demand" },
    { href: "/dashboard/rider#route", icon: Route, label: "My route" },
  ],
  admin: [
    { href: "/dashboard/admin", icon: ShieldCheck, label: "Operations" },
  ],
};

export function AppShell({
  children,
  immersive = false,
  title,
}: {
  children: React.ReactNode;
  immersive?: boolean;
  title: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    const client = supabase;

    async function loadAccount() {
      const user = await getCurrentUser(client);
      setEmail(user?.email ?? null);
      setProfileId(user?.id ?? null);
      if (user) {
        const profile = await getProfile(client, user.id);
        if (profile?.account_status === "suspended") {
          await client.auth.signOut({ scope: "local" });
          router.replace("/auth");
          return;
        }
        setRole(profile?.role ?? null);
      } else {
        setRole(null);
      }
    }

    void loadAccount();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => void loadAccount());

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!profileId) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel("account-control-" + profileId)
      .on(
        "postgres_changes",
        { event: "UPDATE", filter: "id=eq." + profileId, schema: "public", table: "profiles" },
        (payload) => {
          const updated = payload.new as Profile;
          if (updated.account_status === "suspended") {
            void supabase.auth.signOut({ scope: "local" }).then(() => {
              router.replace("/auth");
              router.refresh();
            });
          }
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profileId, router]);
  async function signOut() {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/auth");
    router.refresh();
  }

  const navigation = role ? roleNavigation[role] : [];

  if (immersive) {
    return (
      <main className="min-h-svh min-w-0 w-full max-w-full overflow-x-clip bg-[#e9eee9] text-foreground">
        <LiveNotificationBanner profileId={profileId} />
        {children}
      </main>
    );
  }

  return (
    <main className="min-h-screen min-w-0 w-full max-w-full overflow-x-clip bg-background pb-24 md:pb-0">
      <LiveNotificationBanner profileId={profileId} />
      <header className="taxiro-app-header sticky top-0 z-40 border-b border-border/70 bg-card/88 pt-[env(safe-area-inset-top)] backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between gap-3 px-3 sm:px-5 lg:px-8">
          <Link href={role ? roleNavigation[role][0].href : "/"} className="flex min-w-0 items-center gap-2.5 font-black">
            <span className="taxiro-brand-mark flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Bike className="size-5" />
            </span>
            <span className="truncate text-lg tracking-tight">Taxiro</span>
            {role ? (
              <span className="hidden rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground sm:inline">
                {role}
              </span>
            ) : null}
          </Link>
          <nav className="hidden items-center gap-1 rounded-lg bg-muted p-1 md:flex">
            {navigation.map(({ href, label }) => (
              <Link
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-[transform,background-color,color,box-shadow] duration-300 hover:bg-card hover:text-foreground hover:shadow-sm active:scale-[0.97]",
                  pathname === href && "bg-card text-foreground shadow-sm",
                )}
                href={href}
                key={label}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle className="hidden sm:inline-flex" />
            {email ? (
              <>
                <span className="hidden max-w-[180px] truncate text-xs text-muted-foreground lg:inline">
                  {email}
                </span>
                <Button aria-label="Sign out" className="size-10 px-0 sm:w-auto sm:px-3" onClick={() => void signOut()} size="sm" title="Sign out" variant="ghost">
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </>
            ) : (
              <Button asChild size="sm">
                <Link href="/auth">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <section className="taxiro-page-enter mx-auto min-w-0 max-w-[90rem] px-3 py-5 sm:px-5 sm:py-8 lg:px-8 lg:py-10">
        <div className="mb-5 sm:mb-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Taxiro workspace</p>
          <h1 className="mt-1 min-w-0 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
        </div>
        {children}
      </section>

      {navigation.length ? (
        <>
          <div className="fixed bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4.25rem))] right-3 z-40 md:hidden">
            <ThemeToggle compact />
          </div>
          <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-card/96 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_32px_rgb(16_23_19_/_0.08)] backdrop-blur-xl md:hidden"
          style={{ gridTemplateColumns: `repeat(${navigation.length}, minmax(0, 1fr))` }}
        >
          {navigation.map(({ href, icon: Icon, label }) => (
            <Link
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold text-muted-foreground transition active:scale-[0.98] active:bg-muted",
                pathname === href && "bg-secondary text-primary",
              )}
              href={href}
              key={label}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
        </>
      ) : null}
    </main>
  );
}
