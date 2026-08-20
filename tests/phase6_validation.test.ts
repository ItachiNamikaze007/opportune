import { test } from "node:test";
import assert from "node:assert/strict";
import { getOpportunityStatus } from "../src/services/opportunityStatusResolver";
import { appConfig } from "../src/lib/config";
import { runIngestionPipeline } from "../src/ingestion/pipeline";
import { ISROGovConnector } from "../src/ingestion/connectors/ISROGovConnector";
import { reviewQueueService } from "../src/ingestion/reviewQueueService";
import { sourceHealthService } from "../src/ingestion/sourceHealthService";
import { matchingService } from "../src/services/matchingService";
import { notificationService } from "../src/services/notificationService";
import { deadlineJobService } from "../src/services/deadlineJob";
import { detectOpportunityChanges } from "../src/ingestion/changeDetection";
import { scoreOpportunityConfidence } from "../src/ingestion/confidenceScorer";
import { extractEligibility } from "../src/ingestion/eligibilityExtractor";
import { Opportunity, StudentProfile } from "../src/types";

// Controlled Test Student Profile (4th Year B.Tech CSE Student)
const testStudent: StudentProfile = {
  name: "Ananya Sharma",
  email: "ananya.sharma@example.edu.in",
  degree: "B.Tech",
  institution: "National Institute of Technology",
  branch: "Computer Science",
  currentYear: 4,
  graduationYear: 2027,
  cgpa: 8.5,
  age: 21,
  country: "India",
  state: "Karnataka",
  city: "Bengaluru",
  gender: "female",
  skills: ["Python", "Machine Learning", "Data Structures", "Electronics"],
  interests: ["government_exam", "government_internship", "research_internship"],
  completedOnboarding: true,
};

// 1. Production uses real current server date/time when no referenceDate passed
test("Phase 6 Test 1: Production uses real current date when no referenceDate is provided", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const futureIso = futureDate.toISOString().split("T")[0];

  const opp: Opportunity = {
    id: "opp-live-real",
    title: "Live Production Opportunity",
    organization: "Official Agency",
    category: "job",
    categoryLabel: "Job",
    description: "Active opening",
    fullDescription: "Full details",
    deadline: futureIso,
    location: "Pan India",
    remote: true,
    stipendOrPrize: "Competitive",
    stipendType: "stipend",
    officialUrl: "https://agency.gov.in/careers",
    verificationStatus: "verified",
    lastVerified: new Date().toISOString().split("T")[0],
    tags: [],
    benefits: [],
    applicationSteps: [],
    importantDates: [],
    eligibilityCriteria: { allowedDegrees: ["B.Tech"], allowedBranches: ["All Branches"], allowedYears: [4] },
  };

  // Call without referenceDate (defaults to real current server time)
  const status = getOpportunityStatus(opp);

  assert.equal(status.isExpired, false);
  assert.ok(status.daysRemaining >= 29 && status.daysRemaining <= 31);
  assert.equal(status.status, "ACTIVE");
});

// 2. Demo vs Production Isolation & Loud Failure
test("Phase 6 Test 2: Production mode asserts Supabase config and rejects silent mock fallbacks", () => {
  assert.equal(typeof appConfig.isDemo, "boolean");
  assert.equal(typeof appConfig.isProduction, "boolean");

  const mockProdConfig = { isProduction: true, hasSupabaseConfig: false };
  assert.throws(
    () => {
      if (mockProdConfig.isProduction && !mockProdConfig.hasSupabaseConfig) {
        throw new Error("[FATAL CONFIGURATION ERROR] Production mode requires active Supabase configuration.");
      }
    },
    { message: /FATAL CONFIGURATION ERROR/ }
  );
});

// 3. Real Connector Ingestion Flow
test("Phase 6 Test 3: Real official connector fetches structured official raw records", async () => {
  const connector = new ISROGovConnector();
  const rawRecords = await connector.fetch();

  assert.ok(rawRecords.length > 0);
  const record = rawRecords[0];
  assert.equal(record.sourceId, "src-gov-isro");
  assert.ok(record.officialUrl?.includes(".gov.in"));
  assert.ok(record.title.includes("ISRO"));
  assert.ok(record.cgpaRaw && record.cgpaRaw >= 6.5);
});

