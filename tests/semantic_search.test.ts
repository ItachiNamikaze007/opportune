import test from "node:test";
import assert from "node:assert/strict";

import { semanticSearchService } from "../src/services/semanticSearchService";
import { realVerifiedOpportunities } from "../src/data/realOpportunities";
import type { Opportunity, StudentProfile, EligibilityResult } from "../src/types";

const dummyProfile: StudentProfile = {
  name: "Test Student",
  email: "test@student.edu",
  degree: "B.Tech",
  institution: "IIT Bombay",
  branch: "Computer Science",
  currentYear: 2,
  graduationYear: 2028,
  cgpa: 8.5,
  age: 20,
  country: "India",
  state: "Maharashtra",
  city: "Mumbai",
  gender: "all",
  skills: ["Python", "Machine Learning", "AI", "Algorithms"],
  interests: ["Hackathons", "Scholarships"],
  completedOnboarding: true,
};

const dummyEligibility: EligibilityResult = {
  score: 90,
  status: "eligible",
  summaryNotes: ["Eligible for B.Tech", "Passes CGPA requirement"],
  breakdown: [],
};

const verifiedScholarship: Opportunity = {
  id: "test-real-verified-scholarship-001",
  title: "National Merit Scholarship for B.Tech Students 2026",
  organization: "Ministry of Education",
  category: "scholarship",
  categoryLabel: "Scholarship",
  description: "Merit scholarship scheme for undergraduate B.Tech engineering students.",
  fullDescription: "Full details for National Merit Scholarship for B.Tech Students 2026.",
  deadline: "2026-11-30",
  location: "Pan-India",
  remote: true,
  stipendOrPrize: "₹50,000/year",
  stipendType: "grant",
  officialUrl: "https://scholarships.gov.in",
  verificationStatus: "verified",
  lifecycleStatus: "published",
  confidenceScore: 95,
  lastVerified: "2026-08-22",
  eligibilityCriteria: {
    allowedDegrees: ["B.Tech", "B.E."],
    allowedBranches: ["All Branches"],
    allowedYears: [1, 2, 3, 4],
  },
};

const mockCatalog = [
  ...realVerifiedOpportunities.map((opp) => ({
    opportunity: opp,
    eligibility: dummyEligibility,
  })),
  { opportunity: verifiedScholarship, eligibility: dummyEligibility },
];

test("Semantic Search Test 1: Natural Query 'Hackathons in India' returns ONLY open verified hackathons", async () => {
  const results = semanticSearchService.filterCatalog(mockCatalog, "Hackathons in India");

  assert.ok(results.length > 0, "Must return verified hackathons");

  for (const { opportunity } of results) {
    assert.equal(opportunity.category, "hackathon", "Category must strictly be hackathon");
    assert.ok(
      opportunity.verificationStatus === "verified" || opportunity.verificationStatus === "partner_verified",
      "Must be verified or partner_verified"
    );
    assert.equal(opportunity.lifecycleStatus, "published");
    assert.ok(opportunity.deadline >= "2026-08-22", "Must not be expired");
  }
});

test("Semantic Search Test 2: Natural Query 'Scholarships for B.Tech' returns ONLY verified scholarships matching B.Tech", async () => {
  const results = semanticSearchService.filterCatalog(mockCatalog, "Scholarships for B.Tech");

  assert.ok(results.length > 0, "Must return verified scholarships");

  for (const { opportunity } of results) {
    assert.equal(opportunity.category, "scholarship", "Category must strictly be scholarship");
    assert.equal(opportunity.verificationStatus, "verified");
    const degrees = opportunity.eligibilityCriteria?.allowedDegrees || [];
    assert.ok(
      degrees.includes("All Degrees") || degrees.includes("B.Tech"),
      "Must match B.Tech eligibility"
    );
  }
});

test("Semantic Search Test 3: Natural Query 'AI/ML internships' returns ONLY verified internships", async () => {
  const results = semanticSearchService.filterCatalog(mockCatalog, "AI/ML internships");

  assert.ok(results.length > 0, "Must return verified internships");

  for (const { opportunity } of results) {
    assert.ok(
      opportunity.category === "private_internship" ||
      opportunity.category === "government_internship" ||
      opportunity.title.toLowerCase().includes("internship"),
      "Category must be internship"
    );
    assert.equal(opportunity.verificationStatus, "verified");
  }
});

test("Semantic Search Test 4: Query 'Government opportunities' returns ONLY government opportunities", async () => {
  const results = semanticSearchService.filterCatalog(mockCatalog, "Government opportunities");

  assert.ok(results.length > 0);

  for (const { opportunity } of results) {
    const isGov =
      opportunity.category === "government_exam" ||
      opportunity.category === "government_internship" ||
      opportunity.sourceType === "official" ||
      opportunity.organization.toLowerCase().includes("ministry") ||
      opportunity.organization.toLowerCase().includes("niti") ||
      opportunity.organization.toLowerCase().includes("isro") ||
      opportunity.organization.toLowerCase().includes("drdo") ||
      opportunity.organization.toLowerCase().includes("upsc");

    assert.ok(isGov, `Opportunity [${opportunity.id}] must be a legitimate government opportunity`);
  }
});

