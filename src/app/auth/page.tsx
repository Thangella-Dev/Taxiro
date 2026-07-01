"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, BriefcaseBusiness, CarFront, CarTaxiFront, UserRound } from "lucide-react";

import { RiderLivePhotoCapture } from "@/components/RiderLivePhotoCapture";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { establishSingleDeviceSession } from "@/lib/account-session";
import { ensureInitialRiderVehicle, ensureProfile, uploadRiderLivePhoto } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { normalizeEmail, normalizePhone, normalizeRegistration, validateDrivingLicence, validateEmail, validateFullName, validatePassword, validatePhone, validateVehicleInput } from "@/lib/validation";
import { VEHICLE_OPTIONS } from "@/lib/vehicles";
import type { UserRole, VehicleType } from "@/types/database";

export default function AuthPage() {
  const router = useRouter();
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("bike");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [livePhoto, setLivePhoto] = useState<Blob | null>(null);
  const [message, setMessage] = useState("Create a real Taxiro account stored in Supabase.");
  const [loading, setLoading] = useState(false);


  function validateForm() {
    const emailError = validateEmail(email);
    if (emailError) return emailError;
    const passwordError = validatePassword(password, mode === "signup");
    if (passwordError) return passwordError;
    if (mode === "signin") return null;

    const nameError = validateFullName(fullName);
    if (nameError) return nameError;
    const phoneError = validatePhone(phone);
    if (phoneError) return phoneError;
    if (password !== confirmPassword) return "Passwords do not match.";

    if (role === "rider") {
      const vehicleError = validateVehicleInput({
        make: vehicleMake,
        model: vehicleModel,
        registrationNumber: vehicleNumber,
      });
      if (vehicleError) return vehicleError;
      const licenceError = validateDrivingLicence(licenseNumber);
      if (licenceError) return licenceError;
      if (!livePhoto) return "Capture a live identity photo before creating a rider account.";
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
          email: normalizeEmail(email),
          password,
          options: {
            data: {
              full_name: fullName.trim().replace(/\s+/g, " "),
              license_number: role === "rider" ? licenseNumber.trim().toUpperCase() : undefined,
              phone: normalizePhone(phone),
              role,
              vehicle_make: role === "rider" ? vehicleMake.trim() : undefined,
              vehicle_model: role === "rider" ? vehicleModel.trim() : undefined,
              vehicle_number: role === "rider" ? normalizeRegistration(vehicleNumber) : undefined,
              vehicle_type: role === "rider" ? vehicleType : undefined,
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
          if (profile.account_status === "suspended") {
            await supabase.auth.signOut({ scope: "local" });
            setMessage("This account is suspended. Contact Taxiro support.");
            return;
          }
          await ensureInitialRiderVehicle(supabase, data.user);
          if (profile.role === "rider" && livePhoto) {
            await uploadRiderLivePhoto(supabase, data.user.id, livePhoto);
          }
          await establishSingleDeviceSession(supabase, data.user.id);
          router.push(dashboardForRole(profile.role));
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizeEmail(email),
          password,
        });
        if (error || !data.user) {
          setMessage(error ? authMessage(error) : "Sign in failed.");
          return;
        }
        const profile = await ensureProfile(supabase, data.user, role);
        if (profile.account_status === "suspended") {
          await supabase.auth.signOut({ scope: "local" });
          setMessage("This account is suspended. Contact Taxiro support.");
          return;
        }
        await ensureInitialRiderVehicle(supabase, data.user);
        await establishSingleDeviceSession(supabase, data.user.id);
        router.push(dashboardForRole(profile.role));
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
            <div><p className="font-black">Taxiro</p><p className="text-xs text-muted-foreground">Mobility account</p></div>
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
                    autoComplete="name"
                    id="fullName"
                    maxLength={80}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Your name"
                    value={fullName}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    autoComplete="tel"
                    id="phone"
                    inputMode="tel"
                    maxLength={16}
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
                {role === "rider" ? (
                  <div className="grid gap-3 rounded-lg border border-border bg-muted p-3 sm:col-span-2">
                    <div>
                      <p className="text-sm font-black">First vehicle for verification</p>
                      <p className="text-xs leading-5 text-muted-foreground">You can add Bike, Auto, and Car later. Only admin-verified vehicles can be selected for jobs.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {VEHICLE_OPTIONS.map((option) => {
                        const Icon = option.type === "bike" ? Bike : option.type === "auto" ? CarTaxiFront : CarFront;
                        return (
                          <button
                            className={vehicleType === option.type ? "rounded-lg bg-primary p-3 text-primary-foreground" : "rounded-lg bg-card p-3"}
                            key={option.type}
                            onClick={() => setVehicleType(option.type)}
                            type="button"
                          >
                            <Icon className="mx-auto size-5" />
                            <span className="mt-1 block text-xs font-black">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><Label htmlFor="vehicle-make">Make</Label><Input autoComplete="organization" id="vehicle-make" maxLength={40} onChange={(event) => setVehicleMake(event.target.value)} placeholder="Honda / Bajaj / Tata" value={vehicleMake} /></div>
                      <div><Label htmlFor="vehicle-model">Model</Label><Input id="vehicle-model" maxLength={40} onChange={(event) => setVehicleModel(event.target.value)} placeholder="Activa / RE / Nexon" value={vehicleModel} /></div>
                      <div><Label htmlFor="vehicle-number">Registration</Label><Input autoCapitalize="characters" id="vehicle-number" maxLength={18} onChange={(event) => setVehicleNumber(event.target.value.toUpperCase())} placeholder="TS09AB1234" value={vehicleNumber} /></div>
                      <div><Label htmlFor="licence-number">Driving licence</Label><Input autoCapitalize="characters" id="licence-number" maxLength={20} onChange={(event) => setLicenseNumber(event.target.value.toUpperCase())} placeholder="TS0120260001234" value={licenseNumber} /></div>
                    </div>
                    <RiderLivePhotoCapture disabled={loading} onCapture={setLivePhoto} />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                autoComplete="email"
                id="email"
                maxLength={254}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                id="password"
                maxLength={72}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "signup" ? "8+ characters, uppercase and number" : "Your password"}
                type="password"
                value={password}
              />
            </div>
            {mode === "signup" ? (
              <div>
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input autoComplete="new-password" id="confirm-password" maxLength={72} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter password again" type="password" value={confirmPassword} />
              </div>
            ) : null}
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
function dashboardForRole(role: UserRole) {
  if (role === "admin") return "/dashboard/admin";
  return role === "rider" ? "/dashboard/rider" : "/dashboard/user";
}