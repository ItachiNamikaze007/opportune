import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeTitle,
  parseDeadline,
  normalizeCategory,
  normalizeStipendOrPrize,
  normalizeOpportunity,
  validateOpportunity,
} from "../src/ingestion/normalizeOpportunity";

import {
  canonicalOrganization,
  canonicalTitle,
  makeCanonicalKey,
  deduplicateOpportunity,
} from "../src/ingestion/deduplicateOpportunity";

import { detectOpportunityChanges } from "../src/ingestion/changeDetection";
import { extractEligibility } from "../src/ingestion/eligibilityExtractor";
import { scoreOpportunityConfidence } from "../src/ingestion/confidenceScorer";
import { sourceRegistry } from "../src/ingestion/sourceRegistry";
import { reviewQueueService } from "../src/ingestion/reviewQueueService";
import { runIngestionPipeline } from "../src/ingestion/pipeline";
import { matchingService } from "../src/services/matchingService";
import { notificationService } from "../src/services/notificationService";
import { digestService } from "../src/services/digestService";
import { defaultStudentProfile } from "../src/data/mockStudent";
import { mockOpportunities } from "../src/data/mockOpportunities";
import type { StudentProfile, Opportunity } from "../src/types";

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
});

// ==============================================================================
// 3. STRUCTURED ELIGIBILITY EXTRACTION & CONFIDENCE
// ==============================================================================
test("extractEligibility - extracts criteria from text", () => {
  const raw = {
    sourceId: "src-isro",
    sourceUrl: "https://isro.gov.in",
    title: "ISRO Scientist Post",
    organization: "ISRO",
    rawContent: "Eligibility: B.Tech or B.E. in Computer Science with minimum 6.84 CGPA. Maximum age not exceeding 28 years.",
    yearsRaw: [4],
  };

  const extracted = extractEligibility(raw);
  assert.ok(extracted.criteria.allowedDegrees.includes("B.Tech"));
  assert.ok(extracted.criteria.allowedBranches.includes("Computer Science"));
  assert.equal(extracted.criteria.minCGPA, 6.84);
  assert.equal(extracted.criteria.maxAge, 28);
  assert.ok(extracted.confidence >= 0.8);
});

// ==============================================================================
// 4. PERSONALIZED MATCHING SERVICE TESTS (Phase 4)
// ==============================================================================
test("matchingService - evaluates eligible, potentially eligible, and ineligible students", () => {
  const opp: Opportunity = mockOpportunities[0]; // Google AI Challenge

  // Case 1: Fully Eligible Student
  const eligibleStudent: StudentProfile = {
    ...defaultStudentProfile,
    degree: "B.Tech",
    branch: "Computer Science",
    currentYear: 3,
    cgpa: 8.8,
    skills: ["Python", "Machine Learning", "JavaScript"],
  };

  const matchEligible = matchingService.evaluateMatch("stud-1", eligibleStudent, opp);
  assert.equal(matchEligible.status, "eligible");
  assert.ok(matchEligible.score >= 80);
  assert.ok(matchEligible.reasons.length >= 3);

  // Case 2: Potentially Eligible Student (2nd year student with 7.2 CGPA on 3rd-year internship)
  const msOpp: Opportunity = mockOpportunities.find((o) => o.id === "opp-07")!; // Microsoft SWE (Year 3, CGPA >= 7.5)
  const potentialStudent: StudentProfile = {
    ...defaultStudentProfile,
    degree: "B.Tech",
    branch: "Computer Science",
    currentYear: 2, // Opportunity requires Year 3
    cgpa: 7.2, // Below 7.5 threshold
    skills: ["Python"],
  };

  const matchPotential = matchingService.evaluateMatch("stud-2", potentialStudent, msOpp);
  assert.ok(matchPotential.score >= 50 && matchPotential.score <= 74);
  assert.equal(matchPotential.status, "potentially_eligible");

  // Case 3: Ineligible Student (e.g. B.Com 1st year with 5.0 CGPA)
  const strictOpp: Opportunity = mockOpportunities.find((o) => o.id === "opp-07")!; // Microsoft SWE Internship (B.Tech 3rd year only, CGPA >= 7.5)
  const ineligibleStudent: StudentProfile = {
    ...defaultStudentProfile,
    degree: "B.Com",
    branch: "Commerce",
    currentYear: 1,
    cgpa: 5.0,
    skills: ["Accounting"],
  };

  const matchIneligible = matchingService.evaluateMatch("stud-3", ineligibleStudent, strictOpp);
  assert.equal(matchIneligible.status, "not_eligible");
  assert.ok(matchIneligible.score < 50);
  assert.ok(matchIneligible.mismatches.length >= 2);
});

test("matchingService - multi-factor ranking prioritizes eligibility, interests and deadline", () => {
  const student = defaultStudentProfile;
  const rawMatches = mockOpportunities.slice(0, 5).map((opp) => ({
    opportunity: opp,
    match: matchingService.evaluateMatch("stud-1", student, opp),
  }));

  const ranked = matchingService.rankMatchesForStudent(student, rawMatches);
  assert.equal(ranked.length, 5);
  // Highest ranking score is first
  assert.ok(ranked[0].rankingScore >= ranked[1].rankingScore);
});

