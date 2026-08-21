import { Opportunity } from "@/types";
import { getOpportunityStatus } from "@/services/opportunityStatusResolver";

/**
 * Structured Official Domain Allowlist
 */
const OFFICIAL_DOMAIN_ALLOWLIST = [
  ".gov.in",
  ".nic.in",
  ".ac.in",
  ".res.in",
  ".edu.in",
  "isro.gov.in",
  "meity.gov.in",
  "drdo.gov.in",
  "rac.gov.in",
  "upsc.gov.in",
  "upsconline.nic.in",
  "niti.gov.in",
  "aicte-india.org",
  "sih.gov.in",
  "mygov.in",
  "dst.gov.in",
  "dbtindia.gov.in",
  "ugc.ac.in",
  "gate2026.iitkgp.ac.in",
  "tcs.com",
  "campuscommune.tcs.com",
  "opensource.google",
  "summerofcode.withgoogle.com",
  "google.com",
  "microsoft.com",
  "careers.microsoft.com",
  "amazon.jobs",
  "ibm.com",
  "github.com",
];

const PARTNER_DOMAIN_ALLOWLIST = [
  "unstop.com",
  "dare2compete.com",
  "d2c.in",
];

const THIRD_PARTY_DISALLOWLIST = [
  "google.com/search",
  "bing.com",
  "reddit.com",
  "linkedin.com/posts",
  "medium.com",
  "blogger.com",
  "quora.com",
  "unstop.com/blog",
  "freshersnow.com",
  "sarkariresult.com",
  "freejobalert.com",
  "opportunitytracker.com",
];

export interface SourceComparisonResult {
  hasConflict: boolean;
  resolvedDeadline: string;
  sourceType: "official" | "partner" | "aggregator";
  officialDeadline?: string;
  partnerDeadline?: string;
  resolutionNote: string;
  verificationStatus: "verified" | "partner_verified" | "pending";
}

export interface LiveVerificationResult {
  verified: boolean;
  httpStatus: number;
  fetchedSuccessfully: boolean;
  officialUrl: string;
  extractedTitle?: string;
  extractedDeadline?: string;
  extractedApplyUrl?: string;
  extractedRulesPdfUrl?: string;
  storedDeadline: string;
  deadlineMatches: boolean;
  isExpired: boolean;
  lastVerifiedAt: string;
  reason?: string;
  domainValid: boolean;
  sourceType?: "official" | "partner" | "aggregator";
}

export interface VerificationResult {
  verified: boolean;
  reason?: string;
  officialUrl?: string;
  applyUrl?: string;
  rulesPdfUrl?: string;
  sourceName?: string;
  sourceType?: "official" | "partner" | "aggregator";
  deadline?: string;
  isExpired?: boolean;
  verifiedAt?: string;
  domainValid?: boolean;
}

/**
 * Opportunity Verification Service
 * Authoritative gatekeeper performing REAL HTTP fetching, HTML extraction,
 * official domain allowlisting, partner source verification (e.g. Unstop),
 * conflict resolution (Official > PDF > Partner), and rules PDF validation.
 */
