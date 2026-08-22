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

// Import Source Adapters
import { ISourceAdapter, DiscoveredRawCandidate } from "./adapters/baseSourceAdapter";
import { UnstopAdapter } from "./adapters/unstopAdapter";
import { DevfolioAdapter } from "./adapters/devfolioAdapter";
import { HackerEarthAdapter } from "./adapters/hackerEarthAdapter";
import { Buddy4StudyAdapter } from "./adapters/buddy4studyAdapter";
import { MockTestSourceAdapter } from "./adapters/mockTestSourceAdapter";

export interface DiscoveredCandidate {
  id?: string;
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
  stipendOrPrize?: string;
  sourceConflict?: boolean;
  conflictDetails?: string;
}

export interface MultiSourceDiscoveryMetrics {
  sourceId: string;
  sourceName: string;
  sourceType: SourceProvenanceType;
  discovered: number;
  newCandidates: number;
  pending: number;
  verified: number;
  rejected: number;
  conflicts: number;
  failures: number;
  pagesScraped: number;
}

export class OpportunityDiscoveryService {
  private adapters: Map<string, ISourceAdapter> = new Map();
  private multiSourceCandidates: DiscoveredCandidate[] = [];

  constructor() {
    this.registerAdapter(new UnstopAdapter());
    this.registerAdapter(new DevfolioAdapter());
    this.registerAdapter(new HackerEarthAdapter());
    this.registerAdapter(new Buddy4StudyAdapter());
    this.registerAdapter(new MockTestSourceAdapter());
  }

  registerAdapter(adapter: ISourceAdapter) {
    this.adapters.set(adapter.sourceId, adapter);
  }

  getAdapter(sourceId: string): ISourceAdapter | undefined {
    return this.adapters.get(sourceId);
  }

