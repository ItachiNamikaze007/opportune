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
  | "demo"
  | "verified"
  | "pending"
  | "needs_review"
  | "expired"
  | "verified_gov"
  | "verified_partner"
  | "community_verified";

export type StipendType =
  | "stipend"
  | "prize"
  | "salary"
  | "grant"
  | "free_waiver";

export type LifecycleStatus =
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

export interface ConfidenceBreakdown {
  title: number;
  deadline: number;
  eligibility: number;
  organization: number;
  url: number;
  overall: number;
  level: ConfidenceLevel;
}

export interface Opportunity {
  id: string;
  sourceId?: string;
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
}

export interface StudentProfile {
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