export const opportunityVerificationService = {
  /**
   * Validates if a URL belongs to a legitimate official domain
   */
  isValidOfficialUrl(urlStr?: string): boolean {
    if (!urlStr || typeof urlStr !== "string") return false;
    const cleanUrl = urlStr.trim().toLowerCase();

    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      return false;
    }

    for (const disallowed of THIRD_PARTY_DISALLOWLIST) {
      if (cleanUrl.includes(disallowed)) {
        return false;
      }
    }

    try {
      const parsed = new URL(cleanUrl);
      const hostname = parsed.hostname.toLowerCase();

      for (const allowed of OFFICIAL_DOMAIN_ALLOWLIST) {
        if (hostname === allowed || hostname.endsWith("." + allowed) || hostname.endsWith(allowed)) {
          return true;
        }
      }

      if (
        hostname.endsWith(".gov.in") ||
        hostname.endsWith(".nic.in") ||
        hostname.endsWith(".ac.in") ||
        hostname.endsWith(".edu") ||
        hostname.endsWith(".edu.in") ||
        hostname.endsWith(".org.in")
      ) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  },

  /**
   * Validates if a URL belongs to an authorized partner platform (e.g., Unstop)
   */
  isPartnerUrl(urlStr?: string): boolean {
    if (!urlStr || typeof urlStr !== "string") return false;
    const cleanUrl = urlStr.trim().toLowerCase();

    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      return false;
    }

    try {
      const parsed = new URL(cleanUrl);
      const hostname = parsed.hostname.toLowerCase();

      for (const partner of PARTNER_DOMAIN_ALLOWLIST) {
        if (hostname === partner || hostname.endsWith("." + partner)) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  },

  /**
   * Validates if a URL is an allowed official or partner source URL
   */
  isValidSourceUrl(urlStr?: string): boolean {
    return this.isValidOfficialUrl(urlStr) || this.isPartnerUrl(urlStr);
  },

  /**
   * Validates official Rules / Notification PDF URL
   */
  isValidPdfUrl(urlStr?: string): boolean {
    if (!urlStr || typeof urlStr !== "string") return false;
    const cleanUrl = urlStr.trim().toLowerCase();
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) return false;
    return this.isValidSourceUrl(cleanUrl);
  },

  /**
   * Conflict Resolution Engine
   * Enforces Source Priority:
   * 1. Official Organization Website
   * 2. Official Registration Portal
   * 3. Official Notification / Rules PDF
   * 4. Authorized Partner Platform (Unstop)
   * 5. Other Reputable Platforms
   *
   * If sources disagree, official source always wins and discrepancy is recorded.
   */
  compareAndResolveSources(
    officialData?: { deadline?: string; url?: string },
    partnerData?: { deadline?: string; url?: string }
  ): SourceComparisonResult {
    // Both sources exist
    if (officialData?.deadline && partnerData?.deadline) {
      const hasConflict = officialData.deadline !== partnerData.deadline;
      return {
        hasConflict,
        resolvedDeadline: officialData.deadline, // Official source wins!
        sourceType: "official",
        officialDeadline: officialData.deadline,
        partnerDeadline: partnerData.deadline,
        resolutionNote: hasConflict
          ? `Conflict resolved: Official source deadline (${officialData.deadline}) prioritized over partner platform deadline (${partnerData.deadline}).`
          : "Official and partner platform deadlines are in agreement.",
        verificationStatus: "verified",
      };
    }

    // Official only
    if (officialData?.deadline) {
      return {
        hasConflict: false,
        resolvedDeadline: officialData.deadline,
        sourceType: "official",
        officialDeadline: officialData.deadline,
        resolutionNote: "Verified directly from official organization website.",
        verificationStatus: "verified",
      };
    }

    // Partner only (e.g. Unstop-hosted competition)
    if (partnerData?.deadline) {
      return {
        hasConflict: false,
        resolvedDeadline: partnerData.deadline,
        sourceType: "partner",
        partnerDeadline: partnerData.deadline,
        resolutionNote: "Verified from authorized partner platform (Unstop).",
        verificationStatus: "partner_verified",
      };
    }

    return {
      hasConflict: false,
      resolvedDeadline: "",
      sourceType: "aggregator",
      resolutionNote: "No verified deadline available across sources.",
      verificationStatus: "pending",
    };
  },

  /**
   * Validates an application URL if provided
   */
  isValidApplicationUrl(urlStr?: string): boolean {
    if (!urlStr) return true;
    return this.isValidOfficialUrl(urlStr);
  },

  /**
   * Strictly validates a deadline string without inferring or guessing.
   */
  validateExplicitDeadline(
    deadlineStr?: string,
    referenceDate?: Date
  ): { valid: boolean; isExpired: boolean; dateIso?: string; reason?: string } {
    if (!deadlineStr || typeof deadlineStr !== "string" || deadlineStr.trim() === "") {
      return { valid: false, isExpired: false, reason: "Deadline missing or empty" };
    }

    const trimmed = deadlineStr.trim();
    if (
      trimmed.toLowerCase() === "rolling" ||
      trimmed.toLowerCase() === "open" ||
      trimmed.toLowerCase() === "tba" ||
      trimmed.toLowerCase() === "tbd" ||
      trimmed.toLowerCase() === "unknown"
    ) {
      return { valid: false, isExpired: false, reason: "Deadline is ambiguous or open-ended" };
    }

    const parsedDate = new Date(trimmed);
    if (isNaN(parsedDate.getTime())) {
      return { valid: false, isExpired: false, reason: "Invalid date format" };
    }

    const ref = referenceDate instanceof Date ? referenceDate : new Date();
    const refUTC = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate());
    const deadUTC = Date.UTC(
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth(),
      parsedDate.getUTCDate()
    );

    const isExpired = deadUTC < refUTC;
    const dateIso = parsedDate.toISOString().split("T")[0];

    return { valid: true, isExpired, dateIso };
  },

  /**
   * Performs an actual HTTP/HTTPS network fetch to the official URL
   */
  async fetchOfficialSource(
    url: string,
    timeoutMs: number = 8000
  ): Promise<{ success: boolean; status: number; html?: string; error?: string }> {
    if (!this.isValidOfficialUrl(url)) {
      return { success: false, status: 400, error: "URL does not belong to a valid official domain" };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "OpportuneOfficialVerifier/2.0 (+https://opportune.app; Official Verification Engine)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          error: `Official webpage responded with HTTP status ${response.status} (${response.statusText})`,
        };
      }

      const html = await response.text();
      return { success: true, status: response.status, html };
    } catch (err: any) {
      const errMsg = err.name === "AbortError" ? "Network request timed out connecting to official server" : err.message || "Network error";
      return { success: false, status: 0, error: errMsg };
    }
  },

  /**
   * Parses official webpage HTML content to extract explicit title, deadline, and application links
   */
  extractOpportunityFromHtml(
    html: string,
    baseUrl: string
  ): { title?: string; deadline?: string; applyUrl?: string } {
    if (!html || typeof html !== "string") return {};

    // 1. Extract Title
    let title: string | undefined;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].replace(/\s+/g, " ").trim();
    } else {
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match && h1Match[1]) {
        title = h1Match[1].replace(/\s+/g, " ").trim();
      }
    }

    // 2. Extract Clean Text for structured pattern matching
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");

    let deadline: string | undefined;
    const deadlinePatterns = [
      /(?:last date(?: for (?:online )?submission| for registration| for application)?|closing date|registration closes|application deadline|deadline)[:\s]+([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
      /(?:last date(?: for (?:online )?submission| for registration| for application)?|closing date|registration closes|application deadline|deadline)[:\s]+([0-9]{1,2}[-\/.][0-9]{1,2}[-\/.][0-9]{4})/i,
      /(?:last date(?: for (?:online )?submission| for registration| for application)?|closing date|registration closes|application deadline|deadline)[:\s]+([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+[0-9]{4})/i,
      /(?:last date(?: for (?:online )?submission| for registration| for application)?|closing date|registration closes|application deadline|deadline)[:\s]+([A-Za-z]+\s+[0-9]{1,2},?\s+[0-9]{4})/i,
      /itemprop=["']validThrough["'][^>]*content=["']([^"']+)["']/i,
    ];

    // Search clean text content
    for (const pattern of deadlinePatterns) {
      const match = cleanText.match(pattern);
      if (match && match[1]) {
        const rawDate = match[1].trim().replace(/(st|nd|rd|th),?/i, "");
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) {
          deadline = parsed.toISOString().split("T")[0];
          break;
        }
      }
    }

    // If not found in clean text, check raw HTML attributes
    if (!deadline) {
      for (const pattern of deadlinePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          const rawDate = match[1].trim().replace(/(st|nd|rd|th),?/i, "");
          const parsed = new Date(rawDate);
          if (!isNaN(parsed.getTime())) {
            deadline = parsed.toISOString().split("T")[0];
            break;
          }
        }
      }
    }

    // 3. Extract Application Link
    let applyUrl: string | undefined;
    const applyMatch = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>(?:apply online|register now|click here to apply|apply|registration portal)<\/a>/i);
    if (applyMatch && applyMatch[1]) {
      const rawHref = applyMatch[1].trim();
      if (rawHref.startsWith("http://") || rawHref.startsWith("https://")) {
        applyUrl = rawHref;
      } else if (rawHref.startsWith("/")) {
        try {
          const base = new URL(baseUrl);
          applyUrl = `${base.protocol}//${base.host}${rawHref}`;
        } catch {}
      }
    }

    return { title, deadline, applyUrl };
  },

  /**
   * Real Server-Side Live Webpage Verification
   * 1. Fetches official webpage via HTTP
   * 2. Parses HTML and extracts explicit official deadline
   * 3. Compares extracted deadline against stored database deadline
   * 4. Enforces failure when stored deadline differs or official page is down/404
   */
  async verifyOfficialWebpage(
    opportunity: Opportunity,
    referenceDate?: Date
  ): Promise<LiveVerificationResult> {
    const nowIso = (referenceDate || new Date()).toISOString().split("T")[0];

    // 1. Validate Official Domain Allowlist
    const domainValid = this.isValidOfficialUrl(opportunity.officialUrl);
    if (!domainValid) {
      return {
        verified: false,
        httpStatus: 0,
        fetchedSuccessfully: false,
        officialUrl: opportunity.officialUrl,
        storedDeadline: opportunity.deadline,
        deadlineMatches: false,
        isExpired: false,
        lastVerifiedAt: nowIso,
        domainValid: false,
        reason: `Official URL [${opportunity.officialUrl}] is not from an approved official publisher domain.`,
      };
    }

    // 2. Perform live HTTP Request
    const fetchResult = await this.fetchOfficialSource(opportunity.officialUrl);
    if (!fetchResult.success || !fetchResult.html) {
      return {
        verified: false,
        httpStatus: fetchResult.status,
        fetchedSuccessfully: false,
        officialUrl: opportunity.officialUrl,
        storedDeadline: opportunity.deadline,
        deadlineMatches: false,
        isExpired: false,
        lastVerifiedAt: nowIso,
        domainValid: true,
        reason: `Official source could not be fetched: ${fetchResult.error}`,
      };
    }

    // 3. Parse HTML and Extract Fields
    const extracted = this.extractOpportunityFromHtml(fetchResult.html, opportunity.officialUrl);

    // 4. Compare Extracted Deadline with Stored Database Deadline
    const deadlineMatches = Boolean(
      extracted.deadline &&
      extracted.deadline === opportunity.deadline
    );

    // If official source has an explicit deadline and stored deadline differs
    if (extracted.deadline && extracted.deadline !== opportunity.deadline) {
      return {
        verified: false,
        httpStatus: fetchResult.status,
        fetchedSuccessfully: true,
        officialUrl: opportunity.officialUrl,
        extractedTitle: extracted.title,
        extractedDeadline: extracted.deadline,
        extractedApplyUrl: extracted.applyUrl,
        storedDeadline: opportunity.deadline,
        deadlineMatches: false,
        isExpired: false,
        lastVerifiedAt: nowIso,
        domainValid: true,
        reason: `Stored deadline [${opportunity.deadline}] conflicts with extracted official deadline [${extracted.deadline}].`,
      };
    }

    // Check if deadline is active or expired
    const deadlineValidation = this.validateExplicitDeadline(
      extracted.deadline || opportunity.deadline,
      referenceDate
    );

    return {
      verified: deadlineValidation.valid,
      httpStatus: fetchResult.status,
      fetchedSuccessfully: true,
      officialUrl: opportunity.officialUrl,
      extractedTitle: extracted.title,
      extractedDeadline: extracted.deadline,
      extractedApplyUrl: extracted.applyUrl,
      storedDeadline: opportunity.deadline,
      deadlineMatches: deadlineMatches || deadlineValidation.valid,
      isExpired: deadlineValidation.isExpired,
      lastVerifiedAt: nowIso,
      domainValid: true,
      reason: deadlineValidation.valid ? undefined : deadlineValidation.reason,
    };
  },

  /**
   * Synchronous verification check (for feed and query filtering)
   */
  verifyOpportunity(opportunity: Opportunity, referenceDate?: Date): VerificationResult {
    const isOfficial = this.isValidOfficialUrl(opportunity.officialUrl);
    const isPartner = this.isPartnerUrl(opportunity.officialUrl) || (opportunity.sourceUrl ? this.isPartnerUrl(opportunity.sourceUrl) : false);

    if (!isOfficial && !isPartner) {
      return {
        verified: false,
        domainValid: false,
        reason: `Source URL [${opportunity.officialUrl || "empty"}] is not from an approved official publisher or authorized partner domain.`,
      };
    }

    if (opportunity.applyUrl && !this.isValidApplicationUrl(opportunity.applyUrl) && !this.isPartnerUrl(opportunity.applyUrl)) {
      return {
        verified: false,
        domainValid: false,
        reason: `Application URL [${opportunity.applyUrl}] does not belong to a verified official portal or authorized platform.`,
      };
    }

    if (opportunity.rulesPdfUrl && !this.isValidPdfUrl(opportunity.rulesPdfUrl)) {
      return {
        verified: false,
        domainValid: false,
        reason: `Rules PDF URL [${opportunity.rulesPdfUrl}] does not belong to an approved official or authorized source.`,
      };
    }

    const deadlineValidation = this.validateExplicitDeadline(opportunity.deadline, referenceDate);
    if (!deadlineValidation.valid) {
      return {
        verified: false,
        domainValid: true,
        reason: deadlineValidation.reason || "Explicit deadline could not be verified on official source.",
      };
    }

    const statusRes = getOpportunityStatus(opportunity, referenceDate);
    if (statusRes.isExpired || deadlineValidation.isExpired) {
      return {
        verified: true,
        isExpired: true,
        domainValid: true,
        officialUrl: opportunity.officialUrl,
        applyUrl: opportunity.applyUrl,
        rulesPdfUrl: opportunity.rulesPdfUrl,
        sourceName: opportunity.sourceName,
        sourceType: isOfficial ? "official" : "partner",
        deadline: deadlineValidation.dateIso,
        verifiedAt: opportunity.lastVerified || new Date().toISOString().split("T")[0],
        reason: "Opportunity deadline has passed. Marked as expired.",
      };
    }

    if (opportunity.verificationStatus === "failed" || opportunity.lifecycleStatus === "rejected") {
      return {
        verified: false,
        domainValid: true,
        reason: "Opportunity is marked as failed or rejected by human review.",
      };
    }

    return {
      verified: true,
      isExpired: false,
      domainValid: true,
      officialUrl: opportunity.officialUrl,
      applyUrl: opportunity.applyUrl,
      rulesPdfUrl: opportunity.rulesPdfUrl,
      sourceName: opportunity.sourceName,
      sourceType: isOfficial ? "official" : "partner",
      deadline: deadlineValidation.dateIso,
      verifiedAt: opportunity.lastVerified || new Date().toISOString().split("T")[0],
    };
  },

  /**
   * Re-verifies an existing opportunity against freshness rules
   */
  async reverifyOpportunity(opportunity: Opportunity, referenceDate?: Date): Promise<VerificationResult> {
    const result = this.verifyOpportunity(opportunity, referenceDate);
    return {
      ...result,
      verifiedAt: new Date().toISOString().split("T")[0],
    };
  },
};

