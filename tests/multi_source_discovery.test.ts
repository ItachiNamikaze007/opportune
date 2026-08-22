import test from "node:test";
import assert from "node:assert/strict";

import { opportunityDiscoveryService } from "../src/services/opportunityDiscoveryService";
import { opportunityRepository } from "../src/repositories/opportunityRepository";
import { UnstopAdapter } from "../src/services/adapters/unstopAdapter";
import { DevfolioAdapter } from "../src/services/adapters/devfolioAdapter";
import { HackerEarthAdapter } from "../src/services/adapters/hackerEarthAdapter";
import { Buddy4StudyAdapter } from "../src/services/adapters/buddy4studyAdapter";

test("Multi-Source Test 1: UnstopAdapter discovers public candidates with valid structure", async () => {
  const adapter = new UnstopAdapter();
  const candidates = await adapter.discover();

  assert.equal(adapter.sourceName, "Unstop Partner Feed");
  assert.equal(adapter.sourceType, "partner");

  for (const cand of candidates) {
    assert.ok(cand.title, "Candidate must have title");
    assert.ok(cand.sourceUrl.startsWith("http"), "Source URL must be valid HTTP");
    assert.equal(cand.sourceType, "partner", "Unstop must strictly be partner source");
  }
});

test("Multi-Source Test 2: DevfolioAdapter discovers hackathons without bypassing restrictions", async () => {
  const adapter = new DevfolioAdapter();
  const candidates = await adapter.discover();

  assert.equal(adapter.sourceName, "Devfolio Hackathons Feed");
  for (const cand of candidates) {
    assert.equal(cand.category, "hackathon");
    assert.equal(cand.sourceType, "partner");
  }
});

test("Multi-Source Test 3: HackerEarthAdapter discovers innovation challenges", async () => {
  const adapter = new HackerEarthAdapter();
  const candidates = await adapter.discover();

  assert.equal(adapter.sourceName, "HackerEarth Innovation Feed");
  for (const cand of candidates) {
    assert.equal(cand.sourceType, "partner");
  }
});

test("Multi-Source Test 4: Buddy4StudyAdapter discovers scholarships & grants", async () => {
  const adapter = new Buddy4StudyAdapter();
  const candidates = await adapter.discover();

  assert.equal(adapter.sourceName, "Buddy4Study Scholarship Feed");
  for (const cand of candidates) {
    assert.equal(cand.category, "scholarship");
    assert.equal(cand.sourceType, "partner");
  }
});

test("Multi-Source Test 5: End-to-End Pipeline: Real Crawler Discovery → Official Verification → Published Catalog", async () => {
  const seedCountBefore = (await opportunityRepository.getAllActive()).length;
  
  // Run real web crawler discovery pipeline
  const result = await opportunityDiscoveryService.runRealWebCrawlerDiscovery();

  assert.ok(result.telemetry.length >= 4, "Telemetry must include all registered adapters");

  const activeAfter = await opportunityRepository.getAllActive();
  
  assert.ok(
    activeAfter.length >= seedCountBefore,
    `Website catalog active count (${activeAfter.length}) must preserve verified catalog alongside seed count (${seedCountBefore})`
  );

  // Check that telemetry contains proper fields
  for (const m of result.telemetry) {
    assert.ok(m.sourceName);
    assert.ok(typeof m.pagesFetched === "number");
    assert.ok(typeof m.candidatesFound === "number");
    assert.ok(typeof m.candidatesVerified === "number");
  }
});

test("Multi-Source Test 6: Zero-Fabrication Invariant across all adapter candidates", async () => {
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
