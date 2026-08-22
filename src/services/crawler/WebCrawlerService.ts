import * as cheerio from "cheerio";

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  timeoutMs?: number;
  rateLimitMs?: number;
  allowedDomains?: string[];
  sameDomainOnly?: boolean;
}

export interface CrawledPageResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  html?: string;
  title?: string;
  outboundLinks: { url: string; text: string }[];
  isBlockedOrRateLimited: boolean;
  error?: string;
}

export interface CrawlSessionReport {
  seedUrl: string;
  pagesFetched: number;
  pagesScraped: CrawledPageResult[];
  linksDiscovered: string[];
  rateLimitedCount: number;
  failuresCount: number;
}

export class WebCrawlerService {
  private domainLastFetchTime: Map<string, number> = new Map();

  /**
   * Safe, production-compliant web crawler.
   * Performs real HTTP fetching, Cheerio HTML parsing, pagination following, and rate-limiting.
   */
  async crawlUrl(url: string, options: CrawlOptions = {}): Promise<CrawledPageResult> {
    const timeoutMs = options.timeoutMs || 8000;
    const rateLimitMs = options.rateLimitMs || 1000;
    
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return {
        url,
        finalUrl: url,
        statusCode: 0,
        outboundLinks: [],
        isBlockedOrRateLimited: false,
        error: "Invalid URL syntax",
      };
    }

    const domain = targetUrl.hostname.toLowerCase();

    // Domain rate limiting
    const lastFetch = this.domainLastFetchTime.get(domain) || 0;
    const elapsed = Date.now() - lastFetch;
    if (elapsed < rateLimitMs) {
      await new Promise((r) => setTimeout(r, rateLimitMs - elapsed));
    }
    this.domainLastFetchTime.set(domain, Date.now());

    // Execute HTTP Fetch with retry
    let response: Response | null = null;
    let retries = 2;

    while (retries >= 0) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        response = await fetch(url, {
          headers: {
            "User-Agent":
              "OpportuneVerificationBot/1.0 (+https://opportune.student/bot; public opportunity aggregator verification)",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          signal: controller.signal,
          redirect: "follow",
        });

        clearTimeout(timer);
        if (response.ok || response.status === 403 || response.status === 429) {
          break;
        }
      } catch (err: any) {
        if (retries === 0) {
          return {
            url,
            finalUrl: url,
            statusCode: 0,
            outboundLinks: [],
            isBlockedOrRateLimited: false,
            error: err?.message || "Network request failed",
          };
        }
        await new Promise((r) => setTimeout(r, 500 * (3 - retries)));
      }
      retries--;
    }

    if (!response) {
      return {
        url,
        finalUrl: url,
        statusCode: 0,
        outboundLinks: [],
        isBlockedOrRateLimited: false,
        error: "No response received",
      };
    }

    const statusCode = response.status;
    const finalUrl = response.url || url;

    // Detect CAPTCHA, rate-limit (429), access forbidden (403), or login wall
    if (statusCode === 429 || statusCode === 403) {
      return {
        url,
        finalUrl,
        statusCode,
        outboundLinks: [],
        isBlockedOrRateLimited: true,
        error: `HTTP ${statusCode}: Access blocked or rate-limited by remote host`,
      };
    }

    let html = "";
    try {
      html = await response.text();
    } catch (err: any) {
      return {
        url,
        finalUrl,
        statusCode,
        outboundLinks: [],
        isBlockedOrRateLimited: false,
        error: "Failed to read response HTML text",
      };
    }

    // Check for common CAPTCHA / Bot blocker markers in HTML
    if (
      html.includes("g-recaptcha") ||
      html.includes("cf-turnstile") ||
      html.includes("Please enable JavaScript") ||
      html.includes("Access Denied") ||
      html.includes("Checking your browser")
    ) {
      return {
        url,
        finalUrl,
        statusCode,
        html,
        outboundLinks: [],
        isBlockedOrRateLimited: true,
        error: "Cloudflare/CAPTCHA wall detected. Access restricted.",
      };
    }

    // Parse HTML with Cheerio
    const $ = cheerio.load(html);
    const title = $("title").text().trim() || $("h1").first().text().trim() || "";
    const outboundLinks: { url: string; text: string }[] = [];
    const seenLinks = new Set<string>();

    const allowedDomains = options.allowedDomains || [domain];
    const sameDomainOnly = options.sameDomainOnly !== false;

    $("a[href]").each((_, el) => {
      const rawHref = $(el).attr("href")?.trim();
      const text = $(el).text().trim();

      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("javascript:") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:")
      ) {
        return;
      }

      try {
        const resolved = new URL(rawHref, finalUrl);
        if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
          return;
        }

        const linkHost = resolved.hostname.toLowerCase();
        if (sameDomainOnly) {
          const isAllowed = allowedDomains.some(
            (d) => linkHost === d || linkHost.endsWith(`.${d}`)
          );
          if (!isAllowed) return;
        }

        const cleanUrl = resolved.origin + resolved.pathname + resolved.search;
        if (!seenLinks.has(cleanUrl) && cleanUrl !== finalUrl) {
          seenLinks.add(cleanUrl);
          outboundLinks.push({ url: cleanUrl, text });
        }
      } catch {
        // Syntax error in URL ignored
      }
    });

    return {
      url,
      finalUrl,
      statusCode,
      html,
      title,
      outboundLinks,
      isBlockedOrRateLimited: false,
    };
  }

  /**
   * Crawls a seed listing page and follows pagination + detail page links up to maxPages.
   */
  async crawlListingAndDetailPages(
    seedUrl: string,
    options: CrawlOptions = {}
  ): Promise<CrawlSessionReport> {
    const maxPages = options.maxPages || 5;
    const report: CrawlSessionReport = {
      seedUrl,
      pagesFetched: 0,
      pagesScraped: [],
      linksDiscovered: [],
      rateLimitedCount: 0,
      failuresCount: 0,
    };

    const queue: string[] = [seedUrl];
    const visited = new Set<string>();

    while (queue.length > 0 && report.pagesFetched < maxPages) {
      const currentUrl = queue.shift()!;
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      const result = await this.crawlUrl(currentUrl, options);
      report.pagesFetched++;
      report.pagesScraped.push(result);

      if (result.isBlockedOrRateLimited) {
        report.rateLimitedCount++;
      } else if (result.error) {
        report.failuresCount++;
      } else if (result.outboundLinks) {
        for (const link of result.outboundLinks) {
          if (!visited.has(link.url) && !report.linksDiscovered.includes(link.url)) {
            report.linksDiscovered.push(link.url);

            // Queue detail pages and pagination links
            if (
              link.url.includes("/opportunity/") ||
              link.url.includes("/hackathon") ||
              link.url.includes("/scholarship") ||
              link.url.includes("page=") ||
              link.url.includes("/challenges/")
            ) {
              queue.push(link.url);
            }
          }
        }
      }
    }

    return report;
  }
}

export const webCrawlerService = new WebCrawlerService();
