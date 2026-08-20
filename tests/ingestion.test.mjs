import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeTitle,
  parseDeadline,
  normalizeCategory,
  normalizeStipendOrPrize,
  normalizeOpportunity,
  validateOpportunity,
} from "../src/ingestion/normalizeOpportunity.ts";

import {
  canonicalOrganization,
  canonicalTitle,
  makeCanonicalKey,
  deduplicateOpportunity,
} from "../src/ingestion/deduplicateOpportunity.ts";

import { detectOpportunityChanges } from "../src/ingestion/changeDetection.ts";
import { sourceRegistry } from "../src/ingestion/sourceRegistry.ts";
import { GovPortalConnector } from "../src/ingestion/connectors/GovPortalConnector.ts";

// ==============================================================================
// 1. DEADLINE PARSING TESTS
// ==============================================================================
test("parseDeadline - parses standard ISO format", () => {
  assert.equal(parseDeadline("2026-08-28"), "2026-08-28");
  assert.equal(parseDeadline("2026-9-5"), "2026-09-05");
});

test("parseDeadline - parses DD/MM/YYYY and DD-MM-YYYY formats", () => {
  assert.equal(parseDeadline("28/08/2026"), "2026-08-28");
  assert.equal(parseDeadline("05-09-2026"), "2026-09-05");
});

test("parseDeadline - parses textual dates", () => {
  assert.equal(parseDeadline("28 Aug 2026"), "2026-08-28");
  assert.equal(parseDeadline("August 28, 2026"), "2026-08-28");
  assert.equal(parseDeadline("10 September 2026"), "2026-09-10");
});

test("parseDeadline - handles open/rolling and invalid dates", () => {
  assert.equal(parseDeadline("Rolling"), "2026-11-30");
  assert.equal(parseDeadline(""), null);
  assert.equal(parseDeadline(undefined), null);
});

// ==============================================================================
// 2. TITLE & CATEGORY NORMALIZATION TESTS
// ==============================================================================
test("normalizeTitle - cleans boilerplate noise prefixes and whitespace", () => {
  assert.equal(
    normalizeTitle("[URGENT] Google AI Challenge 2026   "),
    "Google AI Challenge 2026"
  );
  assert.equal(
    normalizeTitle("New Announcement: ISRO Scientist Recruitment 2026"),
    "ISRO Scientist Recruitment 2026"
  );
});

test("normalizeCategory - maps appropriate opportunity category", () => {
  assert.equal(
    normalizeCategory("hackathon", "SIH 2026", "National hackathon").category,
    "hackathon"
  );
  assert.equal(
    normalizeCategory("internship", "NITI Aayog Policy Internship", "Govt ministry").category,
    "government_internship"
  );
  assert.equal(
    normalizeCategory("exam", "ISRO Scientist Exam", "Central government").category,
    "government_exam"
  );
  assert.equal(
    normalizeCategory("scholarship", "Reliance STEM Grant", "Merit financial aid").category,
    "scholarship"
  );
  assert.equal(
    normalizeCategory("program", "Mitacs Globalink Research in Canada", "International research").category,
    "international_opportunity"
  );
});

test("normalizeStipendOrPrize - parses prizes, salaries, and grants", () => {
  assert.deepEqual(normalizeStipendOrPrize(undefined, "₹1,00,000"), {
    text: "₹1,00,000",
    type: "prize",
  });
  assert.deepEqual(normalizeStipendOrPrize("₹18 LPA CTC", undefined), {
    text: "₹18 LPA CTC",
    type: "salary",
  });
  assert.deepEqual(normalizeStipendOrPrize("CAD $9,000 Grant", undefined), {
    text: "CAD $9,000 Grant",
    type: "grant",
  });
  assert.deepEqual(normalizeStipendOrPrize("100% Tuition Waiver", undefined), {
    text: "100% Tuition Waiver",
    type: "free_waiver",
  });
});

