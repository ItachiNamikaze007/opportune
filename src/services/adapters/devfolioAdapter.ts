import {
  OpportunitySourceAdapter,
  RawOpportunityCandidate,
} from "./opportunitySourceAdapter";
import { webCrawlerService } from "../crawler/WebCrawlerService";
import type { SourceProvenanceType } from "@/types";
import * as cheerio from "cheerio";

export class DevfolioAdapter implements OpportunitySourceAdapter {
  readonly sourceName = "Devfolio Hackathons Feed";
  readonly sourceType: SourceProvenanceType = "partner";
  readonly seedUrls = [
    "https://devfolio.co/hackathons",
  ];
  readonly allowedDomains = ["devfolio.co"];

  private ignoredSubdomains = [
    "guide.devfolio.co",
    "status.devfolio.co",
    "blog.devfolio.co",
    "help.devfolio.co",
  ];

  async discover(): Promise<RawOpportunityCandidate[]> {
    const candidates: RawOpportunityCandidate[] = [];
    const seenUrls = new Set<string>();

    // 1. Primary Strategy: Real Cheerio crawl of Devfolio hackathons listing page
    for (const seedUrl of this.seedUrls) {
      try {
        const crawlReport = await webCrawlerService.crawlListingAndDetailPages(seedUrl, {
          maxPages: 2,
          allowedDomains: this.allowedDomains,
        });

        for (const page of crawlReport.pagesScraped) {
          if (!page.html || page.isBlockedOrRateLimited) continue;

          const $ = cheerio.load(page.html);

          $("a[href]").each((_, el) => {
            const href = $(el).attr("href")?.trim();
            const text = $(el).text().trim();

            if (!href || text.length < 4) return;
            if (!href.includes(".devfolio.co")) return;

            try {
              const resolved = new URL(href, page.finalUrl);
              const host = resolved.hostname.toLowerCase();

              // Skip platform meta pages (guide, status, blog, etc.)
              if (this.ignoredSubdomains.includes(host)) return;
              if (resolved.pathname.includes("/privacy") || resolved.pathname.includes("/terms") || resolved.pathname.includes("/about")) {
                return;
              }

              const fullUrl = resolved.origin + resolved.pathname;
              if (seenUrls.has(fullUrl)) return;
              seenUrls.add(fullUrl);

              const title = text.split("\n")[0].trim();
              if (
                !title ||
                title.toLowerCase().includes("explore") ||
                title.toLowerCase().includes("devfolio") ||
                title.toLowerCase().includes("documentation") ||
                title.toLowerCase().includes("guide") ||
                title.toLowerCase().includes("status")
              ) {
                return;
              }

              candidates.push({
                rawId: `devfolio-${Buffer.from(fullUrl).toString("base64").substring(0, 12)}`,
                sourceName: this.sourceName,
                sourceType: this.sourceType,
                title,
                organization: "Devfolio Host Community",
                sourceUrl: fullUrl,
                category: "hackathon",
                description: `${title} developer hackathon discovered from Devfolio.`,
              });
            } catch {
              // Invalid URL syntax ignored
            }
          });
        }
      } catch (err) {
        console.warn(`[DevfolioAdapter] Crawl warning for ${seedUrl}:`, err);
      }
    }

    // 2. Secondary Strategy: Safe HTTP fetch of Devfolio public discovery endpoint
    if (candidates.length === 0) {
      try {
        const response = await fetch("https://devfolio.co/api/hackathons?type=open&limit=10", {
          headers: {
            "User-Agent": "OpportuneVerificationBot/1.0",
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
              rawId: `devfolio-api-${item.id || slug}`,
              sourceName: this.sourceName,
              sourceType: this.sourceType,
              title,
              organization: item.organizer?.name || "Devfolio Community",
              sourceUrl: `https://${slug}.devfolio.co`,
              officialUrlHint: item.website || item.organizer?.website || undefined,
              claimedDeadline: item.ends_at ? item.ends_at.split("T")[0] : undefined,
              description: item.tagline || item.desc || "Developer hackathon on Devfolio.",
              category: "hackathon",
              stipendOrPrize: item.prizes_total ? `$${item.prizes_total}` : undefined,
              tags: item.tags || ["Hackathon", "Web3", "AI", "Open Source"],
            });
          }
        }
      } catch (err: any) {
        console.warn("[DevfolioAdapter] Network note:", err?.message || err);
      }
    }

    return candidates;
  }
}
