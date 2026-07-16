import { NextResponse } from "next/server";

type HealthCheck = {
  description: string;
  ok: boolean;
  required: boolean;
  status?:
    "ok" | "missing_migration" | "access_restricted" | "skipped" | "degraded";
  migration?: string;
};

const REQUIRED_OPERATIONAL_MIGRATIONS = [
  "20260701203000_customer_nearby_rider_preview.sql",
  "20260703110000_operational_and_product_foundation.sql",
  "20260706100000_operational_enforcement_and_fraud.sql",
];

export async function GET() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const hasPublicDatabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

  const checks: Record<string, HealthCheck> = {
    publicDatabaseConfiguration: {
      description:
        "Supabase public URL and anon key are configured for browser data access.",
      ok: hasPublicDatabaseConfig,
      required: true,
      status: hasPublicDatabaseConfig ? "ok" : "degraded",
    },
    serviceRoleConfiguration: {
      description:
        "Server-only Supabase service role key is configured for scheduled jobs.",
      ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      required: false,
      status: process.env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "degraded",
    },
    cronSecretConfiguration: {
      description:
        "Cron secret is configured for protected background job execution.",
      ok: Boolean(process.env.CRON_SECRET),
      required: false,
      status: process.env.CRON_SECRET ? "ok" : "degraded",
    },
    siteUrlConfiguration: {
      description:
        "Public site URL is configured for metadata and production links.",
      ok: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      required: false,
      status: process.env.NEXT_PUBLIC_SITE_URL ? "ok" : "degraded",
    },
    vercelGitMetadata: {
      description:
        "Vercel git commit metadata is available for deployment traceability.",
      ok: Boolean(process.env.VERCEL_GIT_COMMIT_SHA),
      required: false,
      status: process.env.VERCEL_GIT_COMMIT_SHA ? "ok" : "degraded",
    },
    vercelHobbyCronCompatibility: {
      description:
        "Vercel cron is configured for the Hobby-safe daily schedule. Five-minute ready-signal expiry needs Vercel Pro or an external scheduler.",
      ok: true,
      required: false,
      status: "ok",
    },
  };

  const databaseChecks = await getDatabaseReadinessChecks({
    hasPublicDatabaseConfig,
    supabaseAnonKey,
    supabaseUrl,
  });
  Object.assign(checks, databaseChecks);

  const requiredOk = Object.values(checks)
    .filter((check) => check.required)
    .every((check) => check.ok);
  const optionalOk = Object.values(checks)
    .filter((check) => !check.required)
    .every((check) => check.ok);
  const status =
    requiredOk && optionalOk ? "ok" : requiredOk ? "degraded" : "failed";

  return NextResponse.json(
    {
      checks,
      deployment: {
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
        environment: process.env.VERCEL_ENV ?? "local",
        region: process.env.VERCEL_REGION ?? "local",
        url: process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : (process.env.NEXT_PUBLIC_SITE_URL ?? "local"),
      },
      generatedAt: new Date().toISOString(),
      recommendations: [
        "Set Supabase GitHub integration working directory to blank or '.' because this repo stores supabase/migrations at the repository root.",
        "Deploy from a fresh commit authored by the Vercel team member account, not an older failed deployment authored by an outside account.",
        "Keep Vercel Hobby cron on '0 0 * * *'. Use Vercel Pro or an external scheduler for five-minute ready-signal expiry.",
        "If database readiness shows Missing migration, apply the listed SQL file in Supabase SQL Editor and reload the PostgREST schema cache.",
      ],
      requiredOperationalMigrations: REQUIRED_OPERATIONAL_MIGRATIONS,
      service: "taxiro-web",
      status,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
    },
    { status: requiredOk ? 200 : 503 },
  );
}

