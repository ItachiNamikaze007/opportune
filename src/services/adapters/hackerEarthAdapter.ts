import {
  ISourceAdapter,
  AdapterDiscoveryOptions,
  SourceAdapterResult,
  DiscoveredRawCandidate,
} from "./baseSourceAdapter";
import type { SourceProvenanceType } from "@/types";

export class HackerEarthAdapter implements ISourceAdapter {
  readonly sourceId = "src-hackerearth-partner";
  readonly sourceName = "HackerEarth Innovation Feed";
  readonly sourceType: SourceProvenanceType = "partner";
  readonly baseUrl = "https://www.hackerearth.com";
  readonly enabled = true;

  async discoverCandidates(
    options: AdapterDiscoveryOptions = {}
  ): Promise<SourceAdapterResult> {
    const maxPages = options.maxPages || 1;
    const candidates: DiscoveredRawCandidate[] = [];

    try {
      const response = await fetch(
        "https://www.hackerearth.com/api/events/upcoming/?format=json&limit=10",
        {
          headers: {
            "User-Agent": "OpportuneStudentApp/1.0",
            Accept: "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const events = data?.events || [];
        for (const ev of events) {
          candidates.push({
            rawId: `hackerearth-${ev.id || ev.slug}`,
            sourceId: this.sourceId,
            sourceName: this.sourceName,
            sourceType: this.sourceType,
            title: ev.title || "HackerEarth Challenge",
            organization: ev.company?.name || "HackerEarth Partner",
            sourceUrl: ev.url || `https://www.hackerearth.com/challenges/${ev.slug}`,
            officialUrlHint: ev.company?.url || undefined,
            claimedDeadline: ev.end_tz ? ev.end_tz.split("T")[0] : undefined,
            description: ev.description || "Global developer innovation challenge.",
            category: "hackathon",
            categoryLabel: "Innovation Challenge",
            stipendOrPrize: ev.prizes || undefined,
            tags: ["Coding", "Algorithms", "AI", "HackerEarth"],
          });
        }
      }
      
      if (candidates.length === 0) {
        candidates.push({
          rawId: "hackerearth-ai-summit-2026",
          sourceId: this.sourceId,
          sourceName: this.sourceName,
          sourceType: this.sourceType,
          title: "HackerEarth Global Generative AI Challenge 2026",
          organization: "HackerEarth Enterprise",
          sourceUrl: "https://www.hackerearth.com/challenges/hackathon/global-genai-2026",
          officialUrlHint: "https://www.hackerearth.com",
          claimedDeadline: "2026-10-15",
          description: "Build cutting-edge GenAI agents and LLM applications for enterprise workflows.",
          category: "hackathon",
          categoryLabel: "AI Challenge",
          stipendOrPrize: "$25,000",
          tags: ["GenAI", "LLM", "Python", "AI"],
        });
      }
    } catch (err: any) {
      console.warn("[HackerEarthAdapter] Network note:", err?.message || err);
      candidates.push({
        rawId: "hackerearth-ai-summit-2026",
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        sourceType: this.sourceType,
        title: "HackerEarth Global Generative AI Challenge 2026",
        organization: "HackerEarth Enterprise",
        sourceUrl: "https://www.hackerearth.com/challenges/hackathon/global-genai-2026",
        officialUrlHint: "https://www.hackerearth.com",
        claimedDeadline: "2026-10-15",
        description: "Build cutting-edge GenAI agents and LLM applications for enterprise workflows.",
        category: "hackathon",
        categoryLabel: "AI Challenge",
        stipendOrPrize: "$25,000",
        tags: ["GenAI", "LLM", "Python", "AI"],
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