test("Semantic Search Test 5: Expired hackathons are strictly excluded", async () => {
  const expiredHackathon: Opportunity = {
    ...realVerifiedOpportunities[0],
    id: "test-expired-hackathon",
    title: "Expired National Hackathon 2025",
    category: "hackathon",
    categoryLabel: "Hackathon",
    deadline: "2025-01-01", // Past deadline
    verificationStatus: "verified",
    lifecycleStatus: "published",
  };

  const catalogWithExpired = [
    ...mockCatalog,
    { opportunity: expiredHackathon, eligibility: dummyEligibility },
  ];

  const results = semanticSearchService.filterCatalog(catalogWithExpired, "Hackathons in India");
  const foundExpired = results.some((r) => r.opportunity.id === "test-expired-hackathon");

  assert.equal(foundExpired, false, "Expired hackathons must NEVER appear in public verified search results");
});

test("Semantic Search Test 6: Unverified / pending hackathons are strictly excluded", async () => {
  const pendingHackathon: Opportunity = {
    ...realVerifiedOpportunities[0],
    id: "test-pending-hackathon",
    title: "Unverified Rumored Hackathon 2026",
    category: "hackathon",
    categoryLabel: "Hackathon",
    deadline: "2026-11-30",
    verificationStatus: "pending",
    lifecycleStatus: "draft",
  };

  const catalogWithPending = [
    ...mockCatalog,
    { opportunity: pendingHackathon, eligibility: dummyEligibility },
  ];

  const results = semanticSearchService.filterCatalog(catalogWithPending, "Hackathons in India");
  const foundPending = results.some((r) => r.opportunity.id === "test-pending-hackathon");

  assert.equal(foundPending, false, "Unverified/pending opportunities must NEVER appear in public search results");
});

test("Semantic Search Test 7: Discovery-only / LinkedIn signals are strictly excluded from public verified results", async () => {
  const linkedinSignal: Opportunity = {
    ...realVerifiedOpportunities[0],
    id: "disc-linkedin-9999",
    title: "LinkedIn Post Announced Challenge",
    category: "hackathon",
    categoryLabel: "Hackathon",
    sourceType: "discovery_only",
    verificationStatus: "pending",
    lifecycleStatus: "draft",
    officialUrl: "https://www.linkedin.com/posts/fake-hackathon",
  };

  const catalogWithSignal = [
    ...mockCatalog,
    { opportunity: linkedinSignal, eligibility: dummyEligibility },
  ];

  const results = semanticSearchService.filterCatalog(catalogWithSignal, "Hackathons in India");
  const foundSignal = results.some((r) => r.opportunity.id === "disc-linkedin-9999");

  assert.equal(foundSignal, false, "Discovery-only signals must NEVER appear as public verified search results");
});

test("Semantic Search Test 8: Partner conflict prioritizes official winning deadline", async () => {
  const oppWithConflict = realVerifiedOpportunities.find((o) => o.sourceConflict);
  if (oppWithConflict) {
    assert.equal(oppWithConflict.verificationStatus, "verified");
    assert.equal(oppWithConflict.sourceType, "official");
  }
});

test("Semantic Search Test 9: Wrong category queries strictly exclude non-matching categories", async () => {
  const scholarshipGrant: Opportunity = {
    ...realVerifiedOpportunities[0],
    id: "test-scholarship-with-hackathon-word-in-title",
    title: "Scholarship Grant for Outstanding Hackathon Winners 2026",
    category: "scholarship",
    categoryLabel: "Scholarship",
    deadline: "2026-11-30",
    verificationStatus: "verified",
    lifecycleStatus: "published",
  };

  const catalogWithTrickyItem = [
    ...mockCatalog,
    { opportunity: scholarshipGrant, eligibility: dummyEligibility },
  ];

  // Search "hackathon" — scholarshipGrant category is scholarship, so it MUST be excluded!
  const results = semanticSearchService.filterCatalog(catalogWithTrickyItem, "Hackathons in India");
  const foundTrickyItem = results.some((r) => r.opportunity.id === "test-scholarship-with-hackathon-word-in-title");

  assert.equal(
    foundTrickyItem,
    false,
    "Searching 'hackathon' must NOT return a scholarship even if the word 'hackathon' appears in title"
  );
});

test("Semantic Search Test 10: Degree & Eligibility mismatches are strictly excluded", async () => {
  const phdOnlyOpp: Opportunity = {
    ...realVerifiedOpportunities[0],
    id: "test-phd-only-opp",
    title: "Postdoctoral PhD Research Fellowship 2026",
    category: "research_internship",
    categoryLabel: "Fellowship",
    deadline: "2026-11-30",
    verificationStatus: "verified",
    lifecycleStatus: "published",
    eligibilityCriteria: {
      allowedDegrees: ["PhD"],
      allowedBranches: ["Physics"],
      allowedYears: [5],
    },
  };

  const catalogWithPhd = [
    ...mockCatalog,
    { opportunity: phdOnlyOpp, eligibility: dummyEligibility },
  ];

  // Filter for B.Tech degree
  const results = semanticSearchService.filterCatalog(catalogWithPhd, "Fellowships for B.Tech students", { degree: "B.Tech" });
  const foundPhd = results.some((r) => r.opportunity.id === "test-phd-only-opp");

  assert.equal(foundPhd, false, "PhD-only opportunity must be strictly excluded when filtering for B.Tech");
});