test("matchingService - profile update triggers rematching and returns new eligible matches", async () => {
  const studentId = "stud-rematch-test";
  const initialProfile: StudentProfile = {
    ...defaultStudentProfile,
    cgpa: 6.0, // Initial lower CGPA
    skills: ["Basics"],
  };

  await matchingService.matchStudentWithCatalog(studentId, initialProfile, mockOpportunities);

  // Student updates CGPA and adds high-demand skills
  const updatedProfile: StudentProfile = {
    ...initialProfile,
    cgpa: 9.2,
    skills: ["Python", "Machine Learning", "Data Structures", "JavaScript", "C++"],
  };

  const rematchRes = await matchingService.rematchStudentOnProfileChange(
    studentId,
    updatedProfile,
    mockOpportunities
  );

  assert.ok(rematchRes.totalEligible >= 5);
});

test("matchingService - published opportunity triggers match evaluation across students", async () => {
  const publishedOpp = mockOpportunities.find((o) => o.id === "opp-07")!; // Microsoft SWE (B.Tech only)
  const students = [
    { id: "student-a", profile: defaultStudentProfile },
    {
      id: "student-b",
      profile: {
        ...defaultStudentProfile,
        degree: "B.Com" as any,
        branch: "Finance",
        skills: ["Accounting"],
      },
    },
  ];

  const res = await matchingService.matchPublishedOpportunityWithStudents(publishedOpp, students);
  assert.equal(res.eligibleCount, 1);
  assert.ok(res.matchedStudentIds.includes("student-a"));
});

// ==============================================================================
// 5. NOTIFICATIONS & ANTI-SPAM GROUPING TESTS (Phase 4)
// ==============================================================================
test("notificationService - groups multiple incoming matches into a single anti-spam notification", async () => {
  const userId = "test-group-user";

  // Send match 1
  const notif1 = await notificationService.createGroupedMatchNotification(
    userId,
    "Google AI Challenge 2026",
    "opp-01",
    96
  );
  assert.ok(notif1);
  assert.equal(notif1.match_count, 1);

  // Send match 2 on same day -> Should increment count rather than spamming separate alerts
  const notif2 = await notificationService.createGroupedMatchNotification(
    userId,
    "Microsoft Summer Internship",
    "opp-07",
    92
  );
  assert.ok(notif2);
  assert.equal(notif2.match_count, 2);
  assert.ok(notif2.title.includes("2 New Opportunities"));
});

test("notificationService - creates deadline reminders for 7d, 3d, 1d thresholds", async () => {
  const userId = "test-reminder-user";
  const notif7 = await notificationService.createDeadlineReminder(userId, "ISRO Recruitment", "opp-05", 7);
  assert.ok(notif7?.title.includes("Deadline in 7 Days"));

  const notif1 = await notificationService.createDeadlineReminder(userId, "Google AI Challenge", "opp-01", 1);
  assert.ok(notif1?.title.includes("Deadline in 1 Day"));
});

test("notificationService - respects user notification preferences", async () => {
  const userId = "test-prefs-user";

  // Disable new matches
  notificationService.updateUserPreferences(userId, { newMatches: false });

  const result = await notificationService.createGroupedMatchNotification(
    userId,
    "Google AI Challenge",
    "opp-01",
    95
  );
  assert.equal(result, null); // Blocked by user preferences!

  // Re-enable
  notificationService.updateUserPreferences(userId, { newMatches: true });
});

// ==============================================================================
// 6. WEEKLY DIGEST SERVICE TESTS (Phase 4)
// ==============================================================================
test("digestService - aggregates weekly opportunity digest payload", () => {
  const digest = digestService.generateWeeklyDigest(
    defaultStudentProfile,
    mockOpportunities,
    ["opp-01", "opp-02"]
  );

  assert.equal(digest.studentName, defaultStudentProfile.name);
  assert.ok(digest.topMatches.length > 0);
  assert.ok(digest.savedNearingDeadline.length > 0);
  assert.ok(digest.totalEligibleFound >= 5);
  assert.ok(digest.highlightMessage.includes("opportunities perfectly matching"));
});

// ==============================================================================
// 7. REVIEW QUEUE & PIPELINE INTEGRATION
// ==============================================================================
test("reviewQueueService & pipeline - manages queue approvals and published catalog integration", async () => {
  const pipelineResult = await runIngestionPipeline("src-gov-isro", []);
  assert.equal(pipelineResult.summary.status, "success");
  assert.ok(pipelineResult.enqueuedForReview.length >= 1);

  const reviewItem = reviewQueueService.getReview(pipelineResult.enqueuedForReview[0].id!);
  assert.ok(reviewItem);
  assert.equal(reviewItem.reviewStatus, "pending");

  const approveRes = reviewQueueService.approveReview(reviewItem.id, "Staff Admin", "Verified gazette notice");
  assert.equal(approveRes.approved, true);
  assert.equal(approveRes.publishedOpportunity?.lifecycleStatus, "published");
  assert.equal(approveRes.publishedOpportunity?.verificationStatus, "verified");
});
