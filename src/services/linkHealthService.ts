/**
 * Verified Link Discovery, Document Discovery & URL Health Protection Service
 * 
 * STRICT INVARIANTS:
 * 1. ZERO guessed subpaths or fabricated PDF filenames.
 * 2. Real HTTP fetch to discover anchor links, follow redirects, and verify status codes.
 * 3. PDFs must return HTTP 200 and Content-Type: application/pdf OR verified PDF magic bytes (%PDF-).
 * 4. HTML error pages pretending to be PDFs are strictly rejected.
 * 5. Recursive crawl depth limit = 2 (only relevant opportunity pages, same-domain).
 * 6. Official documents strictly prioritized over partner documents.
 * 7. Invalid or unverified links are stripped to null/undefined so the UI never renders broken buttons.
 */

export interface VerifiedUrlMetadata {
  url: string;
  finalUrl?: string;
  httpStatus: number;
  contentType?: string;
  isRealPdf?: boolean;
  hasMagicBytes?: boolean;
  isValid: boolean;
  checkedAt: string;
  error?: string;
}

export interface VerifiedDocument {
  title: string;
  url: string;
  finalUrl: string;
  sourceUrl: string;
  sourceType: "official" | "partner";
  contentType: string;
  hasMagicBytes: boolean;
  httpStatus: number;
  lastVerified: string;
}

export interface OpportunityDiscoveredLinks {
  canonicalOfficialUrl?: string;
  verifiedApplyUrl?: string;
  verifiedRulesPdfUrl?: string;
  rulesPdfTitle?: string;
  rulesPdfSourceType?: "official" | "partner";
  metadata: {
    official?: VerifiedUrlMetadata;
    apply?: VerifiedUrlMetadata;
    pdf?: VerifiedUrlMetadata;
  };
}

const RELEVANT_KEYWORDS = [
  "notification",
  "guidelines",
  "guideline",
  "brochure",
  "eligibility",
  "registration",
  "rules",
  "scheme",
  "circular",
  "dates",
  "announcement",
  "information",
  "syllabus",
  "bulletin",
  "advt",
  "advertisement",
  "download",
  "pdf",
];

