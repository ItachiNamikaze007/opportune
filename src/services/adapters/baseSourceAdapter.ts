import type { OpportunityCategory, SourceProvenanceType } from "@/types";

export interface AdapterDiscoveryOptions {
  maxPages?: number;
  perPage?: number;
  category?: OpportunityCategory;
}

export interface DiscoveredRawCandidate {
  rawId: string;
  sourceId: string;
  sourceName: string;
  sourceType: SourceProvenanceType;
  title: string;
  organization: string;
  sourceUrl: string; // URL on discovery platform (e.g. unstop.com/...)
  officialUrlHint?: string; // Official organizer domain if available in metadata
  claimedDeadline?: string; // YYYY-MM-DD
  description?: string;
  category: OpportunityCategory;
  categoryLabel: string;
  stipendOrPrize?: string;
  location?: string;
  tags?: string[];
  skills?: string[];
}

export interface SourceAdapterResult {
  sourceId: string;
  sourceName: string;
  candidates: DiscoveredRawCandidate[];
  pagesScraped: number;
  hasMore: boolean;
  error?: string;
}

export interface ISourceAdapter {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceType: SourceProvenanceType;
  readonly baseUrl: string;
  readonly enabled: boolean;

  discoverCandidates(options?: AdapterDiscoveryOptions): Promise<SourceAdapterResult>;
}
