import { webCrawlerService, CrawledPageResult } from "./WebCrawlerService";
import { RawOpportunityCandidate } from "../adapters/opportunitySourceAdapter";
import { CanonicalCategory, toCanonicalCategory } from "@/types";
import { CONFIGURED_OPPORTUNITY_SOURCES, OpportunitySourceConfig } from "@/config/opportunitySources";
import * as cheerio from "cheerio";

export interface WebcmdDiscoveryQuery {
  category?: CanonicalCategory | "all";
  query?: string;
  maxPages?: number;
}

export interface WebcmdCandidateResult extends RawOpportunityCandidate {
  webcmdDriver: string;
  httpStatus: number;
  fetchedPageUrl: string;
  discoveredAnchorUrl: string;
}

export class WebcmdDiscoveryService {
  readonly driverName = "Webcmd Browser Discovery Driver v2.0";

  /**
   * Performs category-aware discovery on live public websites using Webcmd crawler protocol.
   * Webcmd NEVER publishes anything directly — all candidates start as pending verification.
   */
  async discoverByCategory(params: WebcmdDiscoveryQuery): Promise<WebcmdCandidateResult[]> {
    const results: WebcmdCandidateResult[] = [];
    const targetCategory = params.category && params.category !== "all" ? params.category : undefined;

    // Filter discovery sources based on category target
    const targetSources = CONFIGURED_OPPORTUNITY_SOURCES.filter((source) => {
      if (!source.enabled) return false;
      if (!targetCategory) return true;

      const srcLower = source.sourceName.toLowerCase();
      const descLower = source.description.toLowerCase();

      if (targetCategory === "scholarship") {
        return srcLower.includes("scholarship") || descLower.includes("scholarship") || descLower.includes("scheme");
      }
      if (targetCategory === "hackathon") {
        return srcLower.includes("hackathon") || descLower.includes("hackathon") || descLower.includes("tech");
      }
      if (targetCategory === "government_exam") {
        return srcLower.includes("upsc") || srcLower.includes("isro") || srcLower.includes("drdo") || descLower.includes("exam");
      }
      if (targetCategory === "internship") {
        return srcLower.includes("meity") || srcLower.includes("niti") || descLower.includes("internship");
      }
      return true;
    });

    const sourcesToCrawl = targetSources.length > 0 ? targetSources : CONFIGURED_OPPORTUNITY_SOURCES;

    for (const source of sourcesToCrawl) {
      for (const discoveryUrl of source.discoveryUrls) {
        try {
          const crawledPage = await webCrawlerService.crawlUrl(discoveryUrl, {
            timeoutMs: 8000,
            allowedDomains: source.allowedDomains,
          });

          if (!crawledPage.html || crawledPage.isBlockedOrRateLimited || crawledPage.statusCode >= 400) {
            continue;
          }

          const $ = cheerio.load(crawledPage.html);

          $("a[href]").each((_, el) => {
            const href = $(el).attr("href")?.trim();
            const text = $(el).text().replace(/\s+/g, " ").trim();

            if (!href || text.length < 5) return;
            if (href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) return;

            try {
              const resolved = new URL(href, crawledPage.finalUrl);
              const host = resolved.hostname.toLowerCase();

              const isAllowed = source.allowedDomains.some(
                (d) => host === d.toLowerCase() || host.endsWith(`.${d.toLowerCase()}`)
              );

              if (!isAllowed) return;

              const cleanUrl = resolved.origin + resolved.pathname + resolved.search;
              const guessedCategory = this.inferCategoryFromText(text, source);

              if (targetCategory && guessedCategory !== targetCategory) {
                return;
              }

              results.push({
                rawId: `webcmd-${Buffer.from(cleanUrl).toString("base64").substring(0, 14)}`,
                sourceName: source.sourceName,
                sourceType: source.sourceType,
                title: text,
                organization: source.sourceName,
                sourceUrl: cleanUrl,
                category: guessedCategory,
                description: `${text} discovered via ${source.sourceName} webcmd extraction.`,
                webcmdDriver: this.driverName,
                httpStatus: crawledPage.statusCode,
                fetchedPageUrl: crawledPage.finalUrl,
                discoveredAnchorUrl: cleanUrl,
              });
            } catch {
              // Ignore malformed URL
            }
          });
        } catch (err) {
          console.warn(`[WebcmdDiscoveryService] Crawl note for ${discoveryUrl}:`, err);
        }
      }
    }

    return results;
  }

  private inferCategoryFromText(text: string, source: OpportunitySourceConfig): CanonicalCategory {
    const t = text.toLowerCase();
    const src = source.sourceName.toLowerCase();

    if (t.includes("scholarship") || t.includes("grant") || t.includes("financial aid") || src.includes("buddy4study")) {
      return "scholarship";
    }
    if (t.includes("hackathon") || t.includes("codefest") || t.includes("robotics") || src.includes("devfolio") || src.includes("flipkart")) {
      return "hackathon";
    }
    if (t.includes("exam") || t.includes("upsc") || t.includes("recruitment") || src.includes("upsc") || src.includes("isro")) {
      return "government_exam";
    }
    if (t.includes("fellowship")) {
      return "fellowship";
    }
    if (t.includes("contest") || t.includes("competition")) {
      return "competition";
    }
    if (t.includes("research") || t.includes("lab")) {
      return "research";
    }
    return "internship";
  }
}

export const webcmdDiscoveryService = new WebcmdDiscoveryService();
