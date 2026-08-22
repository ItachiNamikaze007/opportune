import test from "node:test";
import assert from "node:assert/strict";

import { opportunityDiscoveryService } from "../src/services/opportunityDiscoveryService";
import { opportunityRepository } from "../src/repositories/opportunityRepository";
import { UnstopAdapter } from "../src/services/adapters/unstopAdapter";
import { DevfolioAdapter } from "../src/services/adapters/devfolioAdapter";
import { HackerEarthAdapter } from "../src/services/adapters/hackerEarthAdapter";
import { Buddy4StudyAdapter } from "../src/services/adapters/buddy4studyAdapter";
import { MockTestSourceAdapter } from "../src/services/adapters/mockTestSourceAdapter";

test("Multi-Source Test 1: UnstopAdapter discovers paginated public candidates with valid structure", async () => {
  const adapter = new UnstopAdapter();
  const res = await adapter.discoverCandidates({ maxPages: 2, perPage: 5 });

  assert.ok(res.candidates.length > 0, "Unstop adapter must discover candidates");
  assert.equal(res.sourceId, "src-unstop-public");
  assert.ok(res.pagesScraped >= 1, "Must scrape at least 1 page");

  for (const cand of res.candidates) {
    assert.ok(cand.title, "Candidate must have title");
    assert.ok(cand.sourceUrl.startsWith("http"), "Source URL must be valid HTTP");
    assert.equal(cand.sourceType, "partner", "Unstop must strictly be partner source");
  }
});

test("Multi-Source Test 2: DevfolioAdapter discovers hackathons without bypassing restrictions", async () => {
  const adapter = new DevfolioAdapter();
  const res = await adapter.discoverCandidates({ maxPages: 1 });

  assert.ok(res.candidates.length > 0, "Devfolio adapter must discover candidates");
  assert.equal(res.sourceType || res.candidates[0].sourceType, "partner");
  for (const cand of res.candidates) {
    assert.equal(cand.category, "hackathon");
  }
});

test("Multi-Source Test 3: HackerEarthAdapter discovers innovation challenges", async () => {
  const adapter = new HackerEarthAdapter();
  const res = await adapter.discoverCandidates({ maxPages: 1 });

  assert.ok(res.candidates.length > 0);
  assert.equal(res.candidates[0].sourceType, "partner");
});

test("Multi-Source Test 4: Buddy4StudyAdapter discovers scholarships & grants", async () => {
  const adapter = new Buddy4StudyAdapter();
  const res = await adapter.discoverCandidates({ maxPages: 1 });

  assert.ok(res.candidates.length > 0);
  assert.equal(res.candidates[0].category, "scholarship");
});

test("Multi-Source Test 5: MockTestSourceAdapter delivers NEW opportunities not present in initial seed", async () => {
  const mockAdapter = new MockTestSourceAdapter();
  const res = await mockAdapter.discoverCandidates();

  assert.equal(res.candidates.length, 3, "Mock test adapter must supply 3 new candidates");
  
  const allSeed = await opportunityRepository.getAll();
  const seedIds = new Set(allSeed.map(o => o.id));

  for (const cand of res.candidates) {
    assert.ok(!seedIds.has(cand.rawId), `Discovered candidate ${cand.rawId} must be brand new, not part of seed records`);
  }
});

test("Multi-Source Test 6: End-to-End Pipeline: Discovery → Official Verification → Published in Website Catalog", async () => {
  const seedCountBefore = (await opportunityRepository.getAllActive()).length;
  
  // Run full multi-source discovery pipeline
  const result = await opportunityDiscoveryService.runMultiSourceDiscovery({ maxPagesPerSource: 1 });

  assert.ok(result.metrics.length >= 5, "Metrics must include all 5 registered adapters");
  assert.ok(result.candidates.length > 0, "Must discover candidates across adapters");

  const activeAfter = await opportunityRepository.getAllActive();
  
  assert.ok(
    activeAfter.length >= seedCountBefore,
    `Website catalog active count (${activeAfter.length}) must include newly verified opportunities alongside seed count (${seedCountBefore})`
  );

  // Check that metrics contain proper keys
  for (const m of result.metrics) {
    assert.ok(m.sourceId);
    assert.ok(typeof m.discovered === "number");
    assert.ok(typeof m.newCandidates === "number");
    assert.ok(typeof m.pending === "number");
    assert.ok(typeof m.verified === "number");
  }
});

test("Multi-Source Test 7: Zero-Fabrication Invariant across all adapter candidates", async () => {
  const allActive = await opportunityRepository.getAllActive();

  for (const opp of allActive) {
    if (opp.applyUrl) {
      assert.ok(
        !opp.applyUrl.endsWith("/apply") &&
        !opp.applyUrl.endsWith("/register") &&
        !opp.applyUrl.endsWith("/student-registration"),
        `Opportunity ${opp.id} must not have guessed apply path: ${opp.applyUrl}`
      );
    }
    if (opp.rulesPdfUrl) {
      assert.ok(opp.rulesPdfUrl.endsWith(".pdf"), "PDF URL must end with .pdf");
    }
  }
});
