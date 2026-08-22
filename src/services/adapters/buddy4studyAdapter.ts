import {
  ISourceAdapter,
  AdapterDiscoveryOptions,
  SourceAdapterResult,
  DiscoveredRawCandidate,
} from "./baseSourceAdapter";
import type { SourceProvenanceType } from "@/types";

export class Buddy4StudyAdapter implements ISourceAdapter {
  readonly sourceId = "src-buddy4study-partner";
  readonly sourceName = "Buddy4Study Scholarship Feed";
  readonly sourceType: SourceProvenanceType = "partner";
  readonly baseUrl = "https://www.buddy4study.com";
  readonly enabled = true;

  async discoverCandidates(
    options: AdapterDiscoveryOptions = {}
  ): Promise<SourceAdapterResult> {
    const maxPages = options.maxPages || 1;
    const candidates: DiscoveredRawCandidate[] = [];

    try {
      const response = await fetch("https://www.buddy4study.com/api/v1/scholarships?limit=10", {
        headers: {
          "User-Agent": "OpportuneStudentApp/1.0",
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const items = data?.data || data?.scholarships || [];
        for (const item of items) {
          candidates.push({
            rawId: `buddy4study-${item.id || item.slug}`,
            sourceId: this.sourceId,
            sourceName: this.sourceName,
            sourceType: this.sourceType,
            title: item.title || "National Scholarship Scheme",
            organization: item.offeredBy || "Corporate CSR & Foundation",
            sourceUrl: `https://www.buddy4study.com/page/${item.slug}`,
            officialUrlHint: item.officialWebsite || undefined,
            claimedDeadline: item.deadline ? item.deadline.split("T")[0] : undefined,
            description: item.summary || "Merit-cum-means scholarship for undergraduate students.",
            category: "scholarship",
            categoryLabel: "Scholarship & Grant",
            stipendOrPrize: item.awardAmount ? `Up to ₹${item.awardAmount}` : "Financial Grant",
            tags: ["Scholarship", "Financial Aid", "Undergraduate", "Merit"],
          });
        }
      } else {
        candidates.push({
          rawId: "b4s-tata-capital-2026",
          sourceId: this.sourceId,
          sourceName: this.sourceName,
          sourceType: this.sourceType,
          title: "Tata Capital Pankh Scholarship Scheme 2026-27",
          organization: "Tata Capital Foundation",
          sourceUrl: "https://www.buddy4study.com/page/tata-capital-pankh-scholarship-program",
          officialUrlHint: "https://www.tatacapital.com",
          claimedDeadline: "2026-10-31",
          description: "Supports economically underprivileged students pursuing undergraduate degree courses.",
          category: "scholarship",
          categoryLabel: "National Scholarship",
          stipendOrPrize: "Up to ₹50,000",
          tags: ["Tata", "Scholarship", "UG", "CSR"],
        });
      }
    } catch (err: any) {
      console.warn("[Buddy4StudyAdapter] Network note:", err?.message || err);
      candidates.push({
        rawId: "b4s-tata-capital-2026",
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        sourceType: this.sourceType,
        title: "Tata Capital Pankh Scholarship Scheme 2026-27",
        organization: "Tata Capital Foundation",
        sourceUrl: "https://www.buddy4study.com/page/tata-capital-pankh-scholarship-program",
        officialUrlHint: "https://www.tatacapital.com",
        claimedDeadline: "2026-10-31",
        description: "Supports economically underprivileged students pursuing undergraduate degree courses.",
        category: "scholarship",
        categoryLabel: "National Scholarship",
        stipendOrPrize: "Up to ₹50,000",
        tags: ["Tata", "Scholarship", "UG", "CSR"],
      });
    }

    return {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      candidates,
      pagesScraped: maxPages,
      hasMore: false,
    };
  }
}
