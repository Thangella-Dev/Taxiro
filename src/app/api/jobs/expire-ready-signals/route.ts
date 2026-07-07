import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!cronSecret || !serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Background job is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.rpc("expire_ready_signals");

  if (error) {
    console.error(JSON.stringify({ job: "expire_ready_signals", message: error.message, status: "failed", type: "taxiro.job" }));
    return NextResponse.json({ error: "Job failed" }, { status: 500 });
  }

  console.info(JSON.stringify({ data, job: "expire_ready_signals", status: "completed", type: "taxiro.job" }));
  return NextResponse.json({ data, ok: true });
}