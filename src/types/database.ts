import type {
  OpportunityCategory,
  Degree,
  ApplicationStage,
  VerificationStatus,
  StipendType,
  EligibilityStatus,
} from "./index";

export type SourceType =
  | "government"
  | "company"
  | "university"
  | "hackathon"
  | "scholarship"
  | "research"
  | "other";

export type SourceStatus =
  | "active"
  | "paused"
  | "error"
  | "disabled"
  | "manual_review_required";

export type LifecycleStatus =
  | "draft"
  | "discovered"
  | "processing"
  | "pending_review"
  | "verified"
  | "published"
  | "expired"
  | "rejected";

export type ReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_more_information";

export type ConfidenceLevel =
  | "needs_review"
  | "review_recommended"
  | "high_confidence";

export type NotificationType =
  | "new_match"
  | "deadline_approaching"
  | "deadline_changed"
  | "eligibility_changed"
  | "opportunity_expired"
  | "info";

export interface ConfidenceBreakdown {
  title: number;
  deadline: number;
  eligibility: number;
  organization: number;
  url: number;
  overall: number;
  level: ConfidenceLevel;
}

export interface DbUser {
  id: string; // UUID
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbStudentProfile {
  id: string; // UUID
  user_id: string | null; // UUID
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  degree: Degree;
  institution: string;
  branch: string;
  study_year: number;
  graduation_year: number;
  cgpa: number;
  date_of_birth: string | null;
  age: number;
  country: string;
  state: string;
  city: string;
  domicile: string;
  gender: string;
  category_quota: string;
  completed_onboarding: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbStudentSkill {
  id: string;
  student_id: string;
  skill_name: string;
  proficiency_level: "beginner" | "intermediate" | "advanced";
  created_at: string;
}

export interface DbStudentInterest {
  id: string;
  student_id: string;
  category: OpportunityCategory;
  created_at: string;
}

export interface DbOpportunitySource {
  id: string;
  source_name: string;
  source_url: string;
  source_type: SourceType;
  is_official: boolean;
  is_active: boolean;
  status: SourceStatus;
  check_frequency: string;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbRawOpportunityRecord {
  id: string;
  source_id: string;
  source_url: string;
  fetched_at: string;
  raw_title: string;
  raw_description: string | null;
  raw_deadline: string | null;
  raw_content: string | null;
  raw_links: string[];
  raw_metadata: Record<string, any>;
  created_at: string;
}

export interface DbOpportunity {
  id: string;
  source_id: string | null;
  source_name?: string | null;
  source_type?: "official" | "partner" | "aggregator" | null;
  title: string;
  organization: string;
  category: OpportunityCategory;
  category_label: string;
  description: string;
  full_description: string;
  deadline: string;
  location: string;
  remote: boolean;
  stipend_or_prize: string;
  stipend_type: StipendType;
  official_url: string;
  apply_url: string | null;
  source_url: string | null;
  official_source_url?: string | null;
  rules_pdf_url?: string | null;
  source_conflict?: boolean;
  source_metadata?: Record<string, any> | null;
  verification_status: VerificationStatus;
  lifecycle_status: LifecycleStatus;
  confidence_score: number;
  confidence_level: ConfidenceLevel;
  verification_notes: string | null;
  last_verified_at: string;
  is_demo: boolean;
  featured: boolean;
  tags: string[];
  benefits: string[];
  application_steps: string[];
  important_dates: { label: string; date: string }[];
  created_at: string;
  updated_at: string;
}

export interface DbOpportunityEligibilityRule {
  id: string;
  opportunity_id: string;
  allowed_degrees: Degree[];
  allowed_branches: string[];
  allowed_study_years: number[];
  min_cgpa: number | null;
  min_age: number | null;
  max_age: number | null;
  nationality: string | null;
  domicile_required: string;
  eligible_gender: string;
  eligible_locations: string[];
  required_skills: string[];
  eligibility_source_text: string | null;
  extraction_confidence: number;
  other_criteria: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DbStudentOpportunityMatch {
  id: string;
  student_id: string;
  opportunity_id: string;
  score: number;
  status: EligibilityStatus;
  reasons: string[];
  mismatches: string[];
  created_at: string;
  updated_at: string;
  last_evaluated_at: string;
  notification_sent_at: string | null;
}

export interface DbOpportunityReview {
  id: string;
  opportunity_id: string;
  reason: string;
  confidence: number;
  source_url: string;
  review_status: ReviewStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOpportunitySourceReference {
  id: string;
  opportunity_id: string;
  source_id: string;
  source_url: string;
  is_canonical: boolean;
  last_seen_at: string;
  created_at: string;
}

export interface DbOpportunityChangeEvent {
  id: string;
  opportunity_id: string;
  change_type: string;
  old_data: Record<string, any>;
  new_data: Record<string, any>;
  created_at: string;
}

export interface DbSavedOpportunity {
  id: string;
  user_id: string | null;
  opportunity_id: string;
  created_at: string;
}

export interface DbApplication {
  id: string;
  user_id: string | null;
  opportunity_id: string;
  stage: ApplicationStage;
  applied_date: string | null;
  notes: string | null;
  custom_reminder: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  link: string | null;
  group_key?: string | null;
  match_count?: number;
  created_at: string;
}

export interface UserNotificationPreferences {
  newMatches: boolean;
  deadlineReminders: boolean;
  eligibilityChanges: boolean;
  weeklyDigest: boolean;
}

/**
 * Supabase Database Interface
 */
export type Database = {
  public: {
    Tables: {
      users: {
        Row: DbUser;
        Insert: Partial<DbUser> & { id: string; email: string };
        Update: Partial<DbUser>;
        Relationships: [];
      };
      student_profiles: {
        Row: DbStudentProfile;
        Insert: Partial<DbStudentProfile> & { full_name: string; email: string };
        Update: Partial<DbStudentProfile>;
        Relationships: [];
      };
      student_skills: {
        Row: DbStudentSkill;
        Insert: Partial<DbStudentSkill> & { student_id: string; skill_name: string };
        Update: Partial<DbStudentSkill>;
        Relationships: [];
      };
      student_interests: {
        Row: DbStudentInterest;
        Insert: Partial<DbStudentInterest> & { student_id: string; category: OpportunityCategory };
        Update: Partial<DbStudentInterest>;
        Relationships: [];
      };
      opportunity_sources: {
        Row: DbOpportunitySource;
        Insert: Partial<DbOpportunitySource> & { id: string; source_name: string; source_url: string };
        Update: Partial<DbOpportunitySource>;
        Relationships: [];
      };
      raw_opportunity_records: {
        Row: DbRawOpportunityRecord;
        Insert: Partial<DbRawOpportunityRecord> & { source_id: string; source_url: string; raw_title: string };
        Update: Partial<DbRawOpportunityRecord>;
        Relationships: [];
      };
      opportunities: {
        Row: DbOpportunity;
        Insert: Partial<DbOpportunity> & { id: string; title: string; organization: string };
        Update: Partial<DbOpportunity>;
        Relationships: [];
      };
      opportunity_eligibility_rules: {
        Row: DbOpportunityEligibilityRule;
        Insert: Partial<DbOpportunityEligibilityRule> & { opportunity_id: string };
        Update: Partial<DbOpportunityEligibilityRule>;
        Relationships: [];
      };
      student_opportunity_matches: {
        Row: DbStudentOpportunityMatch;
        Insert: Partial<DbStudentOpportunityMatch> & { student_id: string; opportunity_id: string; score: number };
        Update: Partial<DbStudentOpportunityMatch>;
        Relationships: [];
      };
      opportunity_reviews: {
        Row: DbOpportunityReview;
        Insert: Partial<DbOpportunityReview> & { opportunity_id: string; source_url: string };
        Update: Partial<DbOpportunityReview>;
        Relationships: [];
      };
      opportunity_source_references: {
        Row: DbOpportunitySourceReference;
        Insert: Partial<DbOpportunitySourceReference> & { opportunity_id: string; source_id: string; source_url: string };
        Update: Partial<DbOpportunitySourceReference>;
        Relationships: [];
      };
      opportunity_change_events: {
        Row: DbOpportunityChangeEvent;
        Insert: Partial<DbOpportunityChangeEvent> & { opportunity_id: string; change_type: string };
        Update: Partial<DbOpportunityChangeEvent>;
        Relationships: [];
      };
      saved_opportunities: {
        Row: DbSavedOpportunity;
        Insert: Partial<DbSavedOpportunity> & { opportunity_id: string };
        Update: Partial<DbSavedOpportunity>;
        Relationships: [];
      };
      applications: {
        Row: DbApplication;
        Insert: Partial<DbApplication> & { opportunity_id: string };
        Update: Partial<DbApplication>;
        Relationships: [];
      };
      notifications: {
        Row: DbNotification;
        Insert: Partial<DbNotification> & { user_id: string; title: string; message: string };
        Update: Partial<DbNotification>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      opportunity_category: OpportunityCategory;
      source_type: SourceType;
      source_status: SourceStatus;
      verification_status: VerificationStatus;
      lifecycle_status: LifecycleStatus;
      review_status: ReviewStatus;
      application_stage: ApplicationStage;
      stipend_type: StipendType;
    };
    CompositeTypes: Record<string, never>;
  };
};
