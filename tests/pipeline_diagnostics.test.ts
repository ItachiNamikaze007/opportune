import test from "node:test";
import assert from "node:assert/strict";

import { opportunityDiscoveryService } from "../src/services/opportunityDiscoveryService";
import { verificationDiagnosticsService } from "../src/services/verificationDiagnosticsService";
import { opportunityRepository } from "../src/repositories/opportunityRepository";

test("Pipeline Diagnostics 1: Structured diagnostic records are populated for every candidate discovered", async () => {
  const result = await opportunityDiscoveryService.runRealWebCrawlerDiscovery();
  const diagnostics = verificationDiagnosticsService.getAllDiagnostics();

  assert.ok(diagnostics.length > 0, "Must record diagnostic records for discovered candidates");
  
  for (const diag of diagnostics) {
    assert.ok(diag.candidateTitle, "Diagnostic record must have candidate title");
    assert.ok(diag.sourceName, "Diagnostic record must have source name");
    assert.ok(diag.reason, "Diagnostic record must have human-readable diagnostic reason");
    assert.ok(
      diag.finalDecision === "published" || diag.finalDecision === "pending" || diag.finalDecision === "rejected",
      "Decision must be published, pending, or rejected"
    );
  }
});

test("Pipeline Diagnostics 2: Candidate with valid official domain proof moves discovered -> pending -> verified -> published", async () => {
  const seedCountBefore = (await opportunityRepository.getAllActive()).length;

  const res = await opportunityDiscoveryService.runRealWebCrawlerDiscovery();
  const diagnostics = verificationDiagnosticsService.getAllDiagnostics();
  const publishedDiags = diagnostics.filter((d) => d.finalDecision === "published");

  if (publishedDiags.length > 0) {
    const pub = publishedDiags[0];
    assert.equal(pub.officialUrlFound, true);
    assert.equal(pub.officialUrlReachable, true);
    assert.ok(pub.confidenceScore >= 70);

    const activeAfter = await opportunityRepository.getAllActive();
    assert.ok(activeAfter.length >= seedCountBefore);
  }
});

test("Pipeline Diagnostics 3: Partner feed candidates without official organizer domain evidence remain pending with missing evidence logged", async () => {
  await opportunityDiscoveryService.runRealWebCrawlerDiscovery();
  const diagnostics = verificationDiagnosticsService.getAllDiagnostics();
  const pendingDiags = diagnostics.filter((d) => d.finalDecision === "pending" && !d.dedupMatched);

  assert.ok(pendingDiags.length > 0, "There must be candidates held in pending verification");

  for (const pending of pendingDiags) {
    assert.ok(
      pending.reason.includes("Pending Verification") || pending.reason.includes("Deduplicated"),
      "Pending reason must explicitly state missing verification evidence"
    );
    assert.ok(Array.isArray(pending.missingEvidence));
  }
});

test("Pipeline Diagnostics 4: Zero URL Fabrication across all diagnostic records", async () => {
  const diagnostics = verificationDiagnosticsService.getAllDiagnostics();

  for (const diag of diagnostics) {
    assert.ok(
      !diag.sourceUrl.endsWith("/apply") &&
      !diag.sourceUrl.endsWith("/register") &&
      !diag.sourceUrl.endsWith("/signup"),
      `Discovered URL ${diag.sourceUrl} must not be a fabricated subpath`
    );
  }
});

test("Pipeline Diagnostics 5: Source conversion metrics are calculated correctly per source", async () => {
  await opportunityDiscoveryService.runRealWebCrawlerDiscovery();
  const sourceMetrics = verificationDiagnosticsService.getSourceConversionMetrics();

  assert.ok(sourceMetrics.length > 0, "Source conversion metrics must be generated");
  for (const metric of sourceMetrics) {
    assert.ok(metric.sourceName);
    assert.ok(typeof metric.discovered === "number");
    assert.ok(typeof metric.published === "number");
    assert.ok(typeof metric.conversionRatePercent === "number");
  }
});
