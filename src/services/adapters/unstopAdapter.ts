import {
  OpportunitySourceAdapter,
  RawOpportunityCandidate,
} from "./opportunitySourceAdapter";
import { webCrawlerService } from "../crawler/WebCrawlerService";
import type { OpportunityCategory, SourceProvenanceType } from "@/types";
import * as cheerio from "cheerio";

export class UnstopAdapter implements OpportunitySourceAdapter {
  readonly sourceName = "Unstop Partner Feed";
  readonly sourceType: SourceProvenanceType = "partner";
  readonly seedUrls = [
    "https://unstop.com/hackathons",
    "https://unstop.com/competitions",
    "https://unstop.com/scholarships",
    "https://unstop.com/internships",
  ];
  readonly allowedDomains = ["unstop.com", "d2c.in", "dare2compete.com"];

  async discover(): Promise<RawOpportunityCandidate[]> {
    const candidates: RawOpportunityCandidate[] = [];

    // 1. Primary Strategy: Real Web Crawl of listing and detail pages
    for (const seedUrl of this.seedUrls) {
      try {
        const crawlReport = await webCrawlerService.crawlListingAndDetailPages(seedUrl, {
          maxPages: 3,
          allowedDomains: this.allowedDomains,
        });

        for (const page of crawlReport.pagesScraped) {
          if (!page.html || page.isBlockedOrRateLimited) continue;

          const $ = cheerio.load(page.html);

          // Extract opportunity detail cards / items from Cheerio DOM
          $("a[href]").each((_, el) => {
            const href = $(el).attr("href")?.trim();
            const text = $(el).text().trim();

            if (!href || text.length < 5) return;
            if (!href.includes("/hackathons/") && !href.includes("/competitions/") && !href.includes("/scholarships/") && !href.includes("/o/")) {
              return;
            }

            try {
              const fullUrl = new URL(href, page.finalUrl).href;
              const title = text.split("\n")[0].trim();
              if (!title || title.toLowerCase().includes("explore") || title.toLowerCase().includes("view all")) {
                return;
              }

              const category = this.determineCategory(seedUrl, title);

              candidates.push({
                rawId: `unstop-crawl-${Buffer.from(fullUrl).toString("base64").substring(0, 12)}`,
                sourceName: this.sourceName,
                sourceType: this.sourceType,
                title,
                organization: "Unstop Partner Host",
                sourceUrl: fullUrl,
                category,
                description: `${title} discovered from Unstop public listings.`,
              });
            } catch {
              // Invalid URL syntax ignored
            }
          });
        }
      } catch (err) {
        console.warn(`[UnstopAdapter] Crawl warning for ${seedUrl}:`, err);
      }
    }

    // 2. Secondary Strategy: Safe HTTP fetch of Unstop public discovery API endpoint
    if (candidates.length === 0) {
      try {
        const response = await fetch(
          "https://unstop.com/api/public/opportunity/search-new?per_page=10&page=1",
          {
            headers: {
              "User-Agent": "OpportuneVerificationBot/1.0",
              Accept: "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawItems = data?.data?.data || [];

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
              : `https://unstop.com/o/${item.id}`;

            candidates.push({
              rawId: `unstop-api-${item.id}`,
              sourceName: this.sourceName,
              sourceType: this.sourceType,
              title,
              organization: orgName,
              sourceUrl,
              officialUrlHint: orgWebsite,
              claimedDeadline,
              description: item.seo_details?.[0]?.description || item.description || undefined,
              category,
              stipendOrPrize: this.extractPrize(item),
              skills: item.required_skills?.map((s: any) => s.skill || s.skill_name).filter(Boolean) || [],
            });
          }
        }
      } catch (err: any) {
        console.warn("[UnstopAdapter] API fallback error:", err?.message || err);
      }
    }

    return candidates;
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
    if (t.includes("fellowship") || titleLower.includes("fellowship")) {
      return "fellowship";
    }
    return "competition";
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
