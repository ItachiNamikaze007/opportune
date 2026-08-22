export type OpportunityCategory =
  | "government_exam"
  | "government_internship"
  | "private_internship"
  | "job"
  | "hackathon"
  | "competition"
  | "scholarship"
  | "research_internship"
  | "fellowship"
  | "international_opportunity";

export type Degree =
  | "B.Tech"
  | "B.E."
  | "BCA"
  | "MCA"
  | "B.Sc"
  | "M.Sc"
  | "B.A."
  | "M.A."
  | "M.Tech"
  | "M.E."
  | "PhD"
  | "MBA"
  | "BBA"
  | "B.Com"
  | "Diploma"
  | "12th"
  | "All Degrees";

export type EligibilityStatus = "eligible" | "potentially_eligible" | "not_eligible";

export interface EligibilityCriteria {
  allowedDegrees: Degree[];
  allowedBranches: string[]; // e.g. ["Computer Science", "IT", "Electronics", "All Branches"]
  allowedYears: number[]; // e.g. [1, 2, 3, 4]
  minCGPA?: number;
  maxAge?: number;
  minAge?: number;
  requiredSkills?: string[];
  eligibleLocations?: string[];
  eligibleGender?: "all" | "female" | "male";
  domicileRequired?: string; // State name if applicable
  descriptionNotes?: string[];
}

export interface EligibilityResult {
  score: number; // 0 - 100
  status: EligibilityStatus;
  reasons?: string[];
  mismatches?: string[];
  breakdown: {
    criterion: string;
    matched: boolean;
    requiredText: string;
    studentText: string;
    weight: number;
    earned: number;
  }[];
  summaryNotes: string[];
}

export type VerificationStatus =
  | "verified"
  | "partner_verified"
  | "verified_partner"
  | "verified_gov"
  | "pending"
  | "failed"
  | "demo"
  | "needs_review"
  | "needs_reverification"
  | "stale"
  | "expired"
  | "community_verified";

export type StipendType =
  | "stipend"
  | "prize"
  | "salary"
  | "grant"
  | "free_waiver";

export type LifecycleStatus =
  | "draft"
  | "discovered"
  | "processing"
  | "pending_review"
  | "verified"
  | "published"
  | "needs_reverification"
  | "stale"
  | "expired"
  | "rejected";

export type ReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_more_information";

export type SourceProvenanceType = "official" | "partner" | "aggregator" | "discovery_only";
export type SourceType = SourceProvenanceType;

export interface DiscoveryCandidate {
  id: string;
  title: string;
  organization?: string;
  description?: string;
  discoveredFrom: string; // e.g. "LinkedIn"
  sourceUrl: string; // verbatim discovered LinkedIn URL
  sourceType: "discovery_only";
  discoveredAt: string;
  verificationStatus: "pending" | "verified" | "rejected";
  officialUrl?: string;
  candidateDeadline?: string;
  officialDeadline?: string;
  category?: OpportunityCategory;
  categoryLabel?: string;
  confidenceScore?: number;
  sourceConflict?: boolean;
  conflictDetails?: string;
  officialApplyUrl?: string;
  officialRulesPdfUrl?: string;
  notes?: string;
}

export type ConfidenceLevel =
  | "needs_review"
  | "review_recommended"
  | "high_confidence";

export interface ConfidenceBreakdown {
  title: number;
  deadline: number;
  eligibility: number;
  organization: number;
  url: number;
  overall: number;
  level: ConfidenceLevel;
}

export interface ProvenanceClaim {
  sourceTitle: string;
  sourceUrl: string;
  sourceType: SourceProvenanceType;
  verificationStatus: VerificationStatus;
  lastVerified: string;
  contentEvidence: boolean;
  evidenceText?: string;
  evidenceLocation?: string;
}

export interface RevalidationAuditRecord {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  oldValues: {
    deadline?: string;
    verificationStatus?: VerificationStatus;
    lifecycleStatus?: LifecycleStatus;
    applyUrl?: string;
    rulesPdfUrl?: string;
  };
  newValues: {
    deadline?: string;
    verificationStatus?: VerificationStatus;
    lifecycleStatus?: LifecycleStatus;
    applyUrl?: string;
    rulesPdfUrl?: string;
  };
  changedFields: string[];
  sourceUrl: string;
  verificationTimestamp: string;
  reason: string;
  isConflict: boolean;
  httpStatus: number;
}

export interface Opportunity {
  id: string;
  sourceId?: string;
  sourceName?: string;
  sourceType?: SourceProvenanceType;
  title: string;
  organization: string;
  orgLogo?: string; // initial or badge icon
  category: OpportunityCategory;
  categoryLabel: string;
  description: string;
  fullDescription: string;
  deadline: string; // ISO string e.g. 2026-08-28
  location: string;
  remote: boolean;
  stipendOrPrize: string;
  stipendType: StipendType;
  officialUrl: string;
  applyUrl?: string;
  sourceUrl?: string;
  officialSourceUrl?: string;
  rulesPdfUrl?: string;
  rulesPdfTitle?: string;
  rulesPdfSourceType?: "official" | "partner";
  rulesUrl?: string;
  sourceConflict?: boolean;
  sourceMetadata?: Record<string, any>;
  deadlineSource?: string | ProvenanceClaim;
  eligibilitySource?: string | ProvenanceClaim;
  instructionsSource?: string | ProvenanceClaim;
  applyDestinationType?:
    | "direct_portal"
    | "partner_portal"
    | "spoc_nomination"
    | "scheduled_window"
    | "unavailable"
    | "expired";
  verificationStatus: VerificationStatus;
  lifecycleStatus?: LifecycleStatus;
  confidenceScore?: number;
  confidenceLevel?: ConfidenceLevel;
  confidenceBreakdown?: ConfidenceBreakdown;
  verificationNotes?: string;
  lastVerified: string;
  isDemo?: boolean;
  eligibilityCriteria: EligibilityCriteria;
  importantDates?: { label: string; date: string }[];
  benefits?: string[];
  applicationSteps?: string[];
  tags?: string[];
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentProfile {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  // Step 1: Education
  degree: Degree;
  institution: string;
  // Step 2: Academic Details
  branch: string;
  currentYear: number;
  graduationYear: number;
  cgpa: number;
  // Step 3: Personal Eligibility
  age: number;
  country: string;
  state: string;
  city: string;
  gender: "all" | "female" | "male" | "other";
  categoryQuota?: string; // General, OBC, SC, ST, EWS
  // Step 4: Skills
  skills: string[];
  // Step 5: Interests
  interests: OpportunityCategory[];
  // Completion score
  completedOnboarding: boolean;
}

export type ApplicationStage =
  | "saved"
  | "applied"
  | "assessment"
  | "interview"
  | "selected"
  | "rejected";

export interface StudentApplication {
  id: string;
  opportunityId: string;
  stage: ApplicationStage;
  appliedDate?: string;
  updatedDate: string;
  notes?: string;
  customReminder?: string;
}

export interface NotificationSettings {
  emailAlerts: boolean;
  deadlineReminders: boolean;
  weeklyDigest: boolean;
  whatsappAlerts: boolean;
  eligibilityUpdates: boolean;
}

export interface UserSettings {
  theme: "light" | "dark" | "system";
  notifications: NotificationSettings;
  subscribedCategories: OpportunityCategory[];
}