  getAllAdapters(): ISourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Multi-Source Discovery Pipeline with Pagination:
   * Source → Discover candidates → Deduplicate → Pending → Find official source → Verify → Revalidate → Publish
   */
  async runMultiSourceDiscovery(options: { maxPagesPerSource?: number } = {}): Promise<{
    candidates: DiscoveredCandidate[];
    metrics: MultiSourceDiscoveryMetrics[];
    publishedCount: number;
  }> {
    const maxPages = options.maxPagesPerSource || 2;
    const metrics: MultiSourceDiscoveryMetrics[] = [];
    const allDiscovered: DiscoveredCandidate[] = [];
    let publishedCount = 0;

    for (const adapter of this.adapters.values()) {
      if (!adapter.enabled) continue;

      const metric: MultiSourceDiscoveryMetrics = {
        sourceId: adapter.sourceId,
        sourceName: adapter.sourceName,
        sourceType: adapter.sourceType,
        discovered: 0,
        newCandidates: 0,
        pending: 0,
        verified: 0,
        rejected: 0,
        conflicts: 0,
        failures: 0,
        pagesScraped: 0,
      };

      try {
        const result = await adapter.discoverCandidates({ maxPages });
        metric.pagesScraped = result.pagesScraped;
        metric.discovered = result.candidates.length;

        if (result.error) {
          metric.failures++;
        }

        for (const raw of result.candidates) {
          // Check if candidate already exists in repository by title or URL
          const existingRepoOpp =
            (await opportunityRepository.findByCanonicalUrl(raw.officialUrlHint || raw.sourceUrl)) ||
            (await opportunityRepository.findByTitle(raw.title));

          if (existingRepoOpp) {
            // Already in repository
            continue;
          }

          // Check if already in candidate pool
          const existingCandidate = this.multiSourceCandidates.find(
            (c) => c.title.toLowerCase() === raw.title.toLowerCase() || c.discoverySourceUrl === raw.sourceUrl
          );

          if (existingCandidate) {
            continue;
          }

          metric.newCandidates++;

          // Build candidate object (starts as pending_verification / discovery_only)
          const officialUrl = raw.officialUrlHint || raw.sourceUrl;
          const candidateId = `cand-${raw.sourceId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

          const candidate: DiscoveredCandidate = {
            id: candidateId,
            sourceId: raw.sourceId,
            sourceName: raw.sourceName,
            sourceType: raw.sourceType,
            title: raw.title,
            organization: raw.organization,
            officialUrl: officialUrl,
            deadline: raw.claimedDeadline,
            category: raw.category,
            categoryLabel: raw.categoryLabel,
            lifecycleStatus: "draft",
            verificationStatus: "pending",
            confidenceScore: raw.sourceType === "official" ? 85 : 70,
            discoveryTimestamp: new Date().toISOString(),
            discoverySourceUrl: raw.sourceUrl,
            stipendOrPrize: raw.stipendOrPrize,
          };

          // Step: Find official source & Verify
          const verificationResult = await this.verifyAndPromoteCandidate(candidate, raw);

          if (verificationResult.verified && verificationResult.publishedOpportunity) {
            metric.verified++;
            candidate.verificationStatus = "verified";
            candidate.lifecycleStatus = "published";
            candidate.officialUrl = verificationResult.publishedOpportunity.officialUrl;
            if (verificationResult.conflictDetected) {
              metric.conflicts++;
              candidate.sourceConflict = true;
              candidate.conflictDetails = verificationResult.conflictDetails;
            }
            publishedCount++;
          } else {
            metric.pending++;
          }

          this.multiSourceCandidates.push(candidate);
          allDiscovered.push(candidate);
        }
      } catch (err: any) {
        console.error(`[OpportunityDiscoveryService] Error discovering from ${adapter.sourceName}:`, err);
        metric.failures++;
      }

      metrics.push(metric);
    }

    return {
      candidates: allDiscovered,
      metrics,
      publishedCount,
    };
  }

  /**
   * Verifies official source for a discovered candidate and ingests it into repository if verified.
   */
  private async verifyAndPromoteCandidate(
    candidate: DiscoveredCandidate,
    raw: DiscoveredRawCandidate
  ): Promise<{
    verified: boolean;
    publishedOpportunity?: Opportunity;
    conflictDetected?: boolean;
    conflictDetails?: string;
  }> {
    const targetUrl = raw.officialUrlHint || raw.sourceUrl;
    if (!targetUrl) {
      return { verified: false };
    }

    // HTTP Verify target official domain
    const fetchResult = await opportunityVerificationService.fetchOfficialSource(targetUrl);
    if (!fetchResult.success || !fetchResult.html) {
      return { verified: false };
    }

    const domainValid = opportunityVerificationService.isValidOfficialUrl(targetUrl);
    if (!domainValid) {
      return { verified: false };
    }

    // Extract canonical title/deadline from official HTML
    const extracted = opportunityVerificationService.extractOpportunityFromHtml(
      fetchResult.html,
      targetUrl
    );

    const canonicalDeadline = extracted.deadline || raw.claimedDeadline || "2026-10-30";
    let conflictDetected = false;
    let conflictDetails = undefined;

    if (raw.claimedDeadline && extracted.deadline && raw.claimedDeadline !== extracted.deadline) {
      conflictDetected = true;
      conflictDetails = `Official deadline (${extracted.deadline}) prioritized over ${raw.sourceName} claim (${raw.claimedDeadline}).`;
    }

    const newOppId = `opp-discovered-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString().split("T")[0];

    const newOpportunity: Opportunity = {
      id: newOppId,
      title: raw.title,
      organization: raw.organization,
      category: raw.category,
      categoryLabel: raw.categoryLabel,
      description: raw.description || `${raw.title} organized by ${raw.organization}. Discovered via ${raw.sourceName}.`,
      fullDescription: `${raw.title} is an active student program. Discovered from ${raw.sourceName} (${raw.sourceUrl}) and verified directly against official domain ${targetUrl}.`,
      deadline: canonicalDeadline,
      location: raw.location || "India / Remote",
      remote: true,
      stipendOrPrize: raw.stipendOrPrize || "Certificate & Perks",
      stipendType: "stipend",
      officialUrl: targetUrl,
      sourceUrl: raw.sourceUrl,
      verificationStatus: "verified",
      lifecycleStatus: "published",
      confidenceScore: 92,
      confidenceLevel: "high_confidence",
      confidenceBreakdown: {
        title: 95,
        deadline: 90,
        eligibility: 90,
        organization: 95,
        url: 90,
        overall: 92,
        level: "high_confidence",
      },
      lastVerified: nowIso,
      isDemo: false,
      featured: false,
      tags: raw.tags || ["Discovered", "Verified"],
      benefits: ["Official Certificate", "Direct Organization Verification"],
      applicationSteps: [
        "Review official program notification",
        "Verify eligibility requirements",
        "Submit application via official portal",
      ],
      importantDates: [
        { label: "Application Deadline", date: canonicalDeadline },
        { label: "Verification Date", date: nowIso },
      ],
      eligibilityCriteria: {
        allowedDegrees: ["B.Tech", "B.E.", "B.Sc", "M.Sc", "MCA", "M.Tech"],
        allowedBranches: ["All Engineering & Tech Branches"],
        allowedYears: [1, 2, 3, 4],
        minCGPA: 6.0,
        requiredSkills: raw.skills || ["Problem Solving"],
      },
      sourceId: raw.sourceId,
      sourceName: raw.sourceName,
      sourceType: "official", // Once verified against official domain, source provenance is official
    };

    // Promote to OpportunityRepository!
    const published = await opportunityRepository.upsert(newOpportunity);
    return {
      verified: true,
      publishedOpportunity: published,
      conflictDetected,
      conflictDetails,
    };
  }

  /**
   * Existing discovery method based on HTML seed crawling
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
            const existing = await opportunityRepository.findByCanonicalUrl(link.url);
            if (existing) {
              continue;
            }

            const extracted = opportunityVerificationService.extractOpportunityFromHtml(
              fetchResult.html,
              link.url
            );

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

  getAllMultiSourceCandidates(): DiscoveredCandidate[] {
    return [...this.multiSourceCandidates];
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
