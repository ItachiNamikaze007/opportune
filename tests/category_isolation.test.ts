import test from "node:test";
import assert from "node:assert/strict";
import { semanticSearchService } from "../src/services/semanticSearchService";
import { opportunityRepository } from "../src/repositories/opportunityRepository";
import { webcmdDiscoveryService } from "../src/services/crawler/webcmdDiscoveryService";
import { opportunityDiscoveryService } from "../src/services/opportunityDiscoveryService";
import { toCanonicalCategory } from "../src/types";
import * as fs from "fs";
import * as path from "path";

test("Category Isolation 1: Clicking Scholarships never returns UPSC or Government Exam items", async () => {
  const active = await opportunityRepository.getAllActive();
  const items = active.map((o) => ({
    opportunity: o,
    eligibility: { score: 100, status: "eligible" as const },
  }));

  const scholarshipResults = semanticSearchService.filterCatalog(items, "", { category: "scholarship" });

  for (const item of scholarshipResults) {
    const oppCat = toCanonicalCategory(item.opportunity.primaryCategory || item.opportunity.category);
    assert.equal(oppCat, "scholarship", `Item ${item.opportunity.title} must be a scholarship`);
    assert.notEqual(oppCat, "government_exam", "Scholarships filter must never return government exams");
    assert.ok(!item.opportunity.title.includes("UPSC"), "Scholarships filter must never return UPSC");
  }
});

test("Category Isolation 2: Clicking Scholarships never returns Hackathons", async () => {
  const active = await opportunityRepository.getAllActive();
  const items = active.map((o) => ({
    opportunity: o,
    eligibility: { score: 100, status: "eligible" as const },
  }));

  const scholarshipResults = semanticSearchService.filterCatalog(items, "", { category: "scholarship" });

  for (const item of scholarshipResults) {
    const oppCat = toCanonicalCategory(item.opportunity.primaryCategory || item.opportunity.category);
    assert.notEqual(oppCat, "hackathon", "Scholarships filter must never return hackathons");
  }
});

test("Category Isolation 3: Clicking Hackathons never returns Scholarships or Government Exams", async () => {
  const active = await opportunityRepository.getAllActive();
  const items = active.map((o) => ({
    opportunity: o,
    eligibility: { score: 100, status: "eligible" as const },
  }));

  const hackathonResults = semanticSearchService.filterCatalog(items, "", { category: "hackathon" });

  for (const item of hackathonResults) {
    const oppCat = toCanonicalCategory(item.opportunity.primaryCategory || item.opportunity.category);
    assert.equal(oppCat, "hackathon", `Item ${item.opportunity.title} must be a hackathon`);
    assert.notEqual(oppCat, "scholarship", "Hackathons filter must never return scholarships");
    assert.notEqual(oppCat, "government_exam", "Hackathons filter must never return government exams");
  }
});

test("Category Isolation 4: Clicking Internships never returns Government Exams", async () => {
  const active = await opportunityRepository.getAllActive();
  const items = active.map((o) => ({
    opportunity: o,
    eligibility: { score: 100, status: "eligible" as const },
  }));

  const internshipResults = semanticSearchService.filterCatalog(items, "", { category: "internship" });

  for (const item of internshipResults) {
    const oppCat = toCanonicalCategory(item.opportunity.primaryCategory || item.opportunity.category);
    assert.equal(oppCat, "internship", `Item ${item.opportunity.title} must be an internship`);
    assert.notEqual(oppCat, "government_exam", "Internships filter must never return government exams");
  }
});

test("Category Isolation 5: Webcmd discovered candidates start as pending and cannot directly publish", async () => {
  const result = await opportunityDiscoveryService.runWebcmdTargetedDiscovery("scholarship");

  // Webcmd results must be pending unless official domain proof exists
  const diagnostics = (await import("../src/services/verificationDiagnosticsService")).verificationDiagnosticsService.getAllDiagnostics();
  const webcmdDiags = diagnostics.filter((d) => d.sourceName.includes("Webcmd") || d.candidateId.includes("webcmd"));

  for (const diag of webcmdDiags) {
    if (!diag.officialUrlFound) {
      assert.equal(diag.finalDecision, "pending", "Webcmd candidate without official URL proof must remain pending");
    }
  }
});

test("Category Isolation 6: Production code src/ contains 0 mock candidates or mock adapters", () => {
  const srcDir = path.join(process.cwd(), "src");
  let mockCount = 0;

  function scan(dir: string) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) scan(full);
      else if (f.endsWith(".ts") || f.endsWith(".tsx")) {
        const content = fs.readFileSync(full, "utf-8");
        if (content.includes("MockTestSourceAdapter")) mockCount++;
      }
    }
  }

  scan(srcDir);
  assert.equal(mockCount, 0, "Production src/ directory must contain 0 references to MockTestSourceAdapter");
});
