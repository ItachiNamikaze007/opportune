import {
  ISourceAdapter,
  AdapterDiscoveryOptions,
  SourceAdapterResult,
  DiscoveredRawCandidate,
} from "./baseSourceAdapter";
import type { OpportunityCategory, SourceProvenanceType } from "@/types";

export class UnstopAdapter implements ISourceAdapter {
  readonly sourceId = "src-unstop-public";
  readonly sourceName = "Unstop Partner Feed";
  readonly sourceType: SourceProvenanceType = "partner";
  readonly baseUrl = "https://unstop.com";
  readonly enabled = true;

  /**
   * Fetches paginated public opportunities from Unstop.
   */
  async discoverCandidates(
    options: AdapterDiscoveryOptions = {}
  ): Promise<SourceAdapterResult> {
    const maxPages = options.maxPages || 2;
    const perPage = options.perPage || 10;
    const candidates: DiscoveredRawCandidate[] = [];
    let pagesScraped = 0;
    let hasMore = false;

    try {
      for (let page = 1; page <= maxPages; page++) {
        const apiUrl = `https://unstop.com/api/public/opportunity/search-new?per_page=${perPage}&page=${page}`;
        const response = await fetch(apiUrl, {
          headers: {
            "User-Agent": "OpportuneStudentApp/1.0 (Public Opportunity Verification Engine)",
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          console.warn(`[UnstopAdapter] Page ${page} returned status ${response.status}`);
          break;
        }

        const data = await response.json();
        const rawItems = data?.data?.data || [];
        pagesScraped++;

        if (rawItems.length === 0) {
          break;
        }

        for (const item of rawItems) {
          const title = item.title || "Unstop Opportunity";
          const orgName = item.organisation_details?.name || item.seo_details?.[0]?.title || "Partner Host";
          const orgWebsite = item.organisation_details?.website || undefined;
          
          let claimedDeadline: string | undefined = undefined;
          if (item.regnRequirements?.end_regn_dt) {
            claimedDeadline = item.regnRequirements.end_regn_dt.split("T")[0];
          } else if (item.end_date) {
            claimedDeadline = item.end_date.split("T")[0];
          }

          const category = this.determineCategory(item.type, title);
          const slug = typeof item.slug === "string" ? item.slug.trim() : "";
          const publicUrl = typeof item.public_url === "string" ? item.public_url.trim() : "";

          const sourceUrl = publicUrl && publicUrl.startsWith("http")
            ? publicUrl
            : slug
            ? `https://unstop.com/${slug}`
            : `https://unstop.com/o/${item.id || Math.floor(Math.random()*100000)}`;

          candidates.push({
            rawId: `unstop-${item.id}`,
            sourceId: this.sourceId,
            sourceName: this.sourceName,
            sourceType: this.sourceType,
            title,
            organization: orgName,
            sourceUrl,
            officialUrlHint: orgWebsite,
            claimedDeadline,
            description: item.seo_details?.[0]?.description || item.description || undefined,
            category,
            categoryLabel: this.getCategoryLabel(category),
            stipendOrPrize: this.extractPrize(item),
            skills: item.required_skills?.map((s: any) => s.skill || s.skill_name).filter(Boolean) || [],
          });
        }

        hasMore = Boolean(data?.data?.next_page_url);
        if (!hasMore) break;
      }
    } catch (err: any) {
      console.error("[UnstopAdapter] Discovery error:", err?.message || err);
      return {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        candidates,
        pagesScraped,
        hasMore: false,
        error: err?.message || "Unstop fetch failed",
      };
    }

    return {
      sourceId: this.sourceId,
      sourceName: this.sourceName,
      candidates,
      pagesScraped,
      hasMore,
    };
  }

  private determineCategory(typeStr: string | undefined, title: string): OpportunityCategory {
    const t = (typeStr || "").toLowerCase();
    const titleLower = title.toLowerCase();

    if (t.includes("hackathon") || titleLower.includes("hackathon") || titleLower.includes("challenge")) {
      return "hackathon";
    }
    if (t.includes("scholarship") || titleLower.includes("scholarship") || titleLower.includes("grant")) {
      return "scholarship";
    }
    if (t.includes("internship") || titleLower.includes("internship")) {
      return "private_internship";
    }
    if (t.includes("job") || titleLower.includes("fellowship")) {
      return "research_internship";
    }
    return "hackathon";
  }

  private getCategoryLabel(category: OpportunityCategory): string {
    switch (category) {
      case "hackathon":
        return "Hackathon & Challenge";
      case "scholarship":
        return "Scholarship & Grant";
      case "private_internship":
        return "Industry Internship";
      case "research_internship":
        return "Research Fellowship";
      default:
        return "Competition";
    }
  }

  private extractPrize(item: any): string | undefined {
    if (item.prizes && Array.isArray(item.prizes) && item.prizes.length > 0) {
      const p = item.prizes[0];
      if (p.max_cash) return `₹${p.max_cash}`;
      if (p.rank) return `${p.rank} Prize`;
    }
    return undefined;
  }
}