async function getDatabaseReadinessChecks({
  hasPublicDatabaseConfig,
  supabaseAnonKey,
  supabaseUrl,
}: {
  hasPublicDatabaseConfig: boolean;
  supabaseAnonKey: string;
  supabaseUrl: string;
}) {
  if (!hasPublicDatabaseConfig) {
    return {
      serviceAreasTable: skippedDatabaseCheck(
        "service_areas table check skipped until Supabase public env vars are configured.",
        "20260703110000_operational_and_product_foundation.sql",
      ),
      pricingRulesTable: skippedDatabaseCheck(
        "pricing_rules table check skipped until Supabase public env vars are configured.",
        "20260703110000_operational_and_product_foundation.sql",
      ),
      nearbyRidersRpc: skippedDatabaseCheck(
        "get_nearby_available_riders RPC check skipped until Supabase public env vars are configured.",
        "20260701203000_customer_nearby_rider_preview.sql",
      ),
    } satisfies Record<string, HealthCheck>;
  }

  const [serviceAreasTable, pricingRulesTable, nearbyRidersRpc] =
    await Promise.all([
      probeSupabaseObject({
        description:
          "service_areas table is available for configured service-zone pricing.",
        migration: "20260703110000_operational_and_product_foundation.sql",
        request: () =>
          fetch(`${supabaseUrl}/rest/v1/service_areas?select=id&limit=1`, {
            headers: supabaseHeaders(supabaseAnonKey),
            cache: "no-store",
          }),
      }),
      probeSupabaseObject({
        description:
          "pricing_rules table is available for configured vehicle and peak pricing.",
        migration: "20260703110000_operational_and_product_foundation.sql",
        request: () =>
          fetch(`${supabaseUrl}/rest/v1/pricing_rules?select=id&limit=1`, {
            headers: supabaseHeaders(supabaseAnonKey),
            cache: "no-store",
          }),
      }),
      probeSupabaseObject({
        description:
          "get_nearby_available_riders RPC is available for customer map rider previews.",
        migration: "20260701203000_customer_nearby_rider_preview.sql",
        request: () =>
          fetch(`${supabaseUrl}/rest/v1/rpc/get_nearby_available_riders`, {
            body: JSON.stringify({
              p_lat: 17.385,
              p_lng: 78.4867,
              p_radius_km: 1,
            }),
            cache: "no-store",
            headers: {
              ...supabaseHeaders(supabaseAnonKey),
              "Content-Type": "application/json",
            },
            method: "POST",
          }),
      }),
    ]);

  return {
    serviceAreasTable,
    pricingRulesTable,
    nearbyRidersRpc,
  } satisfies Record<string, HealthCheck>;
}

function supabaseHeaders(anonKey: string) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
}

function skippedDatabaseCheck(
  description: string,
  migration: string,
): HealthCheck {
  return {
    description,
    ok: false,
    required: false,
    status: "skipped",
    migration,
  };
}

async function probeSupabaseObject({
  description,
  migration,
  request,
}: {
  description: string;
  migration: string;
  request: () => Promise<Response>;
}): Promise<HealthCheck> {
  try {
    const response = await request();

    if (response.status === 404) {
      return {
        description: `${description} Missing migration or stale Supabase schema cache detected.`,
        ok: false,
        required: false,
        status: "missing_migration",
        migration,
      };
    }

    if (response.ok) {
      return {
        description,
        ok: true,
        required: false,
        status: "ok",
        migration,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        description: `${description} Object exists but public health probing is restricted by RLS or grants, which is acceptable for authenticated app use.`,
        ok: true,
        required: false,
        status: "access_restricted",
        migration,
      };
    }

    return {
      description: `${description} Probe returned HTTP ${response.status}; check Supabase logs if this persists.`,
      ok: false,
      required: false,
      status: "degraded",
      migration,
    };
  } catch {
    return {
      description: `${description} Probe could not reach Supabase from the current deployment/runtime.`,
      ok: false,
      required: false,
      status: "degraded",
      migration,
    };
  }
}
