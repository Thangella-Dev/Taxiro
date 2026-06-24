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

import { Button } from "@/components/ui/button";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase";
import type { UserRole } from "@/types/database";

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
      if (user) {
        const profile = await getProfile(client, user.id);
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
  }, []);

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
      <main className="min-h-svh min-w-0 w-full max-w-full overflow-x-clip bg-[#0b120e] text-foreground">
        {children}
      </main>
    );
  }

  return (
    <main className="min-h-screen min-w-0 w-full max-w-full overflow-x-clip bg-[radial-gradient(circle_at_top_left,_rgba(15,138,75,0.12),_transparent_34%),var(--background)] pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-border bg-card/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-5">
          <Link href={role ? roleNavigation[role][0].href : "/"} className="flex items-center gap-2 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Bike className="size-5" />
            </span>
            <span>Taxidi</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navigation.map(({ href, label }) => (
              <Link
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                  pathname === href.split("#")[0] && "text-foreground",
                )}
                href={href}
                key={label}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {email ? (
              <>
                <span className="hidden max-w-[180px] truncate text-xs text-muted-foreground lg:inline">
                  {email}
                </span>
                <Button aria-label="Sign out" onClick={() => void signOut()} size="sm" variant="ghost">
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

      <section className="mx-auto min-w-0 max-w-7xl overflow-hidden px-3 py-5 sm:px-5 sm:py-8">
        <h1 className="mb-5 min-w-0 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {children}
      </section>

      {navigation.length ? (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden"
          style={{ gridTemplateColumns: `repeat(${navigation.length}, minmax(0, 1fr))` }}
        >
          {navigation.map(({ href, icon: Icon, label }) => (
            <Link
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium text-muted-foreground transition active:bg-muted",
                pathname === href.split("#")[0] && "bg-secondary text-primary",
              )}
              href={href}
              key={label}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
      ) : null}
    </main>
  );
}


