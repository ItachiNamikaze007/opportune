# Opportune 2026 — Production Database & Supabase Setup

This directory contains the production-ready PostgreSQL database schema, migration scripts, and Row Level Security (RLS) policies for the **Opportune 2026** platform.

---

## 🗄️ Database Architecture & Tables

| Table | Purpose | Row Level Security (RLS) Policy |
| :--- | :--- | :--- |
| `public.users` | Mirrors `auth.users` with display name and avatar | Own record only (`auth.uid() = id`) |
| `public.student_profiles` | Verified student eligibility credentials (degree, branch, year, CGPA, age, location) | Own record only (`auth.uid() = user_id`) |
| `public.student_skills` | Normalized skills attached to a student | Own record only (`auth.uid() = user_id`) |
| `public.student_interests` | Normalized opportunity category interests | Own record only (`auth.uid() = user_id`) |
| `public.opportunity_sources` | Official source registry (Govt portals, tech careers, research bodies) | Publicly viewable (`is_active = true`) |
| `public.raw_opportunity_records` | Immutable raw crawled/fetched data payloads | Server/Admin only |
| `public.opportunities` | Master catalog with authentic descriptions and metadata | Public view for `lifecycle_status = 'published'` |
| `public.opportunity_eligibility_rules` | Structured eligibility rule fields for matching engine | Public view for published opportunities |
| `public.opportunity_reviews` | Human review queue for auditing ingested opportunities | Admin / Server only |
| `public.saved_opportunities` | Bookmarked opportunities per student | Own record only (`auth.uid() = user_id`) |
| `public.applications` | Interactive Kanban tracker records | Own record only (`auth.uid() = user_id`) |
| `public.application_notes` | Private notes per tracked application | Own record only (`auth.uid() = user_id`) |
| `public.opportunity_matches` | Deterministic eligibility match scores and breakdowns | Own matches only (`auth.uid() = user_id`) |
| `public.notifications` | In-app alerts, deadline reminders, and anti-spam grouped matches | Own alerts only (`auth.uid() = user_id`) |
| `public.ingestion_audit_logs` | Ingestion pipeline health metrics and run history | Admin / Server only |
| `public.admin_audit_logs` | Immutable audit trail for reviewer approval/rejection actions | Admin / Server only |

---

## 🚀 Connecting to Your Supabase Cloud Project ("opportune")

### Option A: Apply via Supabase Cloud SQL Editor (Recommended & Instant)

1. Open your Supabase Dashboard: [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: **`opportune`**
3. Navigate to **SQL Editor** in the left sidebar (icon `>_`).
4. Click **New query** and paste the entire contents of [`supabase/schema.sql`](./schema.sql) (or [`supabase/migrations/20260820000001_initial_schema.sql`](./migrations/20260820000001_initial_schema.sql)).
5. Click **Run** (or `Ctrl + Enter`).
6. **Done!** All 16 tables, 8 ENUM types, RLS policies, indexes, and triggers (`on_auth_user_created`) are deployed.

---

### Option B: Apply via Supabase CLI

```bash
# 1. Login with your Supabase Personal Access Token
npx supabase login

# 2. Link your project (find project-ref in your project URL: https://supabase.com/dashboard/project/<project-ref>)
npx supabase link --project-ref <your-project-ref>

# 3. Push schema migrations to production
npx supabase db push
```

---

## ⚙️ Environment Variables for Vercel Deployment

In your **Vercel Project Settings > Environment Variables**, add:

```env
# Production Mode Activation
NEXT_PUBLIC_APP_MODE=production

# Supabase Public API Endpoint (from Project Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co

# Supabase Public Anon Key (Safe for browser client)
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>

# Supabase Service Role Key (SERVER ONLY - Keep secret)
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Production App URL
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

---

## 🛡️ Production Safety Guarantees

1. **No Seed / Demo Data in Production**: The production schema does not inject mock records. Only authentic, verified opportunities are published.
2. **Row-Level Security (RLS) Active**: Every table is guarded by RLS policies. Student data is completely isolated.
3. **Fail-Loudly Guard**: If `NEXT_PUBLIC_APP_MODE='production'` is set without valid credentials, the application throws a fatal configuration error and **never** falls back to demo data.
4. **Secret Isolation**: `SUPABASE_SERVICE_ROLE_KEY` is strictly isolated server-side and never exposed in client bundles.
