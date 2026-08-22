import {
  ISourceAdapter,
  AdapterDiscoveryOptions,
  SourceAdapterResult,
  DiscoveredRawCandidate,
} from "./baseSourceAdapter";
import type { SourceProvenanceType } from "@/types";

export class MockTestSourceAdapter implements ISourceAdapter {
  readonly sourceId = "src-mock-test-discovery";
  readonly sourceName = "Test Verification Discovery Source";
  readonly sourceType: SourceProvenanceType = "discovery_only";
  readonly baseUrl = "https://discovery-test-feed.org";
  readonly enabled = true;

  async discoverCandidates(
    options: AdapterDiscoveryOptions = {}
  ): Promise<SourceAdapterResult> {
    const candidates: DiscoveredRawCandidate[] = [
      {
        rawId: "mock-new-opp-001",
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        sourceType: this.sourceType,
        title: "National AI Innovation Fellowship 2026",
        organization: "Ministry of Electronics & IT",
        sourceUrl: "https://discovery-test-feed.org/signals/meity-ai-fellowship-2026",
        officialUrlHint: "https://www.meity.gov.in/internship-scheme",
        claimedDeadline: "2026-10-30",
        description: "National fellowship program focusing on advanced AI research and deployment in governance.",
        category: "research_internship",
        categoryLabel: "Research Fellowship",
        stipendOrPrize: "₹35,000/month",
        tags: ["AI", "MeitY", "Fellowship", "Government"],
      },
      {
        rawId: "mock-new-opp-002",
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        sourceType: this.sourceType,
        title: "Smart India Hardware Hackathon 2026 Special Edition",
        organization: "AICTE / Ministry of Education",
        sourceUrl: "https://discovery-test-feed.org/signals/sih-hardware-2026",
        officialUrlHint: "https://sih.gov.in",
        claimedDeadline: "2026-11-15",
        description: "Hardware edition for robotics, IoT, and embedded systems solutions for national problems.",
        category: "hackathon",
        categoryLabel: "National Hackathon",
        stipendOrPrize: "₹1,00,000 Cash Prize",
        tags: ["Hardware", "Robotics", "SIH", "AICTE"],
      },
      {
        rawId: "mock-new-opp-003",
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        sourceType: this.sourceType,
        title: "UPSC Engineering Services Research Grant 2026",
        organization: "Union Public Service Commission",
        sourceUrl: "https://discovery-test-feed.org/signals/upsc-grant-2026",
        officialUrlHint: "https://upsc.gov.in",
        claimedDeadline: "2026-12-01",
        description: "Research grant for engineering graduates excelling in national technical examinations.",
        category: "scholarship",
        categoryLabel: "Government Grant",
        stipendOrPrize: "₹50,000 Award",
        tags: ["UPSC", "Engineering", "Grant", "Govt"],
      },
    ];

    return {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      candidates,
      pagesScraped: 1,
      hasMore: false,
    };
  }
}
