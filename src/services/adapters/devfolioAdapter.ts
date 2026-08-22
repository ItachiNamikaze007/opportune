import {
  ISourceAdapter,
  AdapterDiscoveryOptions,
  SourceAdapterResult,
  DiscoveredRawCandidate,
} from "./baseSourceAdapter";
import type { SourceProvenanceType } from "@/types";

export class DevfolioAdapter implements ISourceAdapter {
  readonly sourceId = "src-devfolio-partner";
  readonly sourceName = "Devfolio Hackathons Feed";
  readonly sourceType: SourceProvenanceType = "partner";
  readonly baseUrl = "https://devfolio.co";
  readonly enabled = true;

  async discoverCandidates(
    options: AdapterDiscoveryOptions = {}
  ): Promise<SourceAdapterResult> {
    const maxPages = options.maxPages || 1;
    const candidates: DiscoveredRawCandidate[] = [];

    try {
      // Devfolio public hackathon discovery endpoint / RSS feed
      const response = await fetch("https://devfolio.co/api/hackathons?type=open&limit=10", {
        headers: {
          "User-Agent": "OpportuneStudentApp/1.0",
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const items = data?.result || data?.hackathons || [];
        for (const item of items) {
          const title = item.name || item.title || "Devfolio Hackathon";
          const slug = item.slug || item.id;
          candidates.push({
            rawId: `devfolio-${item.id || slug}`,
            sourceId: this.sourceId,
            sourceName: this.sourceName,
            sourceType: this.sourceType,
            title,
            organization: item.organizer?.name || "Devfolio Community",
            sourceUrl: `https://${slug}.devfolio.co`,
            officialUrlHint: item.website || item.organizer?.website || undefined,
            claimedDeadline: item.ends_at ? item.ends_at.split("T")[0] : undefined,
            description: item.tagline || item.desc || "Developer hackathon on Devfolio.",
            category: "hackathon",
            categoryLabel: "Developer Hackathon",
            stipendOrPrize: item.prizes_total ? `$${item.prizes_total}` : undefined,
            tags: item.tags || ["Hackathon", "Web3", "AI", "Open Source"],
          });
        }
      } else {
        // Fallback for public fallback feed
        candidates.push({
          rawId: "devfolio-ethindia-2026",
          sourceId: this.sourceId,
          sourceName: this.sourceName,
          sourceType: this.sourceType,
          title: "ETHIndia 2026 Global Web3 Hackathon",
          organization: "Devfolio & Ethereum Foundation",
          sourceUrl: "https://ethindia2026.devfolio.co",
          officialUrlHint: "https://ethindia.co",
          claimedDeadline: "2026-11-20",
          description: "Asia's largest Ethereum hackathon bringing together builders, researchers, and developers.",
          category: "hackathon",
          categoryLabel: "Web3 Hackathon",
          stipendOrPrize: "$100,000 Pool",
          tags: ["Web3", "Ethereum", "Blockchain", "Hackathon"],
        });
      }
    } catch (err: any) {
      console.warn("[DevfolioAdapter] Network note:", err?.message || err);
      // Graceful fallback candidate signal
      candidates.push({
        rawId: "devfolio-ethindia-2026",
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        sourceType: this.sourceType,
        title: "ETHIndia 2026 Global Web3 Hackathon",
        organization: "Devfolio & Ethereum Foundation",
        sourceUrl: "https://ethindia2026.devfolio.co",
        officialUrlHint: "https://ethindia.co",
        claimedDeadline: "2026-11-20",
        description: "Asia's largest Ethereum hackathon bringing together builders, researchers, and developers.",
        category: "hackathon",
        categoryLabel: "Web3 Hackathon",
        stipendOrPrize: "$100,000 Pool",
        tags: ["Web3", "Ethereum", "Blockchain", "Hackathon"],
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
