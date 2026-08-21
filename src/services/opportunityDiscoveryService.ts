import type {
  Opportunity,
  OpportunityCategory,
  SourceProvenanceType,
  VerificationStatus,
  LifecycleStatus,
} from "@/types";
import {
  CONFIGURED_OPPORTUNITY_SOURCES,
  OpportunitySourceConfig,
} from "@/config/opportunitySources";
import { opportunityVerificationService } from "./opportunityVerificationService";
import { linkHealthService } from "./linkHealthService";
import { opportunityRepository } from "@/repositories/opportunityRepository";

export interface DiscoveredCandidate {
  sourceId: string;
  sourceName: string;
  sourceType: SourceProvenanceType;
  title: string;
  organization: string;
  officialUrl: string;
  applyUrl?: string;
  rulesPdfUrl?: string;
  deadline?: string;
  category: OpportunityCategory;
  categoryLabel: string;
  lifecycleStatus: LifecycleStatus;
  verificationStatus: VerificationStatus;
  confidenceScore: number;
  discoveryTimestamp: string;
  discoverySourceUrl: string;
}

export class OpportunityDiscoveryService {
  /**
   * Discovers candidate opportunities from configured sources.
   * STRICT RULES:
   * 1. Only extracts anchors from actual crawled HTML.
   * 2. Rejects any link outside allowed official/partner domains.
   * 3. Never invents /apply, /register, or guessed PDF URLs.
   * 4. Discovered candidates start in 'draft' or 'pending_review' lifecycle state.
   */
  async discoverCandidates(
    sources: OpportunitySourceConfig[] = CONFIGURED_OPPORTUNITY_SOURCES
  ): Promise<DiscoveredCandidate[]> {
    const candidates: DiscoveredCandidate[] = [];
    const enabledSources = sources.filter((s) => s.enabled);

    for (const source of enabledSources) {
      for (const discoveryUrl of source.discoveryUrls) {
        try {
          const fetchResult = await opportunityVerificationService.fetchOfficialSource(discoveryUrl);
          if (!fetchResult.success || !fetchResult.html) {
            continue;
          }

          const discoveredLinks = this.extractCandidateAnchors(
            fetchResult.html,
            discoveryUrl,
            source.allowedDomains
          );

          for (const link of discoveredLinks) {
            // Deduplicate against existing repository by canonical URL
            const existing = await opportunityRepository.findByCanonicalUrl(link.url);
            if (existing) {
              continue;
            }

            // Extract structured fields from HTML
            const extracted = opportunityVerificationService.extractOpportunityFromHtml(
              fetchResult.html,
              link.url
            );

            // Deep crawl to check if this candidate has verified rules PDFs or real apply subpages
            const deepLinks = await linkHealthService.crawlAndDiscoverLinks(
              link.url,
              undefined,
              source.crawlDepth
            );

            const title = link.title || extracted.title || `${source.sourceName} Program`;
            const category: OpportunityCategory = this.inferCategory(title, source);
            const categoryLabel = this.getCategoryLabel(category);

            const candidate: DiscoveredCandidate = {
              sourceId: source.id,
              sourceName: source.sourceName,
              sourceType: source.sourceType,
              title,
              organization: source.sourceName,
              officialUrl: link.url,
              applyUrl: deepLinks.verifiedApplyUrl || extracted.applyUrl || undefined,
              rulesPdfUrl: deepLinks.verifiedRulesPdfUrl || undefined,
              deadline: extracted.deadline || undefined,
              category,
              categoryLabel,
              lifecycleStatus: "draft",
              verificationStatus: "pending",
              confidenceScore: source.sourceType === "official" ? 85 : 75,
              discoveryTimestamp: new Date().toISOString(),
              discoverySourceUrl: discoveryUrl,
            };

            candidates.push(candidate);
          }
        } catch (err) {
          console.warn(`[OpportunityDiscoveryService] Error crawling source ${source.id} at ${discoveryUrl}:`, err);
        }
      }
    }

    return candidates;
  }

  /**
   * Extracts anchor links from HTML strictly conforming to allowed domains.
   */
  private extractCandidateAnchors(
    html: string,
    baseUrl: string,
    allowedDomains: string[]
  ): { url: string; title: string }[] {
    const results: { url: string; title: string }[] = [];
    const seenUrls = new Set<string>();

    const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    let match;

    while ((match = anchorRegex.exec(html)) !== null) {
      const rawHref = match[1].trim();
      const rawText = match[2].replace(/<[^>]+>/g, "").trim();

      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("javascript:") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:")
      ) {
        continue;
      }

      try {
        const resolved = new URL(rawHref, baseUrl);
        if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
          continue;
        }

        const hostname = resolved.hostname.toLowerCase();
        const isAllowed = allowedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
        if (!isAllowed) {
          continue;
        }

        const cleanUrl = resolved.origin + resolved.pathname + resolved.search;
        if (!seenUrls.has(cleanUrl) && cleanUrl !== baseUrl) {
          seenUrls.add(cleanUrl);
          results.push({
            url: cleanUrl,
            title: rawText || "Official Program Notice",
          });
        }
      } catch {
        // Invalid URL syntax ignored
      }
    }

    return results;
  }

  private inferCategory(title: string, source: OpportunitySourceConfig): OpportunityCategory {
    const t = title.toLowerCase();
    if (t.includes("hackathon") || t.includes("challenge") || t.includes("competition")) {
      return "hackathon";
    }
    if (t.includes("exam") || t.includes("upsc") || t.includes("ese") || t.includes("scientist") || t.includes("drdo") || t.includes("isro")) {
      return "government_exam";
    }
    if (t.includes("grant") || t.includes("fund") || t.includes("scholarship")) {
      return "scholarship";
    }
    if (source.sourceType === "official") {
      return "government_internship";
    }
    return "private_internship";
  }

  private getCategoryLabel(category: OpportunityCategory): string {
    switch (category) {
      case "government_internship":
        return "Government Internship";
      case "private_internship":
        return "Industry Internship";
      case "research_internship":
        return "Research Fellowship";
      case "hackathon":
        return "National Hackathon";
      case "government_exam":
        return "Government Recruitment";
      case "scholarship":
        return "Scholarship / Grant";
      default:
        return "Student Program";
    }
  }
}

export const opportunityDiscoveryService = new OpportunityDiscoveryService();
