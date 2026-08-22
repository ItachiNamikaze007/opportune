import {
  OpportunitySourceAdapter,
  RawOpportunityCandidate,
} from "./opportunitySourceAdapter";
import { webCrawlerService } from "../crawler/WebCrawlerService";
import type { SourceProvenanceType } from "@/types";
import * as cheerio from "cheerio";

export class Buddy4StudyAdapter implements OpportunitySourceAdapter {
  readonly sourceName = "Buddy4Study Scholarship Feed";
  readonly sourceType: SourceProvenanceType = "partner";
  readonly seedUrls = [
    "https://www.buddy4study.com/scholarships",
  ];
  readonly allowedDomains = ["buddy4study.com", "www.buddy4study.com"];

  async discover(): Promise<RawOpportunityCandidate[]> {
    const candidates: RawOpportunityCandidate[] = [];

    // 1. Primary Strategy: Real Cheerio crawl of Buddy4Study scholarship page
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

            if (!href || text.length < 5) return;
            if (!href.includes("/page/") && !href.includes("/scholarship/")) return;

            try {
              const fullUrl = new URL(href, page.finalUrl).href;
              const title = text.split("\n")[0].trim();
              if (!title || title.toLowerCase().includes("explore") || title.toLowerCase().includes("buddy4study")) {
                return;
              }

              candidates.push({
                rawId: `buddy4study-${Buffer.from(fullUrl).toString("base64").substring(0, 12)}`,
                sourceName: this.sourceName,
                sourceType: this.sourceType,
                title,
                organization: "Buddy4Study Partner",
                sourceUrl: fullUrl,
                category: "scholarship",
                description: `${title} scholarship scheme discovered from Buddy4Study.`,
              });
            } catch {
              // Invalid URL syntax ignored
            }
          });
        }
      } catch (err) {
        console.warn(`[Buddy4StudyAdapter] Crawl warning for ${seedUrl}:`, err);
      }
    }

    // 2. Secondary Strategy: Safe HTTP fetch of Buddy4Study public discovery API
    if (candidates.length === 0) {
      try {
        const response = await fetch("https://www.buddy4study.com/api/v1/scholarships?limit=10", {
          headers: {
            "User-Agent": "OpportuneVerificationBot/1.0",
            Accept: "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          const items = data?.data || data?.scholarships || [];
          for (const item of items) {
            candidates.push({
              rawId: `buddy4study-api-${item.id || item.slug}`,
              sourceName: this.sourceName,
              sourceType: this.sourceType,
              title: item.title || "National Scholarship Scheme",
              organization: item.offeredBy || "Corporate CSR & Foundation",
              sourceUrl: `https://www.buddy4study.com/page/${item.slug}`,
              officialUrlHint: item.officialWebsite || undefined,
              claimedDeadline: item.deadline ? item.deadline.split("T")[0] : undefined,
              description: item.summary || "Merit-cum-means scholarship for undergraduate students.",
              category: "scholarship",
              stipendOrPrize: item.awardAmount ? `Up to ₹${item.awardAmount}` : "Financial Grant",
              tags: ["Scholarship", "Financial Aid", "Undergraduate", "Merit"],
            });
          }
        }
      } catch (err: any) {
        console.warn("[Buddy4StudyAdapter] Network note:", err?.message || err);
      }
    }

    return candidates;
  }
}