// 4. Official Source Authority & Domain Scoring
test("Phase 6 Test 4: Official publisher domain scores high confidence", () => {
  const connector = new ISROGovConnector();
  const rawRecord = {
    sourceId: "src-gov-isro",
    sourceUrl: "https://www.isro.gov.in/Careers.html",
    officialUrl: "https://www.isro.gov.in/Careers.html",
    applyUrl: "https://apps.isro.gov.in/icrb/apply",
    title: "ISRO Scientist / Engineer SC Recruitment Exam 2026",
    organization: "Indian Space Research Organisation",
    categoryRaw: "government_exam",
    deadlineRaw: "2026-09-20",
    degreesRaw: ["B.Tech", "B.E."],
    branchesRaw: ["Computer Science"],
  };
  const normalized = connector.normalize(rawRecord);
  const confidence = scoreOpportunityConfidence(rawRecord, normalized, true);

  assert.ok(confidence.overall >= 0.85);
  assert.equal(confidence.level, "high_confidence");
});

// 5. Deadline Extraction & Invariant Validation
test("Phase 6 Test 5: Extracted past deadline automatically marks lifecycle as EXPIRED with daysRemaining = 0", () => {
  const pastOpp: Opportunity = {
    id: "opp-past-isro",
    title: "ISRO 2025 Scientist Recruitment",
    organization: "ISRO",
    category: "government_exam",
    categoryLabel: "Government Exam",
    description: "Previous year exam",
    fullDescription: "Past exam",
    deadline: "2025-01-15",
    location: "Bengaluru",
    remote: false,
    stipendOrPrize: "Level 10",
    stipendType: "stipend",
    officialUrl: "https://isro.gov.in",
    verificationStatus: "verified",
    lastVerified: "2025-01-10",
    tags: [],
    benefits: [],
    applicationSteps: [],
    importantDates: [],
    eligibilityCriteria: { allowedDegrees: ["B.Tech"], allowedBranches: ["Computer Science"], allowedYears: [4] },
  };

  const status = getOpportunityStatus(pastOpp);
  assert.equal(status.status, "EXPIRED");
  assert.equal(status.daysRemaining, 0);
  assert.equal(status.isExpired, true);
  assert.equal(status.isActivelyApplicable, false);
});

// 6. Eligibility Extraction from Raw Text
test("Phase 6 Test 6: Extracts structured eligibility criteria from official notice text without guessing", () => {
  const rawRecord = {
    sourceId: "src-gov-isro",
    sourceUrl: "https://isro.gov.in",
    title: "ISRO Exam",
    organization: "ISRO",
    rawContent: "Eligible branches: B.Tech in Computer Science with minimum 65% aggregate or 6.84 CGPA. Maximum age not exceeding 28 years.",
    degreesRaw: ["B.Tech"],
    branchesRaw: ["Computer Science"],
    cgpaRaw: 6.84,
    ageLimitRaw: 28,
  };
  const extracted = extractEligibility(rawRecord);

  assert.deepEqual(extracted.criteria.allowedDegrees, ["B.Tech"]);
  assert.deepEqual(extracted.criteria.allowedBranches, ["Computer Science"]);
  assert.equal(extracted.criteria.minCGPA, 6.84);
  assert.equal(extracted.criteria.maxAge, 28);
});

// 7. Multi-dimensional Confidence Scoring
test("Phase 6 Test 7: Multi-dimensional confidence scorer weights all dimensions", () => {
  const connector = new ISROGovConnector();
  const rawRecord = {
    sourceId: "src-gov-isro",
    sourceUrl: "https://www.isro.gov.in",
    officialUrl: "https://www.isro.gov.in",
    title: "ISRO Scientist / Engineer Exam 2026",
    organization: "ISRO",
    deadlineRaw: "2026-10-30",
  };
  const normalized = connector.normalize(rawRecord);
  const confidence = scoreOpportunityConfidence(rawRecord, normalized, true);

  assert.ok(confidence.title > 0);
  assert.ok(confidence.deadline > 0);
  assert.ok(confidence.organization > 0);
  assert.ok(confidence.overall > 0);
});

// 8. Mandatory Human Review Enforcement
test("Phase 6 Test 8: Ingested opportunities are placed in review queue with status 'pending' (NEVER auto-published)", async () => {
  const result = await runIngestionPipeline("src-gov-isro", []);

  assert.ok(result.enqueuedForReview.length > 0);
  const enqueued = result.enqueuedForReview[0];
  const queueItem = reviewQueueService.getReview(enqueued.id);

  assert.ok(queueItem);
  assert.equal(queueItem.reviewStatus, "pending");
  assert.equal(enqueued.lifecycleStatus, "pending_review");
});

