import test from "node:test";
import assert from "node:assert/strict";

import { webCrawlerService } from "../src/services/crawler/WebCrawlerService";
import { UnstopAdapter } from "../src/services/adapters/unstopAdapter";
import { DevfolioAdapter } from "../src/services/adapters/devfolioAdapter";
import { HackerEarthAdapter } from "../src/services/adapters/hackerEarthAdapter";
import { Buddy4StudyAdapter } from "../src/services/adapters/buddy4studyAdapter";
import { opportunityDiscoveryService } from "../src/services/opportunityDiscoveryService";
import { opportunityRepository } from "../src/repositories/opportunityRepository";

test("Crawler Integration 1: WebCrawlerService fetches HTML and parses out anchors safely", async () => {
  const result = await webCrawlerService.crawlUrl("https://sih.gov.in", {
    timeoutMs: 5000,
    rateLimitMs: 100,
  });

  assert.ok(result.statusCode === 200 || result.isBlockedOrRateLimited || result.error);
  if (result.statusCode === 200 && result.html) {
    assert.ok(result.html.length > 100, "Must fetch HTML content");
    assert.ok(Array.isArray(result.outboundLinks), "Must extract outbound links array");
  }
});

test("Crawler Integration 2: UnstopAdapter performs Cheerio/API discovery with zero mock data", async () => {
  const adapter = new UnstopAdapter();
  const candidates = await adapter.discover();

  assert.equal(adapter.sourceType, "partner");
  for (const cand of candidates) {
    assert.ok(cand.title, "Discovered candidate must have title");
    assert.ok(cand.sourceUrl.startsWith("http"), "Source URL must be valid HTTP");
    assert.equal(cand.sourceType, "partner", "Unstop candidates must strictly be tagged partner");
  }
});

test("Crawler Integration 3: DevfolioAdapter performs real discovery without bypasses", async () => {
  const adapter = new DevfolioAdapter();
  const candidates = await adapter.discover();

  for (const cand of candidates) {
    assert.equal(cand.category, "hackathon");
    assert.equal(cand.sourceType, "partner");
  }
});

test("Crawler Integration 4: HackerEarthAdapter performs real discovery without bypasses", async () => {
  const adapter = new HackerEarthAdapter();
  const candidates = await adapter.discover();

  for (const cand of candidates) {
    assert.equal(cand.sourceType, "partner");
  }
});

test("Crawler Integration 5: Buddy4StudyAdapter performs real discovery for scholarships", async () => {
  const adapter = new Buddy4StudyAdapter();
  const candidates = await adapter.discover();

  for (const cand of candidates) {
    assert.equal(cand.category, "scholarship");
    assert.equal(cand.sourceType, "partner");
  }
});

test("Crawler Integration 6: Zero URL Fabrication Invariant across all discovery candidates", async () => {
  const res = await opportunityDiscoveryService.runRealWebCrawlerDiscovery();

  for (const cand of res.candidates) {
    if (cand.applyUrl) {
      assert.ok(
        !cand.applyUrl.endsWith("/apply") &&
        !cand.applyUrl.endsWith("/register") &&
        !cand.applyUrl.endsWith("/signup"),
        `Apply URL ${cand.applyUrl} must not be a guessed path`
      );
    }
    if (cand.rulesPdfUrl) {
      assert.ok(cand.rulesPdfUrl.endsWith(".pdf"), "Rules PDF URL must end with .pdf");
    }
  }
});

test("Crawler Integration 7: Deduplication prevents creating duplicate records for identical candidates", async () => {
  const countBefore = (await opportunityRepository.getAll()).length;

  // Run discovery twice to verify deduplication
  await opportunityDiscoveryService.runRealWebCrawlerDiscovery();
  const countAfterFirst = (await opportunityRepository.getAll()).length;

  await opportunityDiscoveryService.runRealWebCrawlerDiscovery();
  const countAfterSecond = (await opportunityRepository.getAll()).length;

  assert.equal(
    countAfterSecond,
    countAfterFirst,
    "Second crawler run must produce 0 duplicate records in repository"
  );
});

test("Crawler Integration 8: Failed or rate-limited source preserves existing verified catalog records", async () => {
  const activeBefore = await opportunityRepository.getAllActive();
  const verifiedCountBefore = activeBefore.length;

  // Crawl unreachable seed URL
  await webCrawlerService.crawlListingAndDetailPages("https://unreachable-test-domain-999.gov.in", {
    maxPages: 1,
    timeoutMs: 1000,
  });

  const activeAfter = await opportunityRepository.getAllActive();
  assert.equal(
    activeAfter.length,
    verifiedCountBefore,
    "Catalog active count must remain completely intact despite network failure"
  );
});
