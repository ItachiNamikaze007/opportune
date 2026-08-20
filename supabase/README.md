# Opportune 2026 — Database & Backend Architecture

This directory contains the PostgreSQL database schema, seed scripts, and Row Level Security (RLS) policies for the **Opportune 2026** platform.

---

## 🗄️ Database Tables Overview

| Table | Description | RLS Policy |
| :--- | :--- | :--- |
| `public.users` | Mirrors `auth.users` with display profile | Own record only |
| `public.student_profiles` | Full student eligibility credentials (degree, branch, year, CGPA, age, location) | Own record only (`auth.uid() = user_id`) |
| `public.student_skills` | Normalized skills attached to a student | Own record only |
| `public.student_interests` | Normalized opportunity category interests | Own record only |
| `public.opportunity_sources` | Official source catalog (Govt portals, tech careers, research bodies) | Publicly viewable by all |
| `public.opportunities` | Opportunities catalog with full descriptions and metadata | Publicly viewable by all |
| `public.opportunity_eligibility_rules` | Structured eligibility rule fields for matching engine | Publicly viewable by all |
| `public.saved_opportunities` | Bookmarked opportunities per student | Own record only (`auth.uid() = user_id`) |
| `public.applications` | Interactive Kanban tracker records and notes | Own record only (`auth.uid() = user_id`) |
| `public.notifications` | In-app alerts, deadline reminders, and match notifications | Own record only (`auth.uid() = user_id`) |

---

## 🚀 Setup Instructions

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Under **Project Settings > API**, copy the `Project URL` and `anon public` key.

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. Run Database Migrations
1. Open the **SQL Editor** in your Supabase dashboard.
2. Copy and execute the contents of [`supabase/schema.sql`](./schema.sql).
3. Copy and execute the contents of [`supabase/seed.sql`](./seed.sql) to seed the 22 mock opportunities.

---

## 🛡️ Security & Zero-Config Offline Mode

- **Zero-Config Fallback**: If `.env.local` credentials are not configured, the frontend gracefully falls back to local storage and in-memory mock datasets without crashing.
- **Row Level Security (RLS)**: Enforced on all student data tables ensuring cross-user isolation.
- **Client Security**: `SUPABASE_SERVICE_ROLE_KEY` is never included in client bundles.
