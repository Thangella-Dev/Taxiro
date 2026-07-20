# Taxiro Production Readiness Runbook

## Release Gates

Run these commands before every production promotion:

```powershell
npm ci
npm run check
npm run test:e2e
```

The release is blocked if migrations, TypeScript, ESLint, unit tests, build, performance budgets, or browser smoke/accessibility checks fail.

## Supabase Migration Procedure

1. Create a Supabase staging project separate from production.
2. Store staging values only in `.env.local` or Vercel Preview environment variables.
3. Link staging: `npx supabase link --project-ref <staging-ref>`.
4. Review pending SQL: `npx supabase db diff --linked`.
5. Validate local files: `npm run db:validate`.
6. Apply to staging: `npx supabase db push --dry-run`, then `npx supabase db push`.
7. Run the pilot matrix in `docs/pilot-qa-matrix.md`.
8. Take a production backup before promotion.
9. Link production, repeat `db push --dry-run`, obtain approval, then apply.
10. Verify RLS, RPC grants, Realtime publication, storage policies, and `/api/health`.

Never run destructive SQL against production without a reviewed backup and explicit approval.


## Supabase Preview Migration-History Repair

If Supabase Preview fails with:

```text
Remote migration versions not found in local migrations directory.
```

Use this safe process:

1. Read remote migration versions from `supabase_migrations.schema_migrations`.
2. Compare the 14-digit remote versions with local filenames in `supabase/migrations`.
3. Restore or rename local migration files so every remote version has a matching local SQL file.
4. Do not edit production data or delete migration history unless a rollback plan is reviewed.
5. Run `npm run db:validate`.
6. Push the repaired migration files and re-run Supabase Preview.

For Taxiro, the repaired remote versions are:

- `20260608072034_readyride_core_schema.sql`
- `20260608085429_rider_scheduled_visibility.sql`
- `20260608085806_rider_role_rls.sql`
- `20260608090823_ride_execution_flow.sql`
- `20260608091235_explicit_rider_acceptance.sql`
- `20260624055901_enable_realtime_publication_tables.sql`
- `20260624055920_enable_realtime_replica_identity.sql`
## Backup And Recovery

### Managed backups

- Enable Supabase daily backups and Point-in-Time Recovery when the production plan supports it.
- Record retention, recovery-point objective, and recovery-time objective in the release ticket.
- Test restoration into a temporary project at least monthly.

### Logical backup

```powershell
npx supabase db dump --linked --data-only -f backups/taxiro-data-YYYYMMDD.sql
npx supabase db dump --linked -f backups/taxiro-schema-YYYYMMDD.sql
```

Store backup files in encrypted restricted storage, never Git. Restore into a new project first, validate counts and ride/RLS behavior, then switch application environment variables during a controlled recovery.

## Security Review

- Every public table has RLS enabled.
- Policies isolate profile-owned data and use `public.is_admin()` for admin access.
- `security definer` functions set a fixed `search_path` and validate `auth.uid()`.
- Frontend contains only the Supabase publishable/anon key, never service-role credentials.
- Storage buckets validate owner folder, MIME type, and size.
- RPCs grant only the minimum role needed.
- Logs redact tokens and do not store passwords, message bodies, precise location, or payment credentials by default.
- GitHub secret scanning and branch protection remain enabled.

## Incident Response

1. Confirm scope from Vercel structured logs (`taxiro.telemetry`) and Supabase logs.
2. Disable affected feature or suspend compromised profiles from admin operations.
3. Preserve audit evidence and timestamps.
4. Rotate affected credentials.
5. Restore from a verified backup only when data integrity is compromised.
6. Document cause, impact, remediation, and prevention in a support/incident ticket.
