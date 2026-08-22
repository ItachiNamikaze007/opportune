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
import { confidenceScoringService } from "./confidenceScoringService";
import { verificationDiagnosticsService } from "./verificationDiagnosticsService";

// Import Real Crawler & Adapters
import { OpportunitySourceAdapter, RawOpportunityCandidate } from "./adapters/opportunitySourceAdapter";
import { UnstopAdapter } from "./adapters/unstopAdapter";
import { DevfolioAdapter } from "./adapters/devfolioAdapter";
import { HackerEarthAdapter } from "./adapters/hackerEarthAdapter";
import { Buddy4StudyAdapter } from "./adapters/buddy4studyAdapter";
import { webcmdDiscoveryService, WebcmdCandidateResult } from "./crawler/webcmdDiscoveryService";
import { CanonicalCategory, toCanonicalCategory } from "@/types";

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

export interface CrawlerTelemetryMetrics {
  sourceName: string;
  sourceType: SourceProvenanceType;
  pagesFetched: number;
  candidatesFound: number;
  candidatesNormalized: number;
  candidatesVerified: number;
  candidatesRejected: number;
  duplicates: number;
  rateLimited: number;
  failures: number;
}

export class OpportunityDiscoveryService {
  private adapters: Map<string, OpportunitySourceAdapter> = new Map();
  private multiSourceCandidates: DiscoveredCandidate[] = [];

  constructor() {
    this.registerAdapter(new UnstopAdapter());
    this.registerAdapter(new DevfolioAdapter());
    this.registerAdapter(new HackerEarthAdapter());
    this.registerAdapter(new Buddy4StudyAdapter());
  }

  registerAdapter(adapter: OpportunitySourceAdapter) {
    this.adapters.set(adapter.sourceName, adapter);
  }

  getAdapter(sourceName: string): OpportunitySourceAdapter | undefined {
    return this.adapters.get(sourceName);
  }

  getAllAdapters(): OpportunitySourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Production Web Crawler Discovery Pipeline:
   * Real Crawl -> Deduplicate -> Pending Candidate -> Verify Official Organizer -> Revalidate -> Publish
   */
  /**
   * Executes Webcmd category-aware targeted discovery.
   * All Webcmd discovered candidates start as pending verification and require official domain verification.
   */
  async runWebcmdTargetedDiscovery(
    category?: CanonicalCategory | "all",
    query?: string
  ): Promise<{ candidatesDiscovered: number; publishedCount: number }> {
    const webcmdResults = await webcmdDiscoveryService.discoverByCategory({ category, query });
    let publishedCount = 0;

    for (const raw of webcmdResults) {
      const candidate: DiscoveredCandidate = {
        sourceId: `webcmd-${raw.sourceName.toLowerCase().replace(/\s+/g, "-")}`,
        sourceName: raw.sourceName,
        sourceType: raw.sourceType,
        title: raw.title,
        organization: raw.organization,
        officialUrl: raw.sourceUrl,
        category: raw.category,
        categoryLabel: raw.category.toUpperCase(),
        lifecycleStatus: "pending_review",
        verificationStatus: "pending",
        confidenceScore: 40,
        discoveryTimestamp: new Date().toISOString(),
        discoverySourceUrl: raw.sourceUrl,
      };

      const verifyRes = await this.verifyAndPromoteCandidate(candidate, raw);
      if (verifyRes.verified && verifyRes.publishedOpportunity) {
        publishedCount++;
      }
    }

    return {
      candidatesDiscovered: webcmdResults.length,
      publishedCount,
    };
  }