// ==============================================================================
// 3. NORMALIZATION & VALIDATION TESTS
// ==============================================================================
test("normalizeOpportunity & validateOpportunity - creates valid structured opportunity", () => {
  const raw = {
    title: "Google AI Challenge 2026",
    organization: "Google Developers",
    categoryRaw: "hackathon",
    descriptionRaw: "Build AI agents with Gemini models and TensorFlow.",
    deadlineRaw: "2026-08-28",
    officialUrl: "https://developers.google.com/hackathons",
    isRemote: true,
    prizeRaw: "₹1,00,000",
    degreesRaw: ["B.Tech", "MCA"],
    cgpaRaw: 6.5,
  };

  const normalized = normalizeOpportunity(raw, "src-google", true);
  assert.equal(normalized.title, "Google AI Challenge 2026");
  assert.equal(normalized.organization, "Google Developers");
  assert.equal(normalized.category, "hackathon");
  assert.equal(normalized.deadline, "2026-08-28");
  assert.equal(normalized.verificationStatus, "verified");
  assert.equal(normalized.isDemo, false);
  assert.equal(normalized.remote, true);
  assert.equal(normalized.eligibilityCriteria.minCGPA, 6.5);

  const validation = validateOpportunity(normalized);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);
});

test("validateOpportunity - rejects incomplete or invalid records", () => {
  const invalidOpp = {
    sourceId: "src-test",
    title: "Ab", // too short
    organization: "", // missing
    category: "hackathon",
    categoryLabel: "Hackathon",
    description: "Tiny", // too short
    fullDescription: "Tiny",
    deadline: "invalid-date",
    location: "India",
    remote: false,
    stipendOrPrize: "None",
    stipendType: "stipend",
    officialUrl: "not-a-valid-url",
    applyUrl: "not-a-valid-url",
    sourceUrl: "not-a-valid-url",
    verificationStatus: "pending",
    lastVerified: "2026-08-20",
    isDemo: false,
    tags: [],
    benefits: [],
    applicationSteps: [],
    importantDates: [],
    eligibilityCriteria: {
      allowedDegrees: [],
      allowedBranches: [],
      allowedYears: [],
    },
  };

  const validation = validateOpportunity(invalidOpp as any);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.length >= 4);
});

test("Verification rule - unverified source cannot receive 'verified' status", () => {
  const raw = {
    title: "Community Hackathon",
    organization: "Community Org",
    descriptionRaw: "Exciting coding hackathon with mentors.",
    deadlineRaw: "2026-09-15",
    officialUrl: "https://community.org/hack",
  };

  const normalized = normalizeOpportunity(raw, "src-unverified", false);
  assert.notEqual(normalized.verificationStatus, "verified");
  assert.equal(normalized.verificationStatus, "pending");
});

// ==============================================================================
// 4. DEDUPLICATION TESTS
// ==============================================================================
test("deduplicateOpportunity - detects exact and canonical duplicates", () => {
  const existingCatalog = [
    {
      id: "opp-01",
      title: "Google AI Challenge 2026",
      organization: "Google Developers & Research",
      deadline: "2026-08-28",
      category: "hackathon",
    },
  ];

  const incomingExact = {
    sourceId: "src-secondary",
    title: "Google AI Challenge 2026",
    organization: "Google Developers & Research",
    deadline: "2026-08-28",
  };

  const resultExact = deduplicateOpportunity(incomingExact as any, existingCatalog as any);
  assert.equal(resultExact.isDuplicate, true);
  assert.equal(resultExact.duplicateOf, "opp-01");
  assert.equal(resultExact.matchConfidence, 1.0);

  const incomingCleaned = {
    sourceId: "src-third",
    title: "Google AI Challenge 2026 (Batch of 2027)",
    organization: "Google Developers Research",
    deadline: "2026-08-28",
  };

  const resultCleaned = deduplicateOpportunity(incomingCleaned as any, existingCatalog as any);
  assert.equal(resultCleaned.isDuplicate, true);
  assert.equal(resultCleaned.duplicateOf, "opp-01");

  const incomingDifferent = {
    sourceId: "src-new",
    title: "Microsoft Imagine Cup 2027",
    organization: "Microsoft",
    deadline: "2026-11-15",
  };

  const resultDifferent = deduplicateOpportunity(incomingDifferent as any, existingCatalog as any);
  assert.equal(resultDifferent.isDuplicate, false);
});

