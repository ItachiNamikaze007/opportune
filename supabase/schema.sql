-- ==============================================================================
-- OPPORTUNE 2026 - BACKEND DATABASE SCHEMA (PostgreSQL / Supabase)
-- Phase 4: Personalized Matching, Match Persistence, Notifications & Anti-Spam
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. ENUM TYPES
-- ==============================================================================

DO $$ BEGIN
    CREATE TYPE opportunity_category AS ENUM (
        'government_exam',
        'government_internship',
        'private_internship',
        'job',
        'hackathon',
        'competition',
        'scholarship',
        'research_internship',
        'fellowship',
        'international_opportunity'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE source_type AS ENUM (
        'government',
        'company',
        'university',
        'hackathon',
        'scholarship',
        'research',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE source_status AS ENUM (
        'active',
        'paused',
        'error',
        'disabled',
        'manual_review_required'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM (
        'demo',
        'pending',
        'verified',
        'needs_review',
        'expired',
        'verified_gov',
        'verified_partner',
        'community_verified'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lifecycle_status AS ENUM (
        'discovered',
        'processing',
        'pending_review',
        'verified',
        'published',
        'expired',
        'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE review_status AS ENUM (
        'pending',
        'approved',
        'rejected',
        'needs_more_information'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE application_stage AS ENUM (
        'saved',
        'applied',
        'assessment',
        'interview',
        'selected',
        'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE stipend_type AS ENUM (
        'stipend',
        'prize',
        'salary',
        'grant',
        'free_waiver'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 2. HELPER FUNCTIONS & TRIGGERS
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 3. USERS & PROFILES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.student_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    degree TEXT NOT NULL DEFAULT 'B.Tech',
    institution TEXT NOT NULL DEFAULT '',
    branch TEXT NOT NULL DEFAULT '',
    study_year INT NOT NULL DEFAULT 1 CHECK (study_year BETWEEN 1 AND 6),
    graduation_year INT NOT NULL DEFAULT 2027,
    cgpa NUMERIC(4, 2) NOT NULL DEFAULT 0.0 CHECK (cgpa >= 0.0 AND cgpa <= 10.0),
    date_of_birth DATE,
    age INT DEFAULT 20 CHECK (age >= 15 AND age <= 50),
    country TEXT NOT NULL DEFAULT 'India',
    state TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    domicile TEXT DEFAULT 'All India',
    gender TEXT DEFAULT 'all',
    category_quota TEXT DEFAULT 'General',
    completed_onboarding BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.student_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    proficiency_level TEXT DEFAULT 'intermediate',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(student_id, skill_name)
);

CREATE TABLE IF NOT EXISTS public.student_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
    category opportunity_category NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(student_id, category)
);

-- ==============================================================================
-- 4. OPPORTUNITY SOURCES (Phase 3B)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.opportunity_sources (
    id TEXT PRIMARY KEY,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_type source_type NOT NULL DEFAULT 'other',
    is_official BOOLEAN DEFAULT TRUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    status source_status DEFAULT 'active' NOT NULL,
    check_frequency TEXT DEFAULT 'daily' NOT NULL,
    last_checked_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opportunity_sources_status ON public.opportunity_sources(status);
CREATE INDEX IF NOT EXISTS idx_opportunity_sources_type ON public.opportunity_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_opportunity_sources_last_checked ON public.opportunity_sources(last_checked_at);

-- ==============================================================================
-- 5. RAW INGESTION RECORDS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.raw_opportunity_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL REFERENCES public.opportunity_sources(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    raw_title TEXT NOT NULL,
    raw_description TEXT,
    raw_deadline TEXT,
    raw_content TEXT,
    raw_links JSONB DEFAULT '[]'::jsonb,
    raw_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raw_opp_source_id ON public.raw_opportunity_records(source_id);
CREATE INDEX IF NOT EXISTS idx_raw_opp_fetched_at ON public.raw_opportunity_records(fetched_at);

-- ==============================================================================
-- 6. OPPORTUNITIES MASTER CATALOG
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.opportunities (
    id TEXT PRIMARY KEY,
    source_id TEXT REFERENCES public.opportunity_sources(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    organization TEXT NOT NULL,
    category opportunity_category NOT NULL,
    category_label TEXT NOT NULL,
    description TEXT NOT NULL,
    full_description TEXT NOT NULL,
    deadline TIMESTAMPTZ NOT NULL,
    location TEXT NOT NULL DEFAULT 'All India',
    remote BOOLEAN DEFAULT FALSE NOT NULL,
    stipend_or_prize TEXT NOT NULL,
    stipend_type stipend_type DEFAULT 'stipend' NOT NULL,
    official_url TEXT NOT NULL,
    apply_url TEXT,
    source_url TEXT,
    verification_status verification_status DEFAULT 'pending' NOT NULL,
    lifecycle_status lifecycle_status DEFAULT 'pending_review' NOT NULL,
    confidence_score NUMERIC(4, 2) DEFAULT 0.85,
    confidence_level TEXT DEFAULT 'high_confidence',
    verification_notes TEXT,
    last_verified_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    is_demo BOOLEAN DEFAULT FALSE NOT NULL,
    featured BOOLEAN DEFAULT FALSE NOT NULL,
    tags TEXT[] DEFAULT '{}',
    benefits TEXT[] DEFAULT '{}',
    application_steps TEXT[] DEFAULT '{}',
    important_dates JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opportunities_category ON public.opportunities(category);
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON public.opportunities(deadline);
CREATE INDEX IF NOT EXISTS idx_opportunities_is_demo ON public.opportunities(is_demo);
CREATE INDEX IF NOT EXISTS idx_opportunities_verification ON public.opportunities(verification_status);
CREATE INDEX IF NOT EXISTS idx_opportunities_lifecycle ON public.opportunities(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_opportunities_org_title ON public.opportunities(organization, title);

CREATE TABLE IF NOT EXISTS public.opportunity_eligibility_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id TEXT UNIQUE NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    allowed_degrees TEXT[] NOT NULL DEFAULT '{"All Degrees"}',
    allowed_branches TEXT[] NOT NULL DEFAULT '{"All Branches"}',
    allowed_study_years INT[] NOT NULL DEFAULT '{1,2,3,4}',
    min_cgpa NUMERIC(4, 2) DEFAULT 0.0,
    min_age INT,
    max_age INT,
    nationality TEXT DEFAULT 'Indian',
    domicile_required TEXT DEFAULT 'All India',
    eligible_gender TEXT DEFAULT 'all',
    eligible_locations TEXT[] DEFAULT '{"All India"}',
    required_skills TEXT[] DEFAULT '{}',
    eligibility_source_text TEXT,
    extraction_confidence NUMERIC(4, 2) DEFAULT 0.90,
    other_criteria JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- 7. REVIEW QUEUE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.opportunity_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id TEXT NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    reason TEXT NOT NULL DEFAULT 'Initial Ingestion Review',
    confidence NUMERIC(4, 2) NOT NULL DEFAULT 0.85,
    source_url TEXT NOT NULL,
    review_status review_status DEFAULT 'pending' NOT NULL,
    review_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.opportunity_reviews(review_status);
CREATE INDEX IF NOT EXISTS idx_reviews_opp_id ON public.opportunity_reviews(opportunity_id);

-- ==============================================================================
-- 8. PERSONALIZED MATCHES (Phase 4)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.student_opportunity_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL,
    opportunity_id TEXT NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    score NUMERIC(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
    status TEXT NOT NULL CHECK (status IN ('eligible', 'potentially_eligible', 'not_eligible')),
    reasons TEXT[] DEFAULT '{}' NOT NULL,
    mismatches TEXT[] DEFAULT '{}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_evaluated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    notification_sent_at TIMESTAMPTZ,
    UNIQUE(student_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_student_id ON public.student_opportunity_matches(student_id);
CREATE INDEX IF NOT EXISTS idx_matches_opp_id ON public.student_opportunity_matches(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.student_opportunity_matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_score ON public.student_opportunity_matches(score);
CREATE INDEX IF NOT EXISTS idx_matches_student_status ON public.student_opportunity_matches(student_id, status);

-- ==============================================================================
-- 9. SOURCE REFERENCES & CHANGE EVENTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.opportunity_source_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id TEXT NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES public.opportunity_sources(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    is_canonical BOOLEAN DEFAULT FALSE NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.opportunity_change_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id TEXT NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL,
    old_data JSONB DEFAULT '{}'::jsonb,
    new_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_change_events_opp_id ON public.opportunity_change_events(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_change_events_type ON public.opportunity_change_events(change_type);

-- ==============================================================================
-- 10. SAVED OPPORTUNITIES & APPLICATION TRACKER
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.saved_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    opportunity_id TEXT NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, opportunity_id)
);

CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    opportunity_id TEXT NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    stage application_stage DEFAULT 'applied' NOT NULL,
    applied_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    custom_reminder TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, opportunity_id)
);

-- ==============================================================================
-- 11. NOTIFICATIONS (Phase 4 Extended)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' NOT NULL, -- 'new_match', 'deadline_approaching', 'deadline_changed', 'eligibility_changed', 'opportunity_expired'
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    link TEXT,
    group_key TEXT, -- For grouping anti-spam notifications
    match_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- ==============================================================================
-- 12. TRIGGERS FOR UPDATED_AT
-- ==============================================================================

CREATE TRIGGER set_student_profiles_updated_at
BEFORE UPDATE ON public.student_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_opportunity_sources_updated_at
BEFORE UPDATE ON public.opportunity_sources
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_opportunities_updated_at
BEFORE UPDATE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_opportunity_eligibility_rules_updated_at
BEFORE UPDATE ON public.opportunity_eligibility_rules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_opportunity_reviews_updated_at
BEFORE UPDATE ON public.opportunity_reviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_student_matches_updated_at
BEFORE UPDATE ON public.student_opportunity_matches
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_applications_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_opportunity_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_eligibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_opportunity_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_source_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_change_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own profile"
    ON public.student_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Students can insert own profile"
    ON public.student_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can update own profile"
    ON public.student_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can view own skills"
    ON public.student_skills FOR SELECT
    USING (student_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Students can modify own skills"
    ON public.student_skills FOR ALL
    USING (student_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Students can view own interests"
    ON public.student_interests FOR SELECT
    USING (student_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Students can modify own interests"
    ON public.student_interests FOR ALL
    USING (student_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid()));

-- Opportunities: Students only see published real opportunities OR demo opportunities
CREATE POLICY "Published or demo opportunities are viewable"
    ON public.opportunities FOR SELECT
    USING (lifecycle_status = 'published' OR is_demo = true);

CREATE POLICY "Eligibility rules are viewable"
    ON public.opportunity_eligibility_rules FOR SELECT
    USING (true);

CREATE POLICY "Opportunity sources are viewable"
    ON public.opportunity_sources FOR SELECT
    USING (true);

-- Student Matches: Read-only access for student's own matches
CREATE POLICY "Students can view own opportunity matches"
    ON public.student_opportunity_matches FOR SELECT
    USING (student_id = auth.uid()::text);

CREATE POLICY "Users can view own saved opportunities"
    ON public.saved_opportunities FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can save opportunities"
    ON public.saved_opportunities FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove saved opportunities"
    ON public.saved_opportunities FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own applications"
    ON public.applications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications"
    ON public.applications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications"
    ON public.applications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own applications"
    ON public.applications FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (user_id = auth.uid()::text OR user_id = 'demo-user');

CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (user_id = auth.uid()::text OR user_id = 'demo-user');