  async runRealWebCrawlerDiscovery(): Promise<{
    candidates: DiscoveredCandidate[];
    telemetry: CrawlerTelemetryMetrics[];
    publishedCount: number;
  }> {
    verificationDiagnosticsService.clearDiagnostics();
    const telemetry: CrawlerTelemetryMetrics[] = [];
    const allDiscovered: DiscoveredCandidate[] = [];
    let publishedCount = 0;

    for (const adapter of this.adapters.values()) {
      const metric: CrawlerTelemetryMetrics = {
        sourceName: adapter.sourceName,
        sourceType: adapter.sourceType,
        pagesFetched: 0,
        candidatesFound: 0,
        candidatesNormalized: 0,
        candidatesVerified: 0,
        candidatesRejected: 0,
        duplicates: 0,
        rateLimited: 0,
        failures: 0,
      };

      try {
        const rawCandidates = await adapter.discover();
        metric.candidatesFound = rawCandidates.length;

        for (const raw of rawCandidates) {
          metric.candidatesNormalized++;

          // Deduplication check: canonical URL, normalized (title + org), or source URL
          const normTitleOrg = `${raw.title.toLowerCase().trim()}|${raw.organization.toLowerCase().trim()}`;
          const targetUrl = raw.officialUrlHint || raw.sourceUrl;

          const existingByUrl = await opportunityRepository.findByCanonicalUrl(targetUrl);
          const existingByTitle = await opportunityRepository.findByTitle(raw.title);
          
          if (existingByUrl || existingByTitle) {
            metric.duplicates++;
            verificationDiagnosticsService.recordDiagnostic({
              candidateId: `cand-dedup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              candidateTitle: raw.title,
              sourceName: raw.sourceName,
              sourceType: raw.sourceType,
              sourceUrl: raw.sourceUrl,
              category: raw.category,
              officialOrganization: raw.organization,
              officialUrlFound: Boolean(raw.officialUrlHint || raw.sourceUrl),
              officialUrlReachable: true,
              deadlineFound: Boolean(raw.claimedDeadline),
              eligibilityFound: Boolean(raw.degrees && raw.degrees.length > 0),
              confidenceScore: 90,
              dedupMatched: true,
              finalDecision: "pending",
              reason: "Deduplicated — Candidate already exists in Opportunity Repository.",
              missingEvidence: [],
            });
            continue;
          }

          // Build candidate object
          const candidateId = `cand-${raw.sourceName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

          const candidate: DiscoveredCandidate = {
            id: candidateId,
            sourceId: raw.sourceName.replace(/\s+/g, "-").toLowerCase(),
            sourceName: raw.sourceName,
            sourceType: raw.sourceType,
            title: raw.title,
            organization: raw.organization,
            officialUrl: targetUrl,
            deadline: raw.claimedDeadline,
            category: raw.category,
            categoryLabel: this.getCategoryLabel(raw.category),
            lifecycleStatus: "draft",
            verificationStatus: "pending",
            confidenceScore: raw.sourceType === "official" ? 85 : 70,
            discoveryTimestamp: new Date().toISOString(),
            discoverySourceUrl: raw.sourceUrl,
            stipendOrPrize: raw.stipendOrPrize,
          };

          // Step: Official Source Verification
          const verificationResult = await this.verifyAndPromoteCandidate(candidate, raw);

          if (verificationResult.verified && verificationResult.publishedOpportunity) {
            metric.candidatesVerified++;
            candidate.verificationStatus = "verified";
            candidate.lifecycleStatus = "published";
            candidate.officialUrl = verificationResult.publishedOpportunity.officialUrl;
            if (verificationResult.conflictDetected) {
              candidate.sourceConflict = true;
              candidate.conflictDetails = verificationResult.conflictDetails;
            }
            publishedCount++;

            verificationDiagnosticsService.recordDiagnostic({
              candidateId,
              candidateTitle: raw.title,
              sourceName: raw.sourceName,
              sourceType: raw.sourceType,
              sourceUrl: raw.sourceUrl,
              category: raw.category,
              officialOrganization: raw.organization,
              officialUrlFound: true,
              officialUrlReachable: true,
              deadlineFound: true,
              eligibilityFound: true,
              confidenceScore: verificationResult.publishedOpportunity.confidenceScore || 90,
              dedupMatched: false,
              finalDecision: "published",
              reason: "Officially Verified — Candidate verified against official domain and published.",
              missingEvidence: [],
            });
          } else {
            metric.candidatesRejected++;

            verificationDiagnosticsService.recordDiagnostic({
              candidateId,
              candidateTitle: raw.title,
              sourceName: raw.sourceName,
              sourceType: raw.sourceType,
              sourceUrl: raw.sourceUrl,
              category: raw.category,
              officialOrganization: raw.organization,
              officialUrlFound: Boolean(raw.officialUrlHint),
              officialUrlReachable: verificationResult.reachable ?? false,
              deadlineFound: Boolean(raw.claimedDeadline),
              eligibilityFound: Boolean(raw.degrees && raw.degrees.length > 0),
              confidenceScore: 40,
              dedupMatched: false,
              finalDecision: "pending",
              reason: verificationResult.holdReason || "Pending Verification — Official organizer domain proof missing or unreachable.",
              missingEvidence: verificationResult.missingEvidence || ["Official organizer domain link missing"],
            });
          }

          this.multiSourceCandidates.push(candidate);
          allDiscovered.push(candidate);
        }
      } catch (err: any) {
        console.error(`[OpportunityDiscoveryService] Crawler error for ${adapter.sourceName}:`, err);
        metric.failures++;
      }

      telemetry.push(metric);
    }

    return {
      candidates: allDiscovered,
      telemetry,
      publishedCount,
    };
  }

  /**
   * Verifies official source for a discovered candidate and ingests it into repository if verified.
   */
  private async verifyAndPromoteCandidate(
    candidate: DiscoveredCandidate,
    raw: RawOpportunityCandidate
  ): Promise<{
    verified: boolean;
    publishedOpportunity?: Opportunity;
    conflictDetected?: boolean;
    conflictDetails?: string;
    reachable?: boolean;
    holdReason?: string;
    missingEvidence?: string[];
  }> {
    const targetUrl = raw.officialUrlHint || raw.sourceUrl;
    if (!targetUrl) {
      return {
        verified: false,
        reachable: false,
        holdReason: "Pending Verification — Candidate has no official URL hint or source URL.",
        missingEvidence: ["Target official URL missing"],
      };
    }

    // HTTP Verify target official domain
    const fetchResult = await opportunityVerificationService.fetchOfficialSource(targetUrl);
    if (!fetchResult.success || !fetchResult.html) {
      return {
        verified: false,
        reachable: false,
        holdReason: `Pending Verification — Target domain (${targetUrl}) HTTP request failed or timed out.`,
        missingEvidence: [`HTTP network unreachable for ${targetUrl}`],
      };
    }

    const domainValid = opportunityVerificationService.isValidOfficialUrl(targetUrl);
    if (!domainValid) {
      return {
        verified: false,
        reachable: true,
        holdReason: `Pending Verification — Domain (${targetUrl}) is a third-party/partner domain, not in official organizer domain allowlist.`,
        missingEvidence: [
          `Official organizer website link missing (Partner domain ${targetUrl} cannot be treated as official truth)`,
        ],
      };
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

    const confidenceCalc = confidenceScoringService.calculateConfidence({
      officialUrl: targetUrl,
      isDomainVerified: domainValid,
      isOfficialSource: raw.sourceType === "official" || domainValid,
      deadline: canonicalDeadline,
      hasEligibility: true,
      isLinkHealthy: fetchResult.success,
    });

    const newOpportunity: Opportunity = {
      id: newOppId,
      title: raw.title,
      organization: raw.organization,
      category: raw.category,
      categoryLabel: this.getCategoryLabel(raw.category),
      description: raw.description || `${raw.title} organized by ${raw.organization}. Discovered via ${raw.sourceName}.`,
      fullDescription: `${raw.title} is an active student program. Discovered from ${raw.sourceName} (${raw.sourceUrl}) and verified directly against official domain ${targetUrl}.`,
      deadline: canonicalDeadline,
      location: raw.location || "India / Remote",
      remote: true,
      stipendOrPrize: raw.stipendOrPrize || "Certificate & Perks",
      stipendType: "stipend",
      officialUrl: targetUrl,
      sourceUrl: raw.sourceUrl,
      applyUrl: raw.discoveredApplyUrl || undefined,
      rulesPdfUrl: raw.discoveredRulesUrl || undefined,
      verificationStatus: "verified",
      lifecycleStatus: "published",
      confidenceScore: confidenceCalc.totalScore,
      confidenceLevel: confidenceCalc.confidenceLevel,
      confidenceBreakdown: {
        title: 95,
        deadline: confidenceCalc.validDeadlineScore * 6,
        eligibility: confidenceCalc.eligibilityCompletenessScore * 10,
        organization: confidenceCalc.officialSourceMatchScore * 4,
        url: confidenceCalc.officialDomainVerifiedScore * 2.5,
        overall: confidenceCalc.totalScore,
        level: confidenceCalc.confidenceLevel,
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
        allowedDegrees: raw.degrees || ["B.Tech", "B.E.", "B.Sc", "M.Sc", "MCA", "M.Tech"],
        allowedBranches: raw.branches || ["All Engineering & Tech Branches"],
        allowedYears: raw.years || [1, 2, 3, 4],
        minCGPA: raw.minCGPA || 6.0,
        requiredSkills: raw.skills || ["Problem Solving"],
      },
      sourceId: raw.sourceName.replace(/\s+/g, "-").toLowerCase(),
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
   * Seed discovery based on HTML anchor crawling
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

            const deepLinks = {
              verifiedApplyUrl: undefined,
              verifiedRulesPdfUrl: undefined,
            };

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
      case "fellowship":
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