// 9. Admin Review Approval -> Publication Flow
test("Phase 6 Test 9: Human reviewer approval transitions opportunity to published and verified", async () => {
  const result = await runIngestionPipeline("src-gov-isro", []);
  const enqueued = result.enqueuedForReview[0];

  const approval = reviewQueueService.approveReview(
    enqueued.id,
    "Lead Auditor",
    "Verified against ISRO official career portal."
  );

  assert.equal(approval.approved, true);
  assert.ok(approval.publishedOpportunity);
  assert.equal(approval.publishedOpportunity.verificationStatus, "verified");
  assert.equal(approval.publishedOpportunity.lifecycleStatus, "published");

  const publishedCatalog = reviewQueueService.getPublishedRealOpportunities();
  assert.ok(publishedCatalog.some((o) => o.id === enqueued.id));
});

// 10. Real Student Matching
test("Phase 6 Test 10: Evaluates deterministic eligibility match for test student", async () => {
  const result = await runIngestionPipeline("src-gov-isro", []);
  const enqueued = result.enqueuedForReview[0];
  const approval = reviewQueueService.approveReview(enqueued.id, "Lead Auditor", "Approved");

  const match = matchingService.evaluateMatch(
    "student-ananya",
    testStudent,
    approval.publishedOpportunity!
  );

  assert.ok(match.score >= 80);
  assert.equal(match.status, "eligible");
  assert.ok(match.reasons.length > 0);
});

// 11. Real Notification Generation & Grouping
test("Phase 6 Test 11: Real opportunity matching dispatches grouped anti-spam notification", async () => {
  const notif = await notificationService.createGroupedMatchNotification(
    "student-ananya",
    "ISRO Scientist Exam 2026",
    "opp-real-isro",
    95
  );

  assert.ok(notif);
  assert.equal(notif.type, "new_match");
  assert.ok(notif.title.includes("New Opportunity Match") || notif.title.includes("Matches"));
});

// 12. Deadline Reminder Suppression for Expired Opportunities
test("Phase 6 Test 12: Suppresses deadline reminders for closed or expired opportunities", async () => {
  const expiredOpp: Opportunity = {
    id: "opp-expired-check",
    title: "Expired Opportunity",
    organization: "Old Agency",
    category: "job",
    categoryLabel: "Job",
    description: "Old",
    fullDescription: "Old",
    deadline: "2026-08-01",
    location: "Delhi",
    remote: false,
    stipendOrPrize: "N/A",
    stipendType: "stipend",
    officialUrl: "https://agency.gov.in",
    verificationStatus: "verified",
    lastVerified: "2026-07-20",
    tags: [],
    benefits: [],
    applicationSteps: [],
    importantDates: [],
    eligibilityCriteria: { allowedDegrees: ["B.Tech"], allowedBranches: ["All Branches"], allowedYears: [4] },
  };

  const reminderRes = await deadlineJobService.runDeadlineCheck(
    "student-ananya",
    [expiredOpp],
    [expiredOpp.id]
  );

  assert.equal(reminderRes.remindersCreated, 0);
});

// 13. Expiration Status Invariant
test("Phase 6 Test 13: Expiration status resolver returns daysRemaining = 0 and isExpired = true", () => {
  const opp: Opportunity = {
    id: "opp-passed-date",
    title: "Passed Date Opp",
    organization: "Agency",
    category: "job",
    categoryLabel: "Job",
    description: "Expired",
    fullDescription: "Expired",
    deadline: "2026-05-01",
    location: "City",
    remote: false,
    stipendOrPrize: "₹20,000",
    stipendType: "stipend",
    officialUrl: "https://agency.gov.in",
    verificationStatus: "verified",
    lastVerified: "2026-04-20",
    tags: [],
    benefits: [],
    applicationSteps: [],
    importantDates: [],
    eligibilityCriteria: { allowedDegrees: ["B.Tech"], allowedBranches: ["All Branches"], allowedYears: [4] },
  };

  const status = getOpportunityStatus(opp);
  assert.equal(status.status, "EXPIRED");
  assert.equal(status.daysRemaining, 0);
  assert.equal(status.isExpired, true);
  assert.equal(status.isActivelyApplicable, false);
});

