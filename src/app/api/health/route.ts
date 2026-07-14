import { NextResponse } from "next/server";

type HealthCheck = {
  description: string;
  ok: boolean;
  required: boolean;
};

export function GET() {
  const checks: Record<string, HealthCheck> = {
    publicDatabaseConfiguration: {
      description: "Supabase public URL and anon key are configured for browser data access.",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      required: true,
    },
    serviceRoleConfiguration: {
      description: "Server-only Supabase service role key is configured for scheduled jobs.",
      ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      required: false,
    },
    cronSecretConfiguration: {
      description: "Cron secret is configured for protected background job execution.",
      ok: Boolean(process.env.CRON_SECRET),
      required: false,
    },
    siteUrlConfiguration: {
      description: "Public site URL is configured for metadata and production links.",
      ok: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      required: false,
    },
    vercelGitMetadata: {
      description: "Vercel git commit metadata is available for deployment traceability.",
      ok: Boolean(process.env.VERCEL_GIT_COMMIT_SHA),
      required: false,
    },
  };

  const requiredOk = Object.values(checks).filter((check) => check.required).every((check) => check.ok);
  const optionalOk = Object.values(checks).filter((check) => !check.required).every((check) => check.ok);
  const status = requiredOk && optionalOk ? "ok" : requiredOk ? "degraded" : "failed";

  return NextResponse.json(
    {
      checks,
      deployment: {
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
        environment: process.env.VERCEL_ENV ?? "local",
        region: process.env.VERCEL_REGION ?? "local",
        url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.NEXT_PUBLIC_SITE_URL ?? "local",
      },
      generatedAt: new Date().toISOString(),
      recommendations: [
        "Set Supabase GitHub integration working directory to blank or '.' because this repo stores supabase/migrations at the repository root.",
        "Deploy from a fresh commit authored by the Vercel team member account, not an older failed deployment authored by an outside account.",
        "Configure SUPABASE_SERVICE_ROLE_KEY and CRON_SECRET in Vercel Production before relying on scheduled ready-signal expiry.",
      ],
      service: "taxiro-web",
      status,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
    },
    { status: requiredOk ? 200 : 503 },
  );
}
