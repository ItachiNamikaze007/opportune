import type { OpportunityCategory, Degree, SourceProvenanceType } from "@/types";

export interface RawOpportunityCandidate {
  rawId: string;
  sourceName: string;
  sourceType: SourceProvenanceType;
  title: string;
  organization: string;
  sourceUrl: string;
  officialUrlHint?: string;
  claimedDeadline?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  fullDescription?: string;
  category: OpportunityCategory;
  location?: string;
  stipendOrPrize?: string;
  discoveredApplyUrl?: string;
  discoveredRulesUrl?: string;
  degrees?: Degree[];
  branches?: string[];
  years?: number[];
  minCGPA?: number;
  tags?: string[];
  skills?: string[];
}

export interface OpportunitySourceAdapter {
  readonly sourceName: string;
  readonly sourceType: SourceProvenanceType;
  readonly seedUrls: string[];
  readonly allowedDomains: string[];
  discover(): Promise<RawOpportunityCandidate[]>;
}
