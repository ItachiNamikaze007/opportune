import {
  OpportunitySourceAdapter,
  RawOpportunityCandidate,
} from "./opportunitySourceAdapter";
import { webCrawlerService } from "../crawler/WebCrawlerService";
import type { SourceProvenanceType } from "@/types";
import * as cheerio from "cheerio";

export class HackerEarthAdapter implements OpportunitySourceAdapter {
  readonly sourceName = "HackerEarth Innovation Feed";
  readonly sourceType: SourceProvenanceType = "partner";
  readonly seedUrls = [
    "https://www.hackerearth.com/challenges/",
  ];
  readonly allowedDomains = ["hackerearth.com", "www.hackerearth.com"];

  async discover(): Promise<RawOpportunityCandidate[]> {
    const candidates: RawOpportunityCandidate[] = [];
    const seenUrls = new Set<string>();

    // 1. Primary Strategy: Real Cheerio crawl of HackerEarth challenges listing page
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
            if (!href.includes("/challenges/")) return;

            try {
              const resolved = new URL(href, page.finalUrl);
              const path = resolved.pathname.toLowerCase();

              // Skip root challenges page or generic navigation items
              if (path === "/challenges/" || path === "/challenges" || path.includes("/privacy") || path.includes("/terms")) {
                return;
              }

              const fullUrl = resolved.origin + resolved.pathname;
              if (seenUrls.has(fullUrl)) return;
              seenUrls.add(fullUrl);

              const title = text.split("\n")[0].trim();
              if (
                !title ||
                title.toLowerCase() === "compete" ||
                title.toLowerCase().includes("all challenges") ||
                title.toLowerCase().includes("hackerearth")
              ) {
                return;
              }

              candidates.push({
                rawId: `hackerearth-${Buffer.from(fullUrl).toString("base64").substring(0, 12)}`,
                sourceName: this.sourceName,
                sourceType: this.sourceType,
                title,
                organization: "HackerEarth Partner Host",
                sourceUrl: fullUrl,
                category: "hackathon",
                description: `${title} innovation challenge on HackerEarth.`,
              });
            } catch {
              // Invalid URL syntax ignored
            }
          });
        }
      } catch (err) {
        console.warn(`[HackerEarthAdapter] Crawl warning for ${seedUrl}:`, err);
      }
    }

    // 2. Secondary Strategy: Safe HTTP fetch of HackerEarth public discovery feed
    if (candidates.length === 0) {
      try {
        const response = await fetch(
          "https://www.hackerearth.com/api/events/upcoming/?format=json&limit=10",
          {
            headers: {
              "User-Agent": "OpportuneVerificationBot/1.0",
              Accept: "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const events = data?.events || [];
          for (const ev of events) {
            candidates.push({
              rawId: `hackerearth-api-${ev.id || ev.slug}`,
              sourceName: this.sourceName,
              sourceType: this.sourceType,
              title: ev.title || "HackerEarth Challenge",
              organization: ev.company?.name || "HackerEarth Partner",
              sourceUrl: ev.url || `https://www.hackerearth.com/challenges/${ev.slug}`,
              officialUrlHint: ev.company?.url || undefined,
              claimedDeadline: ev.end_tz ? ev.end_tz.split("T")[0] : undefined,
              description: ev.description || "Global developer innovation challenge.",
              category: "hackathon",
              stipendOrPrize: ev.prizes || undefined,
              tags: ["Coding", "Algorithms", "AI", "HackerEarth"],
            });
          }
        }
      } catch (err: any) {
        console.warn("[HackerEarthAdapter] Network note:", err?.message || err);
      }
    }

    return candidates;
  }
}
