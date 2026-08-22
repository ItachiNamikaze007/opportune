import type {
  OpportunityCategory,
  Degree,
  VerificationStatus,
  StipendType,
  EligibilityCriteria,
  LifecycleStatus,
  ReviewStatus,
  ConfidenceLevel,
  ConfidenceBreakdown,
} from "@/types";
import type { SourceStatus, SourceType } from "@/types/database";

export interface RawOpportunityRecord {
  rawId?: string;
  sourceId: string;
  sourceName?: string;
  sourceType?: "official" | "partner" | "aggregator" | "discovery_only";
  sourceUrl: string;
  officialUrl?: string;
  applyUrl?: string;
  rulesPdfUrl?: string;
  title: string;
  organization: string;
  categoryRaw?: string;
  descriptionRaw?: string;
  fullDescriptionRaw?: string;
  deadlineRaw?: string;
  locationRaw?: string;
  isRemote?: boolean;
  stipendRaw?: string;
  prizeRaw?: string;
  degreesRaw?: string[];
  branchesRaw?: string[];
  yearsRaw?: (number | string)[];
  cgpaRaw?: number | string;
  ageLimitRaw?: number | string;
  skillsRaw?: string[];
  tagsRaw?: string[];
  rawContent?: string;
  rawLinks?: string[];
  rawMetadata?: Record<string, any>;
}

export interface ExtractedEligibility {
  criteria: EligibilityCriteria;
  sourceText: string;
  confidence: number;
}

export interface NormalizedOpportunity {
  id?: string;
  sourceId: string;
  sourceName?: string;
  sourceType?: "official" | "partner" | "aggregator" | "discovery_only";
  title: string;
  organization: string;
  category: OpportunityCategory;
  categoryLabel: string;
  description: string;
  fullDescription: string;
  deadline: string; // ISO YYYY-MM-DD
  location: string;
  remote: boolean;
  stipendOrPrize: string;
  stipendType: StipendType;
  officialUrl: string;
  applyUrl: string;
  sourceUrl: string;
  rulesPdfUrl?: string;
  verificationStatus: VerificationStatus;
  lifecycleStatus: LifecycleStatus;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  confidenceBreakdown: ConfidenceBreakdown;
  verificationNotes?: string;
  lastVerified: string;
  isDemo: boolean;
  featured?: boolean;
  tags: string[];
  benefits: string[];
  applicationSteps: string[];
  importantDates: { label: string; date: string }[];
  eligibilityCriteria: EligibilityCriteria;
  rawRecordId?: string;
}

export interface IngestionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DeduplicationResult {
  isDuplicate: boolean;
  duplicateOf?: string; // id of existing canonical opportunity
  canonicalKey: string;
  matchConfidence: number; // 0 to 1
  reason?: string;
}

export type ChangeType =
  | "new_opportunity"
  | "deadline_changed"
  | "eligibility_changed"
  | "description_changed"
  | "expired"
  | "no_change";

export interface ChangeDetectionResult {
  changeType: ChangeType;
  hasChanges: boolean;
  diffs: Record<string, { old: any; new: any }>;
}

export interface OpportunitySourceConnector {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceUrl: string;
  readonly sourceType: SourceType;
  readonly isOfficial: boolean;
  readonly status: SourceStatus;
  readonly fetchFrequency: string;

  /**
   * Fetches raw items from the official feed/API
   */
  fetch(): Promise<RawOpportunityRecord[]>;

  /**
   * Normalizes a raw record into standardized Opportunity structure
   */
  normalize(raw: RawOpportunityRecord): NormalizedOpportunity;

  /**
   * Validates a normalized record before publishing
   */
  validate(item: NormalizedOpportunity): IngestionValidationResult;
}

export interface ReviewQueueItem {
  id: string;
  opportunityId: string;
  opportunity: NormalizedOpportunity;
  reason: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  confidenceBreakdown: ConfidenceBreakdown;
  sourceUrl: string;
  reviewStatus: ReviewStatus;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface IngestionRunSummary {
  sourceId: string;
  sourceName: string;
  startedAt: string;
  completedAt: string;
  fetchedCount: number;
  validCount: number;
  invalidCount: number;
  newCount: number;
  updatedCount: number;
  duplicateCount: number;
  queuedForReviewCount: number;
  errors: string[];
  status: "success" | "partial" | "failed";
}