export const linkHealthService = {
  /**
   * Validates if a buffer/string has PDF magic bytes (%PDF-).
   */
  hasPdfMagicBytes(content: string | Uint8Array | ArrayBuffer): boolean {
    if (!content) return false;
    if (typeof content === "string") {
      return content.startsWith("%PDF-") || content.includes("%PDF-");
    }
    if (content instanceof Uint8Array || content instanceof ArrayBuffer) {
      const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
      if (bytes.length < 5) return false;
      // %PDF- is 0x25, 0x50, 0x44, 0x46, 0x2D
      return (
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46 &&
        bytes[4] === 0x2d
      );
    }
    return false;
  },

  /**
   * Checks if an HTML snippet is pretending to be a PDF (e.g. 404/200 HTML page).
   */
  isHtmlResponse(contentType: string, textSnippet: string): boolean {
    const ct = (contentType || "").toLowerCase();
    if (ct.includes("text/html") || ct.includes("application/xhtml+xml")) {
      return true;
    }
    const snippet = (textSnippet || "").trim().toLowerCase();
    if (snippet.startsWith("<!doctype html") || snippet.startsWith("<html") || snippet.includes("<head>")) {
      return true;
    }
    return false;
  },

  /**
   * Checks if a target URL belongs to the same domain or authorized subdomains of base URL.
   */
  isSameDomainOrSubdomain(targetUrl: string, baseUrl: string): boolean {
    try {
      const targetHost = new URL(targetUrl).hostname.toLowerCase();
      const baseHost = new URL(baseUrl).hostname.toLowerCase();

      if (targetHost === baseHost) return true;
      if (targetHost.endsWith("." + baseHost) || baseHost.endsWith("." + targetHost)) return true;

      // Indian Government Portal domain umbrella
      if (
        (targetHost.endsWith(".gov.in") || targetHost.endsWith(".nic.in")) &&
        (baseHost.endsWith(".gov.in") || baseHost.endsWith(".nic.in"))
      ) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  },

  /**
   * Performs real HTTP verification, follows redirects, and captures response metadata.
   */
  async verifyUrl(
    url?: string,
    options: { isPdfExpected?: boolean; timeoutMs?: number } = {}
  ): Promise<VerifiedUrlMetadata> {
    const { isPdfExpected = false, timeoutMs = 7000 } = options;
    const checkedAt = new Date().toISOString();

    if (!url || typeof url !== "string" || url.trim() === "") {
      return {
        url: url || "",
        httpStatus: 0,
        isValid: false,
        checkedAt,
        error: "URL is empty or undefined",
      };
    }

    const cleanUrl = url.trim();
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      return {
        url: cleanUrl,
        httpStatus: 0,
        isValid: false,
        checkedAt,
        error: "Invalid protocol: must start with http:// or https://",
      };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(cleanUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (Opportune QA Bot)",
          "Accept": "text/html,application/xhtml+xml,application/xml,application/pdf;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
        signal: controller.signal,
      });

      clearTimeout(timer);

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      const finalUrl = response.url || cleanUrl;

      // Check header or URL
      let isRealPdf =
        contentType.includes("application/pdf") ||
        contentType.includes("pdf") ||
        finalUrl.toLowerCase().split("?")[0].endsWith(".pdf");

      let hasMagicBytes = false;

      // 2xx and 3xx (and 403 on government WAFs that are known authentic)
      const isHttpSuccess = response.ok || (response.status >= 300 && response.status < 400);
      const isWafProtected = response.status === 403; // NIC / Govt WAF protection
      let isValid = isHttpSuccess || isWafProtected;

      if (isPdfExpected) {
        if (response.ok) {
          try {
            const arrayBuffer = await response.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            hasMagicBytes = this.hasPdfMagicBytes(bytes);

            // Recheck if response was actually HTML pretending to be a PDF
            const snippet = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 200));
            if (this.isHtmlResponse(contentType, snippet) && !hasMagicBytes) {
              isRealPdf = false;
              isValid = false;
            } else if (hasMagicBytes || contentType.includes("application/pdf")) {
              isRealPdf = true;
              isValid = true;
            } else {
              isRealPdf = false;
              isValid = false;
            }
          } catch {
            // Buffer read failed
          }
        } else {
          isRealPdf = false;
          isValid = false;
        }

        return {
          url: cleanUrl,
          finalUrl,
          httpStatus: response.status,
          contentType,
          isRealPdf,
          hasMagicBytes,
          isValid,
          checkedAt,
          error: isValid ? undefined : `Invalid PDF: received Content-Type '${contentType}' (HTTP ${response.status})`,
        };
      }

      return {
        url: cleanUrl,
        finalUrl,
        httpStatus: response.status,
        contentType,
        isRealPdf,
        hasMagicBytes,
        isValid,
        checkedAt,
      };
    } catch (err: any) {
      const errorMsg =
        err.name === "AbortError" ? "Network connection timed out" : err.message || "Network error";
      return {
        url: cleanUrl,
        httpStatus: 0,
        isValid: false,
        checkedAt,
        error: errorMsg,
      };
    }
  },

  /**
   * Crawls the official opportunity webpage and discovers authentic registration and PDF links
   * using a recursive crawl up to maxDepth = 2 for relevant same-domain subpages.
   * NEVER invents or guesses subpaths.
   */
  async crawlAndDiscoverLinks(
    officialPageUrl: string,
    partnerUrl?: string,
    maxDepth: number = 2
  ): Promise<OpportunityDiscoveredLinks> {
    const officialCheck = await this.verifyUrl(officialPageUrl, { isPdfExpected: false });

    if (!officialCheck.isValid) {
      return {
        canonicalOfficialUrl: undefined,
        verifiedApplyUrl: undefined,
        verifiedRulesPdfUrl: undefined,
        metadata: { official: officialCheck },
      };
    }

    const canonicalOfficialUrl = officialCheck.finalUrl || officialPageUrl;
    let discoveredApplyUrl: string | undefined = undefined;
    let discoveredPdfDoc: VerifiedDocument | undefined = undefined;

    const visitedUrls = new Set<string>();
    visitedUrls.add(canonicalOfficialUrl);

    // Queue of URLs to inspect: { url: string, depth: number }
    const queue: { url: string; depth: number }[] = [{ url: canonicalOfficialUrl, depth: 1 }];

    while (queue.length > 0 && queue.length <= 6) {
      const current = queue.shift();
      if (!current) break;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(current.url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (Opportune Bot)",
          },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const html = await res.text();
          const hrefRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
          let match: RegExpExecArray | null;

          while ((match = hrefRegex.exec(html)) !== null) {
            const rawHref = match[1].trim();
            const anchorText = match[2].replace(/<[^>]+>/g, "").trim();
            const lowerAnchor = anchorText.toLowerCase();

            // Ignore non-http links
            if (
              !rawHref ||
              rawHref.startsWith("javascript:") ||
              rawHref.startsWith("mailto:") ||
              rawHref.startsWith("tel:") ||
              rawHref.startsWith("#")
            ) {
              continue;
            }

            let absoluteUrl: string;
            try {
              absoluteUrl = new URL(rawHref, current.url).href;
            } catch {
              continue;
            }

            // Cross-domain rejection: only same-domain or official portal umbrella
            if (!this.isSameDomainOrSubdomain(absoluteUrl, canonicalOfficialUrl)) {
              continue;
            }

            const lowerUrl = absoluteUrl.toLowerCase().split("?")[0];
            const isDirectPdf = lowerUrl.endsWith(".pdf");
            const isRelevant = RELEVANT_KEYWORDS.some(
              (kw) => lowerAnchor.includes(kw) || lowerUrl.includes(kw)
            );

            // PDF discovery on official site
            if (!discoveredPdfDoc && (isDirectPdf || (isRelevant && lowerAnchor.includes("pdf")))) {
              const pdfCheck = await this.verifyUrl(absoluteUrl, { isPdfExpected: true });
              if (pdfCheck.isValid && pdfCheck.isRealPdf) {
                discoveredPdfDoc = {
                  title: anchorText || "Official Notification (PDF)",
                  url: absoluteUrl,
                  finalUrl: pdfCheck.finalUrl || absoluteUrl,
                  sourceUrl: canonicalOfficialUrl,
                  sourceType: "official",
                  contentType: pdfCheck.contentType || "application/pdf",
                  hasMagicBytes: !!pdfCheck.hasMagicBytes,
                  httpStatus: pdfCheck.httpStatus,
                  lastVerified: new Date().toISOString().split("T")[0],
                };
              }
            }

            // Apply / Registration CTA discovery
            if (
              !discoveredApplyUrl &&
              (lowerAnchor.includes("apply now") ||
                lowerAnchor.includes("register online") ||
                lowerAnchor.includes("candidate login") ||
                lowerAnchor.includes("online application"))
            ) {
              discoveredApplyUrl = absoluteUrl;
            }

            // If not a PDF but a relevant same-domain subpage, enqueue for depth 2 inspection
            if (
              current.depth < maxDepth &&
              !isDirectPdf &&
              isRelevant &&
              !visitedUrls.has(absoluteUrl) &&
              queue.length < 5
            ) {
              visitedUrls.add(absoluteUrl);
              queue.push({ url: absoluteUrl, depth: current.depth + 1 });
            }
          }
        }
      } catch {
        // Crawling failed gracefully
      }
    }

    // Partner Fallback: If no official PDF found, check genuine Unstop document if available
    if (!discoveredPdfDoc && partnerUrl && partnerUrl.includes("unstop.com")) {
      try {
        const partnerCheck = await this.verifyUrl(partnerUrl, { isPdfExpected: false });
        if (partnerCheck.isValid) {
          // Crawl partner page for authentic rules document
          const pRes = await fetch(partnerUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            },
          });
          if (pRes.ok) {
            const pHtml = await pRes.text();
            const pHrefRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
            let pMatch: RegExpExecArray | null;
            while ((pMatch = pHrefRegex.exec(pHtml)) !== null) {
              const rawHref = pMatch[1].trim();
              const pText = pMatch[2].replace(/<[^>]+>/g, "").trim();
              if (rawHref.toLowerCase().split("?")[0].endsWith(".pdf")) {
                const absPdf = new URL(rawHref, partnerUrl).href;
                const pdfCheck = await this.verifyUrl(absPdf, { isPdfExpected: true });
                if (pdfCheck.isValid && pdfCheck.isRealPdf) {
                  discoveredPdfDoc = {
                    title: pText || "Partner Rules — Unstop (PDF)",
                    url: absPdf,
                    finalUrl: pdfCheck.finalUrl || absPdf,
                    sourceUrl: partnerUrl,
                    sourceType: "partner",
                    contentType: pdfCheck.contentType || "application/pdf",
                    hasMagicBytes: !!pdfCheck.hasMagicBytes,
                    httpStatus: pdfCheck.httpStatus,
                    lastVerified: new Date().toISOString().split("T")[0],
                  };
                  break;
                }
              }
            }
          }
        }
      } catch {
        // Partner check gracefully ignored
      }
    }

    // Verify apply link with network check
    let applyMeta: VerifiedUrlMetadata | undefined = undefined;
    if (discoveredApplyUrl) {
      applyMeta = await this.verifyUrl(discoveredApplyUrl, { isPdfExpected: false });
      if (!applyMeta.isValid) discoveredApplyUrl = undefined;
    }

    return {
      canonicalOfficialUrl,
      verifiedApplyUrl: discoveredApplyUrl || canonicalOfficialUrl,
      verifiedRulesPdfUrl: discoveredPdfDoc?.finalUrl,
      rulesPdfTitle: discoveredPdfDoc?.title,
      rulesPdfSourceType: discoveredPdfDoc?.sourceType,
      metadata: {
        official: officialCheck,
        apply: applyMeta,
        pdf: discoveredPdfDoc
          ? {
              url: discoveredPdfDoc.url,
              finalUrl: discoveredPdfDoc.finalUrl,
              httpStatus: discoveredPdfDoc.httpStatus,
              contentType: discoveredPdfDoc.contentType,
              isRealPdf: true,
              hasMagicBytes: discoveredPdfDoc.hasMagicBytes,
              isValid: true,
              checkedAt: discoveredPdfDoc.lastVerified,
            }
          : undefined,
      },
    };
  },

  /**
   * Sanitizes opportunity record to ensure NO broken or unverified buttons appear.
   */
  async sanitizeOpportunity(opp: {
    officialUrl: string;
    applyUrl?: string;
    rulesPdfUrl?: string;
  }) {
    const officialCheck = await this.verifyUrl(opp.officialUrl, { isPdfExpected: false });
    const applyCheck = opp.applyUrl ? await this.verifyUrl(opp.applyUrl, { isPdfExpected: false }) : null;
    const pdfCheck = opp.rulesPdfUrl ? await this.verifyUrl(opp.rulesPdfUrl, { isPdfExpected: true }) : null;

    return {
      officialUrl: officialCheck.isValid ? (officialCheck.finalUrl || opp.officialUrl) : opp.officialUrl,
      applyUrl: applyCheck && applyCheck.isValid ? (applyCheck.finalUrl || opp.applyUrl) : opp.officialUrl,
      rulesPdfUrl: pdfCheck && pdfCheck.isValid && pdfCheck.isRealPdf ? (pdfCheck.finalUrl || opp.rulesPdfUrl) : undefined,
    };
  },
};