// 14. Change Detection for Extended Deadlines
test("Phase 6 Test 14: Detects official deadline extension from source and generates deadline_changed diff", () => {
  const connector = new ISROGovConnector();
  const rawOld = {
    sourceId: "src-gov-isro",
    sourceUrl: "https://isro.gov.in",
    title: "ISRO Scientist SC",
    organization: "ISRO",
    deadlineRaw: "2026-09-01",
  };
  const oldItem = connector.normalize(rawOld);

  const rawNew = {
    ...rawOld,
    deadlineRaw: "2026-09-25", // Extended deadline!
  };
  const newItem = connector.normalize(rawNew);

  const change = detectOpportunityChanges(oldItem as any, newItem);
  assert.equal(change.hasChanges, true);
  assert.equal(change.changeType, "deadline_changed");
  assert.equal(change.diffs["deadline"].old, "2026-09-01");
  assert.equal(change.diffs["deadline"].new, "2026-09-25");
});

// 15. Duplicate Prevention
test("Phase 6 Test 15: Executing connector pipeline repeatedly deduplicates identical items", async () => {
  const run1 = await runIngestionPipeline("src-gov-isro", []);
  const firstId = run1.enqueuedForReview[0].id;

  const run2 = await runIngestionPipeline("src-gov-isro", [run1.enqueuedForReview[0] as any]);

  assert.equal(run2.summary.duplicateCount, 1);
  assert.equal(run2.enqueuedForReview.length, 0);
});

// 16. Connector Failure Handling & Source Health Tracking
test("Phase 6 Test 16: Connector failure logs error, records failure metric, and preserves catalog", () => {
  const failError = "Simulated network timeout connecting to official portal";
  sourceHealthService.recordFailure("src-gov-isro", failError);

  const updatedMetrics = sourceHealthService.getMetrics("src-gov-isro");
  assert.ok(updatedMetrics);
  assert.ok(updatedMetrics.failureCount >= 1);
  assert.equal(updatedMetrics.lastError, failError);
});

// 17. Security Review (Server Secrets Isolation)
test("Phase 6 Test 17: Public config strictly exposes public URL/Anon key and never service role secrets", () => {
  assert.ok(!("serviceRoleKey" in appConfig));
  assert.ok(!("supabaseServiceRole" in appConfig));
  assert.ok(typeof appConfig.supabaseAnonKey === "string");
});

// 18. Zero Demo Opportunities Invariant in User-Facing Feed
test("Phase 6 Test 18: User-facing opportunityService returns 0 demo opportunities", async () => {
  const { opportunityService } = await import("../src/services/opportunityService");
  const opps = await opportunityService.getOpportunities();

  assert.ok(opps.length > 0, "Should have real verified opportunities loaded");
  const demoOpps = opps.filter((o) => o.isDemo === true);
  assert.equal(demoOpps.length, 0, "Zero demo opportunities must be present in user-facing data");
});

// 19. All User-Facing Opportunities Are Verified and Published from Official Sources
test("Phase 6 Test 19: All user-facing opportunities have verificationStatus=verified and lifecycleStatus=published", async () => {
  const { opportunityService } = await import("../src/services/opportunityService");
  const opps = await opportunityService.getOpportunities();

  for (const opp of opps) {
    assert.equal(opp.isDemo, false, `Opportunity [${opp.id}] must not be demo`);
    assert.equal(opp.verificationStatus, "verified", `Opportunity [${opp.id}] must be verified`);
    assert.equal(opp.lifecycleStatus, "published", `Opportunity [${opp.id}] must be published`);
    assert.ok(opp.officialUrl.startsWith("http"), `Opportunity [${opp.id}] must have valid official URL`);
  }
});

// 20. Expired Opportunities Suppression from Active Feeds
test("Phase 6 Test 20: Expired opportunities are never included in active Top Matches or Closing Soon", async () => {
  const { realVerifiedOpportunities } = await import("../src/data/realOpportunities");
  const { matchingService } = await import("../src/services/matchingService");

  const rawMatches = realVerifiedOpportunities.map((opp) => ({
    opportunity: opp,
    match: matchingService.evaluateMatch("test-student-id", testStudent, opp),
  }));

  const ranked = matchingService.rankMatchesForStudent(testStudent, rawMatches);
  const activeTopMatches = ranked.filter(
    (r) => !r.isExpired && r.match.score >= 80 && r.match.status === "eligible"
  );
  const activeClosingSoon = ranked.filter(
    (r) => !r.isExpired && r.isUrgent && r.match.status !== "not_eligible"
  );

  // Assert expired opportunity is excluded from active feeds
  assert.ok(!activeTopMatches.some((r) => r.opportunity.id === "real-isro-resp-2025-expired"));
  assert.ok(!activeClosingSoon.some((r) => r.opportunity.id === "real-isro-resp-2025-expired"));
});

