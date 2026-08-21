-- ==============================================================================
-- OPPORTUNE 2026 - PRODUCTION DATABASE MIGRATION
-- Project: Opportune (Student Opportunity Discovery Platform)
-- Version: 2026.08.20.1
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
-- 4. OPPORTUNITY SOURCES
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

CREATE INDEX IF NOT EXISTS idx_eligibility_opp_id ON public.opportunity_eligibility_rules(opportunity_id);

-- ==============================================================================
-- 7. OPPORTUNITY REVIEW QUEUE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.opportunity_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id TEXT NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    status review_status DEFAULT 'pending' NOT NULL,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    confidence_score NUMERIC(4, 2),
    confidence_breakdown JSONB DEFAULT '{}'::jsonb,
    flag_reasons TEXT[] DEFAULT '{}',
    reviewer_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.opportunity_reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_opp_id ON public.opportunity_reviews(opportunity_id);

-- ==============================================================================
-- 8. SAVED & TRACKED APPLICATIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.saved_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    opportunity_id TEXT NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    notes TEXT,
    UNIQUE(user_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_opp_user_id ON public.saved_opportunities(user_id);

CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    opportunity_id TEXT NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    stage application_stage DEFAULT 'applied' NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_status_change_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    notes TEXT,
    resume_version TEXT,
    portal_application_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_user_stage ON public.applications(user_id, stage);

CREATE TABLE IF NOT EXISTS public.application_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    note_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- 9. PERSONALIZED MATCHES & NOTIFICATIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.opportunity_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
    opportunity_id TEXT NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
    match_score INT NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    status TEXT NOT NULL CHECK (status IN ('eligible', 'potentially_eligible', 'not_eligible')),
    reasons TEXT[] DEFAULT '{}',
    mismatches TEXT[] DEFAULT '{}',
    breakdown JSONB DEFAULT '[]'::jsonb,
    is_urgent BOOLEAN DEFAULT FALSE,
    is_interest_match BOOLEAN DEFAULT FALSE,
    computed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    notified BOOLEAN DEFAULT FALSE NOT NULL,
    notified_at TIMESTAMPTZ,
    UNIQUE(student_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_opp_matches_student ON public.opportunity_matches(student_id, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_opp_matches_opp ON public.opportunity_matches(opportunity_id);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    opportunity_id TEXT REFERENCES public.opportunities(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('new_match', 'deadline_reminder', 'status_update', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE NOT NULL,
    group_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_group ON public.notifications(user_id, group_key);

-- ==============================================================================
-- 10. AUDIT LOGS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.ingestion_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT REFERENCES public.opportunity_sources(id) ON DELETE SET NULL,
    run_timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    fetched_count INT DEFAULT 0,
    normalized_count INT DEFAULT 0,
    enqueued_count INT DEFAULT 0,
    published_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    status TEXT NOT NULL,
    error_details TEXT
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_opportunity_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_eligibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Users Policies
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- 2. Student Profiles Policies
CREATE POLICY "Students can view their own profile" ON public.student_profiles
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Students can insert their own profile" ON public.student_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Students can update their own profile" ON public.student_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- 3. Skills & Interests Policies
CREATE POLICY "Students manage own skills" ON public.student_skills
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.student_profiles WHERE id = student_skills.student_id AND user_id = auth.uid())
    );

CREATE POLICY "Students manage own interests" ON public.student_interests
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.student_profiles WHERE id = student_interests.student_id AND user_id = auth.uid())
    );

-- 4. Opportunities Catalog (Public Access to Published)
CREATE POLICY "Anyone can view published opportunities" ON public.opportunities
    FOR SELECT USING (lifecycle_status = 'published');

CREATE POLICY "Anyone can view rules for published opportunities" ON public.opportunity_eligibility_rules
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.opportunities WHERE id = opportunity_eligibility_rules.opportunity_id AND lifecycle_status = 'published')
    );

CREATE POLICY "Public can view active sources" ON public.opportunity_sources
    FOR SELECT USING (is_active = TRUE);

-- 5. Saved & Applications
CREATE POLICY "Users manage their own saved opportunities" ON public.saved_opportunities
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage their own applications" ON public.applications
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage their application notes" ON public.application_notes
    FOR ALL USING (auth.uid() = user_id);

-- 6. Matches & Notifications
CREATE POLICY "Students can view their own opportunity matches" ON public.opportunity_matches
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.student_profiles WHERE id = opportunity_matches.student_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can manage their own notifications" ON public.notifications
    FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- 12. AUTOMATIC USER PROFILE CREATION TRIGGER
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.student_profiles (user_id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Student')
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated At Trigger Attachments
DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.student_profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.student_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_opps_updated_at ON public.opportunities;
CREATE TRIGGER set_opps_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_apps_updated_at ON public.applications;
CREATE TRIGGER set_apps_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