// ==============================================================================
// 5. CHANGE DETECTION TESTS
// ==============================================================================
test("detectOpportunityChanges - detects new, deadline changed, eligibility changed, and expired", () => {
  const existing = {
    id: "opp-02",
    title: "NITI Aayog National Internship",
    description: "Original description of the government scheme.",
    deadline: "2026-09-10",
    stipendOrPrize: "Govt Certificate",
    eligibilityCriteria: {
      minCGPA: 7.5,
      maxAge: 25,
      allowedDegrees: ["B.Tech"],
      allowedBranches: ["Computer Science"],
      allowedYears: [2, 3],
    },
  };

  // Case 1: New Opportunity
  const resNew = detectOpportunityChanges(null, { title: "Brand New Scheme" } as any);
  assert.equal(resNew.changeType, "new_opportunity");
  assert.equal(resNew.hasChanges, true);

  // Case 2: Deadline Extension
  const resDeadline = detectOpportunityChanges(existing as any, {
    ...existing,
    deadline: "2026-09-25",
  } as any);
  assert.equal(resDeadline.changeType, "deadline_changed");
  assert.equal(resDeadline.hasChanges, true);
  assert.equal(resDeadline.diffs.deadline.new, "2026-09-25");

  // Case 3: Eligibility Criteria Changed
  const resElig = detectOpportunityChanges(existing as any, {
    ...existing,
    deadline: "2026-09-10",
    eligibilityCriteria: {
      minCGPA: 8.0, // increased CGPA
      maxAge: 25,
      allowedDegrees: ["B.Tech", "MCA"],
      allowedBranches: ["Computer Science"],
      allowedYears: [2, 3],
    },
  } as any);
  assert.equal(resElig.changeType, "eligibility_changed");
  assert.equal(resElig.hasChanges, true);

  // Case 4: Identical
  const resNoChange = detectOpportunityChanges(existing as any, {
    ...existing,
    deadline: "2026-09-10",
  } as any);
  assert.equal(resNoChange.changeType, "no_change");
  assert.equal(resNoChange.hasChanges, false);
});

// ==============================================================================
// 6. SOURCE REGISTRY & STATUS LIFECYCLE TESTS
// ==============================================================================
test("sourceRegistry - manages source statuses and connector execution without deleting on failure", async () => {
  const sources = sourceRegistry.getAllSources();
  assert.ok(sources.length >= 1);
  const nitiSource = sources.find((s) => s.id === "src-gov-niti");
  assert.ok(nitiSource);
  assert.equal(nitiSource.status, "active");

  // Test executing connector ingestion
  const runResult = await sourceRegistry.runSourceIngestion("src-gov-niti", []);
  assert.equal(runResult.summary.status, "success");
  assert.ok(runResult.processedOpportunities.length >= 1);

  // Test status update to error on failure (source is preserved, error details saved)
  sourceRegistry.updateSourceStatus("src-gov-niti", "error", "Connection timeout 504 Gateway");
  const updatedSources = sourceRegistry.getAllSources();
  const erroredSource = updatedSources.find((s) => s.id === "src-gov-niti");
  assert.equal(erroredSource?.status, "error");
  assert.equal(erroredSource?.last_error, "Connection timeout 504 Gateway");

  // Reset back to active
  sourceRegistry.updateSourceStatus("src-gov-niti", "active");
});
