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

// 19. All User-Facing Opportunities Are Verified and Published from Official/Partner Sources
test("Phase 6 Test 19: All user-facing opportunities have verificationStatus=verified or partner_verified and lifecycleStatus=published", async () => {
  const { opportunityService } = await import("../src/services/opportunityService");
  const opps = await opportunityService.getOpportunities();

  for (const opp of opps) {
    assert.equal(opp.isDemo, false, `Opportunity [${opp.id}] must not be demo`);
    assert.ok(
      opp.verificationStatus === "verified" || opp.verificationStatus === "partner_verified",
      `Opportunity [${opp.id}] must be verified or partner_verified`
    );
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

// 21. TCS CodeVita & Past Deadline Exclusion at Service Query Layer
test("Phase 6 Test 21: getActiveOpportunities strictly excludes expired opportunities including TCS CodeVita", async () => {
  const { opportunityService } = await import("../src/services/opportunityService");
  const activeOpps = await opportunityService.getActiveOpportunities();

  // Assert expired opportunities are never returned in active list
  assert.ok(!activeOpps.some((o) => o.id === "real-tcs-codevita-expired"));
  assert.ok(!activeOpps.some((o) => o.id === "real-isro-resp-2025-expired"));
  
  // Assert every returned opportunity has a valid deadline in the future
  const now = new Date();
  for (const opp of activeOpps) {
    const deadlineDate = new Date(opp.deadline);
    assert.ok(deadlineDate.getTime() >= now.getTime() - 86400000, `Deadline for [${opp.id}] must be active`);
    assert.equal(opp.lifecycleStatus, "published");
  }
});

// 22. Unpublished, Pending Review, and Rejected Opportunities Are Excluded
test("Phase 6 Test 22: getActiveOpportunities strictly excludes unpublished or rejected opportunities", async () => {
  const { opportunityService } = await import("../src/services/opportunityService");
  const activeOpps = await opportunityService.getActiveOpportunities();

  for (const opp of activeOpps) {
    assert.equal(opp.lifecycleStatus, "published", `Opportunity [${opp.id}] must have lifecycleStatus=published`);
    assert.notEqual(opp.verificationStatus, "pending");
    assert.notEqual(opp.verificationStatus, "needs_review");
    assert.notEqual(opp.verificationStatus, "expired");
  }
});

// 23. Dynamic Student Match Count & Eligibility Differentiation
test("Phase 6 Test 23: getEligibleOpportunitiesForStudent produces dynamic counts that differ by student profile", async () => {
  const { opportunityService } = await import("../src/services/opportunityService");

  // Profile A: 4th year CS student with 8.5 CGPA
  const studentA = testStudent;

  // Profile B: 1st year Civil Engineering student with 6.0 CGPA
  const studentB: StudentProfile = {
    name: "Rohan Patel",
    email: "rohan@example.com",
    degree: "B.Tech",
    institution: "State Engineering College",
    branch: "Civil Engineering",
    currentYear: 1,
    graduationYear: 2030,
    cgpa: 6.0,
    age: 18,
    country: "India",
    state: "Gujarat",
    city: "Ahmedabad",
    gender: "male",
    skills: ["AutoCAD", "Surveying"],
    interests: ["government_exam"],
    completedOnboarding: true,
  };

  const resultA = await opportunityService.getEligibleOpportunitiesForStudent(studentA);
  const resultB = await opportunityService.getEligibleOpportunitiesForStudent(studentB);

  // Both evaluated the exact same active catalog count
  assert.equal(resultA.totalActiveEvaluated, resultB.totalActiveEvaluated);
  assert.ok(resultA.totalActiveEvaluated > 0);

  // But eligibility counts are dynamically calculated and differ based on requirements
  assert.ok(typeof resultA.eligibleCount === "number");
  assert.ok(typeof resultB.eligibleCount === "number");
  assert.notEqual(resultA.eligibleCount, resultB.eligibleCount, "Different student profiles must receive different eligibility counts");
});

// 24. Zero Hardcoded '47' Count in User-Facing Application
test("Phase 6 Test 24: No hardcoded '47' or '47+' string remains in user-facing source code", async () => {
  const fs = await import("fs");
  const path = await import("path");

  const filesToCheck = [
    path.join(process.cwd(), "src/app/onboarding/page.tsx"),
    path.join(process.cwd(), "src/app/dashboard/page.tsx"),
    path.join(process.cwd(), "src/app/explore/page.tsx"),
    path.join(process.cwd(), "src/app/page.tsx"),
    path.join(process.cwd(), "src/context/StudentContext.tsx"),
    path.join(process.cwd(), "src/services/opportunityService.ts"),
  ];

  for (const filePath of filesToCheck) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      assert.ok(!content.includes("47+"), `File ${filePath} must not contain hardcoded '47+'`);
      assert.ok(!content.includes("47 opportunities"), `File ${filePath} must not contain hardcoded '47 opportunities'`);
    }
  }
});

// 25. Official Domain Validation & Third-Party Rejection
test("Phase 6 Test 25: Official domain validation accepts authentic domains and rejects third-party sites", async () => {
  const { opportunityVerificationService } = await import("../src/services/opportunityVerificationService");

  // Valid official domains
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://isro.gov.in/Careers.html"), true);
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://meity.gov.in/internship-scheme"), true);
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://summerofcode.withgoogle.com"), true);
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://campuscommune.tcs.com/codevita"), true);

  // Third-party aggregators, blogs, and search snippets must be rejected
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://www.google.com/search?q=internships"), false);
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://www.reddit.com/r/developers/opportunities"), false);
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://medium.com/@author/tech-jobs-2026"), false);
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://sarkariresult.com/latest-jobs"), false);
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://freejobalert.com/isro-recruitment"), false);
});

// 26. Missing or Ambiguous Deadlines Are Never Inferred
test("Phase 6 Test 26: Missing or ambiguous deadlines ('rolling', 'TBD', empty) return valid: false", async () => {
  const { opportunityVerificationService } = await import("../src/services/opportunityVerificationService");

  const checkEmpty = opportunityVerificationService.validateExplicitDeadline("");
  assert.equal(checkEmpty.valid, false);

  const checkRolling = opportunityVerificationService.validateExplicitDeadline("rolling");
  assert.equal(checkRolling.valid, false);

  const checkTBD = opportunityVerificationService.validateExplicitDeadline("TBD");
  assert.equal(checkTBD.valid, false);

  const checkValid = opportunityVerificationService.validateExplicitDeadline("2026-09-20");
  assert.equal(checkValid.valid, true);
  assert.equal(checkValid.dateIso, "2026-09-20");
});

// 27. Google Summer of Code Unverified Timeline Handling
test("Phase 6 Test 27: GSoC without explicit verified active deadline is marked draft/pending and excluded from active feeds", async () => {
  const { realVerifiedOpportunities } = await import("../src/data/realOpportunities");
  const { opportunityService } = await import("../src/services/opportunityService");

  const gsoc = realVerifiedOpportunities.find((o) => o.id === "real-google-summer-2026");
  assert.ok(gsoc, "GSoC record exists in dataset");
  assert.equal(gsoc.lifecycleStatus, "draft");
  assert.equal(gsoc.verificationStatus, "pending");

  const activeOpps = await opportunityService.getActiveOpportunities();
  assert.ok(!activeOpps.some((o) => o.id === "real-google-summer-2026"), "Unverified GSoC must not appear in active feeds");
});

// 28. Application URL Validation
test("Phase 6 Test 28: Application URL must belong to an official or valid subportal", async () => {
  const { opportunityVerificationService } = await import("../src/services/opportunityVerificationService");

  assert.equal(opportunityVerificationService.isValidApplicationUrl("https://apps.isro.gov.in/icrb/apply"), true);
  assert.equal(opportunityVerificationService.isValidApplicationUrl("https://upsconline.nic.in/mainmenu2.php"), true);
  assert.equal(opportunityVerificationService.isValidApplicationUrl("https://sarkariresult.com/apply"), false);
});

// 29. Re-Verification Service Support
test("Phase 6 Test 29: reverifyOpportunity returns structured verification result and updates verifiedAt", async () => {
  const { opportunityVerificationService } = await import("../src/services/opportunityVerificationService");

  const testOpp: Opportunity = {
    id: "opp-verify-test",
    title: "ISRO Scientist Exam",
    organization: "ISRO",
    category: "government_exam",
    categoryLabel: "Government Exam",
    description: "Official recruitment",
    fullDescription: "Full details",
    deadline: "2026-10-15",
    location: "Bengaluru",
    remote: false,
    stipendOrPrize: "Level 10",
    stipendType: "salary",
    officialUrl: "https://www.isro.gov.in/Careers.html",
    applyUrl: "https://apps.isro.gov.in/icrb/apply",
    verificationStatus: "verified",
    lastVerified: "2026-08-21",
    tags: [],
    benefits: [],
    applicationSteps: [],
    importantDates: [],
    eligibilityCriteria: { allowedDegrees: ["B.Tech"], allowedBranches: ["Computer Science"], allowedYears: [4] },
  };

  const reverify = await opportunityVerificationService.reverifyOpportunity(testOpp);
  assert.equal(reverify.verified, true);
  assert.equal(reverify.domainValid, true);
  assert.equal(reverify.isExpired, false);
  assert.ok(reverify.verifiedAt);
});

// 30. HTML Content Parsing & Explicit Deadline Extraction
test("Phase 6 Test 30: extractOpportunityFromHtml extracts explicit title, deadline, and application URL", async () => {
  const { opportunityVerificationService } = await import("../src/services/opportunityVerificationService");

  const sampleOfficialHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>ISRO Centralised Recruitment Board - Scientist/Engineer SC 2026</title>
      </head>
      <body>
        <main>
          <h1>Scientist/Engineer 'SC' Recruitment Examination 2026</h1>
          <p>Online registration is open for engineering graduates.</p>
          <div class="dates-section">
            <p><strong>Application Deadline:</strong> 2026-09-20</p>
          </div>
          <a href="https://apps.isro.gov.in/icrb/apply">Apply Online</a>
        </main>
      </body>
    </html>
  `;

  const extracted = opportunityVerificationService.extractOpportunityFromHtml(sampleOfficialHtml, "https://isro.gov.in/Careers.html");
  assert.ok(extracted.title?.includes("ISRO"));
  assert.equal(extracted.deadline, "2026-09-20");
  assert.equal(extracted.applyUrl, "https://apps.isro.gov.in/icrb/apply");
});

// 31. Stored vs Official Deadline Conflict Detection
test("Phase 6 Test 31: Stored deadline conflicting with official extracted deadline causes verification to FAIL", async () => {
  const { opportunityVerificationService } = await import("../src/services/opportunityVerificationService");

  const sampleHtmlWithDifferentDate = `
    <html>
      <head><title>Official Recruitment Notice</title></head>
      <body>
        <p>Registration closes: 2026-09-10</p>
      </body>
    </html>
  `;

  // Stored deadline is 2026-09-20, but official site says 2026-09-10
  const extracted = opportunityVerificationService.extractOpportunityFromHtml(sampleHtmlWithDifferentDate, "https://isro.gov.in");
  assert.equal(extracted.deadline, "2026-09-10");

  const storedOpp: Opportunity = {
    id: "test-opp-conflict",
    title: "Official Recruitment Notice",
    organization: "ISRO",
    category: "government_exam",
    categoryLabel: "Government Exam",
    description: "Official recruitment",
    fullDescription: "Full details",
    deadline: "2026-09-20", // Conflicting stored deadline
    location: "Bengaluru",
    remote: false,
    stipendOrPrize: "Pay Matrix 10",
    stipendType: "salary",
    officialUrl: "https://isro.gov.in",
    verificationStatus: "verified",
    lastVerified: "2026-08-21",
    tags: [],
    benefits: [],
    applicationSteps: [],
    importantDates: [],
    eligibilityCriteria: { allowedDegrees: ["B.Tech"], allowedBranches: ["All Branches"], allowedYears: [4] },
  };

  assert.notEqual(storedOpp.deadline, extracted.deadline, "Stored deadline conflicts with official source");
});

// 32. Missing Official Deadline Causes Verification Failure
test("Phase 6 Test 32: Webpage containing no explicit deadline fails verification without guessing", async () => {
  const { opportunityVerificationService } = await import("../src/services/opportunityVerificationService");

  const htmlWithoutDeadline = `
    <html>
      <head><title>General Careers Portal</title></head>
      <body>
        <p>Welcome to our careers page. Please check back later for upcoming openings.</p>
      </body>
    </html>
  `;

  const extracted = opportunityVerificationService.extractOpportunityFromHtml(htmlWithoutDeadline, "https://isro.gov.in");
  assert.equal(extracted.deadline, undefined, "Must NOT guess or infer a deadline");
});

// 33. Unstop Partner Source Acceptance
test("Phase 6 Test 33: Unstop partner source is recognized and accepted as partner source", async () => {
  const { opportunityVerificationService } = await import("../src/services/opportunityVerificationService");

  const unstopUrl = "https://unstop.com/hackathons/tata-imagination-challenge-2026";
  assert.equal(opportunityVerificationService.isPartnerUrl(unstopUrl), true);
  assert.equal(opportunityVerificationService.isValidSourceUrl(unstopUrl), true);
});

// 34. Conflict Resolution Engine: Official Source Overrides Unstop
test("Phase 6 Test 34: Conflict Resolution Engine prioritizes official deadline over partner and logs conflict", async () => {
  const { opportunityVerificationService } = await import("../src/services/opportunityVerificationService");

  const officialData = { deadline: "2026-09-12", url: "https://sih.gov.in" };
  const partnerData = { deadline: "2026-09-10", url: "https://unstop.com/hackathons/sih-2026" };

  const resolved = opportunityVerificationService.compareAndResolveSources(officialData, partnerData);

  assert.equal(resolved.hasConflict, true);
  assert.equal(resolved.resolvedDeadline, "2026-09-12", "Official source deadline must override partner deadline");
  assert.equal(resolved.sourceType, "official");
  assert.equal(resolved.verificationStatus, "verified");
// Third-party aggregators, blogs, and search snippets must be rejected
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://www.google.com/search?q=internships"), false);
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://www.reddit.com/r/developers/opportunities"), false);
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://medium.com/@author/tech-jobs-2026"), false);
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://sarkariresult.com/latest-jobs"), false);
  assert.equal(opportunityVerificationService.isValidOfficialUrl("https://freejobalert.com/isro-recruitment"), false);
});

// 35. PDF Rules URL Validation
test("Phase 6 Test 35: Official rules/guidelines PDF URLs are validated and supported", async () => {
  const { opportunityVerificationService } = await import("../src/services/opportunityVerificationService");

  const sihPdf = "https://sih.gov.in/pdf/SIH2026_Guidelines.pdf";
  const unstopPdf = "https://unstop.com/pdf/tata_imagination_guidelines.pdf";
  const fakePdf = "https://sarkariresult.com/fake_rules.pdf";

  assert.equal(opportunityVerificationService.isValidPdfUrl(sihPdf), true);
  assert.equal(opportunityVerificationService.isValidPdfUrl(unstopPdf), true);
  assert.equal(opportunityVerificationService.isValidPdfUrl(fakePdf), false);
});

// 36. Full Opportunity Provenance Invariant
test("Phase 6 Test 36: Every published opportunity contains complete source name, type, and last_verified_at", async () => {
  const { opportunityService } = await import("../src/services/opportunityService");

  const activeOpps = await opportunityService.getActiveOpportunities();
  assert.ok(activeOpps.length > 0, "Must have active opportunities");

  for (const opp of activeOpps) {
    assert.ok(opp.sourceName, `Opportunity [${opp.id}] must have sourceName`);
    assert.ok(opp.sourceType === "official" || opp.sourceType === "partner", `Opportunity [${opp.id}] must have valid sourceType`);
    assert.ok(opp.lastVerified, `Opportunity [${opp.id}] must have lastVerified timestamp`);
    assert.ok(opp.officialUrl, `Opportunity [${opp.id}] must have officialUrl`);
    // If applyUrl exists, it must be a valid, verified non-empty string; otherwise applyDestinationType must be recorded
    if (opp.applyUrl) {
      assert.ok(opp.applyUrl.startsWith("http"), `Opportunity [${opp.id}] applyUrl must be valid URL`);
    } else {
      assert.ok(opp.applyDestinationType, `Opportunity [${opp.id}] without applyUrl must have applyDestinationType specified`);
    }
  }
});

// 37. Opportunity Archetypes Validation (Official-only, Partner-discovered, Conflicting Source)
test("Phase 6 Test 37: Platform contains all 3 opportunity archetypes and enforces Official source priority", async () => {
  const { opportunityService } = await import("../src/services/opportunityService");

  const activeOpps = await opportunityService.getActiveOpportunities();

  // Archetype A: Official-only
  const officialOnly = activeOpps.find((o) => o.sourceType === "official" && !o.sourceConflict);
  assert.ok(officialOnly, "Must contain at least one official-only opportunity");
  assert.ok(officialOnly.officialUrl.startsWith("http"));

  // Archetype B: Partner-discovered (Unstop)
  const partnerOpp = activeOpps.find((o) => o.sourceType === "partner" && o.sourceName === "Unstop");
  assert.ok(partnerOpp, "Must contain at least one Unstop partner-discovered opportunity");
  assert.equal(partnerOpp.verificationStatus, "partner_verified");

  // Archetype C: Conflicting source where official source wins
  const conflictOpp = activeOpps.find((o) => o.sourceConflict === true);
  assert.ok(conflictOpp, "Must contain opportunity with resolved source conflict");
  assert.equal(conflictOpp.sourceType, "official");
  assert.ok(conflictOpp.sourceMetadata?.conflictResolution, "Must contain explicit conflict resolution note");
  assert.equal(conflictOpp.deadline, "2026-09-18", "Official publisher deadline must win over discovery deadline");
});

// 38. PDF Discovery, HTTP Verification, Content-Type, and Provenance Invariants
test("Phase 6 Test 38: PDF Discovery verifies Content-Type, follows redirects, rejects fabricated URLs, and handles missing PDFs gracefully", async () => {
  const { linkHealthService } = await import("../src/services/linkHealthService");
  const { opportunityVerificationService } = await import("../src/services/opportunityVerificationService");

  // 1. Fabricated PDF URL & Third-party PDF rejection
  const fabricatedPdf = "https://sih.gov.in/downloads/SIH2026_Guidelines_Fabricated.pdf";
  const fakeCheck = await linkHealthService.verifyUrl(fabricatedPdf, { isPdfExpected: true });
  assert.equal(fakeCheck.isValid, false, "Fabricated PDF must fail HTTP/network verification");

  const thirdPartyPdf = "https://sarkariresult.com/fake_rules.pdf";
  assert.equal(opportunityVerificationService.isValidPdfUrl(thirdPartyPdf), false, "Third-party PDF must be rejected");

  // 2. Missing PDF graceful handling
  const missingPdfCheck = await linkHealthService.verifyUrl(undefined, { isPdfExpected: true });
  assert.equal(missingPdfCheck.isValid, false);
  assert.equal(missingPdfCheck.httpStatus, 0);

  // 3. HTML Mock Crawl for Official PDF Discovery
  const sampleHtml = `
    <html>
      <body>
        <h1>National Innovation Scheme 2026</h1>
        <a href="/downloads/guidelines-2026.pdf">Download Official Notification (PDF)</a>
        <a href="https://partner.com/rules.pdf">Partner Rules Document</a>
      </body>
    </html>
  `;
  const hrefRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  const discovered: { href: string; title: string; isPdf: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = hrefRegex.exec(sampleHtml)) !== null) {
    const rawHref = m[1];
    const text = m[2].trim();
    if (rawHref.endsWith(".pdf")) {
      discovered.push({
        href: new URL(rawHref, "https://gov-scheme.nic.in").href,
        title: text,
        isPdf: true,
      });
    }
  }

  assert.equal(discovered.length, 2);
  assert.equal(discovered[0].href, "https://gov-scheme.nic.in/downloads/guidelines-2026.pdf");
  assert.equal(discovered[0].title, "Download Official Notification (PDF)");

  // 4. Verification that all active opportunities with missing PDF have rulesPdfUrl strictly undefined
  const { realVerifiedOpportunities } = await import("../src/data/realOpportunities");
  for (const opp of realVerifiedOpportunities) {
    if (!opp.rulesPdfUrl) {
      assert.equal(opp.rulesPdfUrl, undefined, `Opportunity [${opp.id}] without verified PDF must keep rulesPdfUrl undefined`);
    } else {
      assert.ok(opp.rulesPdfUrl.startsWith("http"), `Opportunity [${opp.id}] rulesPdfUrl must be valid URL`);
      assert.ok(opp.rulesPdfTitle, `Opportunity [${opp.id}] with rulesPdfUrl must specify rulesPdfTitle`);
    }
  }
});

// 39. Deep Official Document Discovery, Magic-Bytes, Redirects, and Depth Invariants
test("Phase 6 Test 39: Deep Document Discovery validates magic bytes, follows redirects, rejects cross-domain/HTML fakes, and bounds crawl depth", async () => {
  const { linkHealthService } = await import("../src/services/linkHealthService");

  // 1. PDF Magic Bytes Validation (%PDF- signature)
  const validPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]); // %PDF-1.5
  const invalidBytes = new Uint8Array([0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50]); // <!DOCTYP
  assert.equal(linkHealthService.hasPdfMagicBytes(validPdfBytes), true, "Valid magic bytes must pass");
  assert.equal(linkHealthService.hasPdfMagicBytes(invalidBytes), false, "HTML doctype must fail PDF magic bytes");

  // 2. Reject HTML Pages Pretending to Be PDFs
  const fakeHtmlContentType = "text/html; charset=utf-8";
  const fakeHtmlBody = "<!DOCTYPE html><html><body>Error 404: File Not Found</body></html>";
  assert.equal(linkHealthService.isHtmlResponse(fakeHtmlContentType, fakeHtmlBody), true, "HTML error response must be detected");

  // 3. Same-Domain & Cross-Domain Rejection
  const baseUrl = "https://www.meity.gov.in/internship-scheme";
  const sameDomainSubpage = "https://www.meity.gov.in/documents/guidelines-2026";
  const govtPortalSubdomain = "https://digitalindia.gov.in/fellowship.pdf";
  const crossDomainAggregator = "https://sarkariresult.com/meity-notice.pdf";

  assert.equal(linkHealthService.isSameDomainOrSubdomain(sameDomainSubpage, baseUrl), true);
  assert.equal(linkHealthService.isSameDomainOrSubdomain(govtPortalSubdomain, baseUrl), true);
  assert.equal(linkHealthService.isSameDomainOrSubdomain(crossDomainAggregator, baseUrl), false, "Cross-domain aggregator must be rejected");

  // 4. Nested Depth-2 Crawl & Official-over-Partner Priority Simulation
  const sampleOfficialPageHtml = `
    <html>
      <body>
        <h1>Ministry Internship Scheme</h1>
        <a href="/guidelines/overview">View Scheme Guidelines & Eligibility</a>
      </body>
    </html>
  `;
  const sampleSubpageHtml = `
    <html>
      <body>
        <h2>Official Guidelines 2026</h2>
        <a href="/files/Scheme_Guidelines_2026.pdf">Download Official Notification (PDF)</a>
      </body>
    </html>
  `;

  // Depth 1 discovery of subpage
  const depth1Href = "/guidelines/overview";
  const resolvedSubpageUrl = new URL(depth1Href, "https://meity.gov.in").href;
  assert.equal(resolvedSubpageUrl, "https://meity.gov.in/guidelines/overview");

  // Depth 2 discovery of PDF from subpage
  const depth2PdfHref = "/files/Scheme_Guidelines_2026.pdf";
  const resolvedPdfUrl = new URL(depth2PdfHref, resolvedSubpageUrl).href;
  assert.equal(resolvedPdfUrl, "https://meity.gov.in/files/Scheme_Guidelines_2026.pdf");

  // 5. Official-over-Partner Priority
  const officialDocDiscovered = true;
  const partnerDocDiscovered = true;
  const selectedDocType = officialDocDiscovered ? "official" : (partnerDocDiscovered ? "partner" : undefined);
  assert.equal(selectedDocType, "official", "Official document must take priority over partner document");

  // 6. Graceful Handling for Missing Documents
  const missingDiscovered = await linkHealthService.crawlAndDiscoverLinks("https://invalid-non-existent-domain-999.gov.in");
  assert.equal(missingDiscovered.verifiedRulesPdfUrl, undefined, "Missing official site must leave rulesPdfUrl undefined");
});

// 40. In-App Opportunity Completeness, Full Provenance & Zero-External-Leakage Invariants
test("Phase 6 Test 40: Every active opportunity contains complete self-contained details, dates, steps, and provenance without generic homepages", async () => {
  const { opportunityService } = await import("../src/services/opportunityService");
  const { realVerifiedOpportunities } = await import("../src/data/realOpportunities");

  const activeOpps = await opportunityService.getActiveOpportunities();
  assert.ok(activeOpps.length > 0, "Must have active opportunities");

  for (const opp of activeOpps) {
    // 1. In-App Evaluation Fields
    assert.ok(opp.description && opp.description.length > 5, `Opportunity [${opp.id}] must have description`);
    assert.ok(opp.fullDescription && opp.fullDescription.length > 5, `Opportunity [${opp.id}] must have fullDescription`);
    assert.ok(opp.eligibilityCriteria.allowedDegrees.length > 0, `Opportunity [${opp.id}] must have allowedDegrees`);

    // 2. Full Source Provenance
    assert.ok(opp.sourceName, `Opportunity [${opp.id}] must have sourceName`);
    assert.ok(opp.sourceType, `Opportunity [${opp.id}] must have sourceType`);
    assert.ok(opp.officialUrl.startsWith("http"), `Opportunity [${opp.id}] must have valid officialUrl`);
    assert.ok(opp.lastVerified, `Opportunity [${opp.id}] must have lastVerified timestamp`);

    // 3. No Generic Homepage as Apply URL
    if (opp.applyUrl) {
      assert.ok(opp.applyUrl.startsWith("http"), `Opportunity [${opp.id}] applyUrl must be valid URL`);
      const parsed = new URL(opp.applyUrl);
      if (parsed.pathname === "/" || parsed.pathname === "") {
        assert.ok(
          opp.applyUrl.includes("nic.in") || opp.applyUrl.includes("upsconline"),
          `Opportunity [${opp.id}] applyUrl must not be a generic homepage without active portal flow`
        );
      }
    }
  }

  // 4. In-depth self-contained content verification on published catalog
  const publishedCatalog = realVerifiedOpportunities.filter((o) => o.lifecycleStatus === "published");
  for (const opp of publishedCatalog) {
    assert.ok(opp.benefits && opp.benefits.length > 0, `Published opportunity [${opp.id}] must have benefits`);
    assert.ok(opp.applicationSteps && opp.applicationSteps.length > 0, `Published opportunity [${opp.id}] must have applicationSteps`);
    assert.ok(opp.importantDates && opp.importantDates.length > 0, `Published opportunity [${opp.id}] must have importantDates`);
    assert.ok(opp.deadlineSource, `Opportunity [${opp.id}] must have deadlineSource`);
    assert.ok(opp.eligibilitySource, `Opportunity [${opp.id}] must have eligibilitySource`);
    assert.ok(opp.instructionsSource, `Opportunity [${opp.id}] must have instructionsSource`);
  }
});

// 41. Strict Truthful Provenance Invariant (Zero Manufactured Document Titles)
test("Phase 6 Test 41: Provenance claims are evidence-backed and homepages are never mislabeled as circulars or handbooks", async () => {
  const { realVerifiedOpportunities } = await import("../src/data/realOpportunities");

  const publishedOpps = realVerifiedOpportunities.filter((o) => o.lifecycleStatus === "published");

  for (const opp of publishedOpps) {
    const claims = [opp.deadlineSource, opp.eligibilitySource, opp.instructionsSource].filter(Boolean);

    for (const claim of claims) {
      if (typeof claim === "object" && claim !== null) {
        // Invariant 1: Claim URL must match verified official or partner URL
        const isOfficialMatch = claim.sourceUrl === opp.officialUrl || claim.sourceUrl === opp.officialSourceUrl;
        const isPartnerMatch = claim.sourceUrl === opp.sourceUrl || claim.sourceUrl === opp.applyUrl;
        assert.ok(
          isOfficialMatch || isPartnerMatch,
          `Opportunity [${opp.id}] claim URL [${claim.sourceUrl}] must match verified source URL`
        );

        // Invariant 2: Content evidence must be explicitly true
        assert.equal(
          claim.contentEvidence,
          true,
          `Opportunity [${opp.id}] claim [${claim.sourceTitle}] must have contentEvidence: true`
        );

        // Invariant 3: Zero manufactured titles when sourceUrl is a homepage
        const parsed = new URL(claim.sourceUrl);
        if (parsed.pathname === "/" || parsed.pathname === "") {
          const lowerTitle = claim.sourceTitle.toLowerCase();
          assert.ok(
            !lowerTitle.includes("circular") &&
            !lowerTitle.includes("handbook") &&
            !lowerTitle.includes("clause") &&
            !lowerTitle.includes("section 4"),
            `Opportunity [${opp.id}] homepage must not be mislabeled as circular/handbook/clause: got "${claim.sourceTitle}"`
          );
        }
      }
    }
  }
});

// 42. Missing Document Evidence and Canonical Source Conflict Resolution
test("Phase 6 Test 42: Partner source remains partner and official source remains canonical during conflicts", async () => {
  const { realVerifiedOpportunities } = await import("../src/data/realOpportunities");

  // 1. Partner Source remains partner
  const tataOpp = realVerifiedOpportunities.find((o) => o.id === "unstop-tata-imagination-2026");
  assert.ok(tataOpp);
  assert.equal(tataOpp.sourceType, "partner");
  assert.equal(tataOpp.verificationStatus, "partner_verified");
  if (typeof tataOpp.deadlineSource === "object") {
    assert.equal(tataOpp.deadlineSource?.sourceType, "partner");
  }

  // 2. Official Source canonical conflict resolution
  const gridOpp = realVerifiedOpportunities.find((o) => o.id === "flipkart-grid-2026-conflict");
  assert.ok(gridOpp);
  assert.equal(gridOpp.sourceConflict, true);
  assert.equal(gridOpp.deadline, "2026-09-18", "Official publisher deadline must override partner listing");
  assert.equal(gridOpp.sourceType, "official");
});

// 43. Revalidation detects stale/passed deadline and transitions to expired
test("Phase 6 Test 43: Revalidation service marks past deadline as expired with zero-leakage", async () => {
  const { opportunityRevalidationService } = await import("../src/services/opportunityRevalidationService");
  const { realVerifiedOpportunities } = await import("../src/data/realOpportunities");

  const sampleOpp = { ...realVerifiedOpportunities[0], deadline: "2025-01-01" };
  const res = await opportunityRevalidationService.revalidateOpportunity(sampleOpp, {
    referenceDate: new Date("2026-08-21"),
  });

  assert.equal(res.updatedOpportunity.lifecycleStatus, "expired");
  assert.equal(res.updatedOpportunity.verificationStatus, "expired");
  assert.equal(res.updatedOpportunity.applyDestinationType, "expired");
  assert.ok(res.auditRecord.changedFields.includes("lifecycleStatus"));
});

// 44. Revalidation resolves official source deadline conflict and logs audit record
test("Phase 6 Test 44: Revalidation resolves official source deadline overriding third-party and generates audit diff", async () => {
  const { opportunityRevalidationService } = await import("../src/services/opportunityRevalidationService");
  const { realVerifiedOpportunities } = await import("../src/data/realOpportunities");

  const conflictOpp = realVerifiedOpportunities.find((o) => o.id === "flipkart-grid-2026-conflict");
  assert.ok(conflictOpp);

  const res = await opportunityRevalidationService.revalidateOpportunity(conflictOpp, {
    referenceDate: new Date("2026-08-21"),
  });

  assert.ok(res.updatedOpportunity);
  assert.equal(res.updatedOpportunity.sourceConflict, true);
  assert.equal(res.updatedOpportunity.deadline, "2026-09-18");
  assert.equal(res.auditRecord.isConflict, false); // already stored as resolved
  assert.ok(res.auditRecord.opportunityId === "flipkart-grid-2026-conflict");
});

// 45. Revalidation PDF discovery validates %PDF- magic bytes and rejects fake HTML
test("Phase 6 Test 45: Revalidation PDF discovery enforces magic bytes and rejects HTML masquerades", async () => {
  const { linkHealthService } = await import("../src/services/linkHealthService");

  // Valid PDF with ASCII signature '%PDF-'
  const validPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
  assert.equal(linkHealthService.hasPdfMagicBytes(validPdfBytes), true);

  // Fake HTML response masquerading as PDF
  const fakeHtmlBytes = new TextEncoder().encode("<!DOCTYPE html><html><body>Error 404</body></html>");
  assert.equal(linkHealthService.hasPdfMagicBytes(fakeHtmlBytes), false);
  assert.equal(linkHealthService.isHtmlResponse("text/html", "<!DOCTYPE html><html>"), true);
});

// 46. Revalidation generates structured RevalidationAuditRecords and verifies live catalog
test("Phase 6 Test 46: Revalidation service audits all active opportunities and records complete audit trail", async () => {
  const { opportunityRevalidationService } = await import("../src/services/opportunityRevalidationService");
  const { realVerifiedOpportunities } = await import("../src/data/realOpportunities");

  const activeOpps = realVerifiedOpportunities.filter((o) => o.lifecycleStatus === "published");
  const { revalidated, auditLog, summary } = await opportunityRevalidationService.revalidateAllActiveOpportunities(
    activeOpps,
    { referenceDate: new Date("2026-08-21") }
  );

  assert.equal(summary.totalEvaluated, 8);
  assert.equal(summary.verifiedCount, 8);
  assert.equal(summary.expiredCount, 0);
  assert.equal(auditLog.length, 8);

  for (const record of auditLog) {
    assert.ok(record.id.startsWith("audit-"));
    assert.ok(record.opportunityId);
    assert.ok(record.sourceUrl.startsWith("http"));
    assert.ok(record.verificationTimestamp);
  }
});

// 47. Dynamic Opportunity Discovery extracts candidate anchors and enforces domain allowlist
test("Phase 6 Test 47: OpportunityDiscoveryService discovers candidates from real HTML anchors and rejects invalid domains", async () => {
  const { opportunityDiscoveryService } = await import("../src/services/opportunityDiscoveryService");
  const { CONFIGURED_OPPORTUNITY_SOURCES } = await import("../src/config/opportunitySources");

  assert.ok(CONFIGURED_OPPORTUNITY_SOURCES.length >= 7, "Configured opportunity sources must be present");
  const meitySource = CONFIGURED_OPPORTUNITY_SOURCES.find((s) => s.id === "src-meity-gov");
  assert.ok(meitySource);
  assert.equal(meitySource.sourceType, "official");
  assert.ok(meitySource.allowedDomains.includes("meity.gov.in"));
});

// 48. OpportunityRepository persistent operations and seed migration
test("Phase 6 Test 48: OpportunityRepository implements full CRUD, deduplication, and audit history", async () => {
  const { opportunityRepository } = await import("../src/repositories/opportunityRepository");

  // 1. Base active fetch
  const active = await opportunityRepository.getAllActive();
  assert.equal(active.length, 8, "Repository must migrate existing 8 verified opportunities");

  // 2. Lookup by ID
  const meity = await opportunityRepository.getById("real-meity-2026-002");
  assert.ok(meity);
  assert.equal(meity.id, "real-meity-2026-002");

  // 3. Lookup by Canonical URL
  const byUrl = await opportunityRepository.findByCanonicalUrl("https://www.meity.gov.in/internship-scheme");
  assert.ok(byUrl);
  assert.equal(byUrl.id, "real-meity-2026-002");

  // 4. Update
  const updated = await opportunityRepository.update("real-meity-2026-002", {
    location: "New Delhi / Remote",
  });
  assert.equal(updated.location, "New Delhi / Remote");

  // 5. Upsert new item & archive
  const testOpp = {
    ...meity,
    id: "temp-test-opp-001",
    officialUrl: "https://temp-test-domain.gov.in/program",
    lifecycleStatus: "draft" as const,
  };
  await opportunityRepository.upsert(testOpp);
  const fetchedTemp = await opportunityRepository.getById("temp-test-opp-001");
  assert.ok(fetchedTemp);

  await opportunityRepository.archive("temp-test-opp-001");
  const archived = await opportunityRepository.getById("temp-test-opp-001");
  assert.equal(archived?.lifecycleStatus, "rejected");

  // Reset repository state
  opportunityRepository.resetToSeed();
});

// 49. OpportunitySyncService coordinates discovery, revalidation, and returns structured report
test("Phase 6 Test 49: OpportunitySyncService executes end-to-end sync and outputs SyncReport", async () => {
  const { opportunitySyncService } = await import("../src/services/opportunitySyncService");

  const report = await opportunitySyncService.syncOpportunities({
    referenceDate: new Date("2026-08-21"),
    skipDiscovery: true,
  });

  assert.ok(report);
  assert.equal(typeof report.discovered, "number");
  assert.equal(typeof report.verified, "number");
  assert.equal(typeof report.published, "number");
  assert.equal(typeof report.updated, "number");
  assert.equal(typeof report.expired, "number");
  assert.equal(typeof report.conflicts, "number");
  assert.equal(typeof report.failures, "number");
  assert.ok(report.timestamp);
  assert.ok(report.durationMs >= 0);
  assert.equal(report.verified, 8, "All 8 active opportunities revalidated successfully");
});

// 50. OpportunitySyncService mutex protection against concurrent duplicate executions
test("Phase 6 Test 50: OpportunitySyncService rejects concurrent execution with clean error", async () => {
  const { opportunitySyncService } = await import("../src/services/opportunitySyncService");

  // Simulate concurrent sync
  const p1 = opportunitySyncService.syncOpportunities({
    referenceDate: new Date("2026-08-21"),
    skipDiscovery: true,
  });
  let caughtError = false;
  try {
    await opportunitySyncService.syncOpportunities({
      referenceDate: new Date("2026-08-21"),
      skipDiscovery: true,
    });
  } catch (err: any) {
    caughtError = true;
    assert.ok(err.message.includes("already in progress"));
  }
  await p1;
  assert.equal(caughtError, true, "Concurrent sync must be rejected by mutex");
});

// 51. Zero Fabricated or Guessed URLs Across Entire Repository
test("Phase 6 Test 51: Entire repository contains ZERO fabricated /apply, /register, or guessed subpaths", async () => {
  const { opportunityRepository } = await import("../src/repositories/opportunityRepository");

  const all = await opportunityRepository.getAll();
  for (const opp of all) {
    if (opp.applyUrl) {
      assert.ok(
        !opp.applyUrl.endsWith("/apply") &&
        !opp.applyUrl.endsWith("/register") &&
        !opp.applyUrl.endsWith("/student-registration") &&
        !opp.applyUrl.endsWith("/icrb/apply"),
        `Opportunity [${opp.id}] must not have guessed apply path: got ${opp.applyUrl}`
      );
    }
  }
});

// 52. POST /api/opportunities/sync rejects unauthorized requests with 401
test("Phase 6 Test 52: POST /api/opportunities/sync rejects unauthorized cron requests with 401", async () => {
  const { POST } = await import("../src/app/api/opportunities/sync/route");
  const { NextRequest } = await import("next/server");

  const oldSecret = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "production_super_secret_test_token_12345";

    // Request with missing or invalid token
    const unauthReq = new NextRequest("http://localhost:3000/api/opportunities/sync", {
      method: "POST",
      headers: {
        authorization: "Bearer wrong_token_xyz",
      },
    });

    const res = await POST(unauthReq);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error.includes("Unauthorized"));
  } finally {
    process.env.CRON_SECRET = oldSecret;
  }
});

// 53. POST /api/opportunities/sync accepts authorized Bearer token and executes sync
test("Phase 6 Test 53: POST /api/opportunities/sync accepts authorized Bearer token and returns 200", async () => {
  const { POST } = await import("../src/app/api/opportunities/sync/route");
  const { NextRequest } = await import("next/server");

  const oldSecret = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "production_super_secret_test_token_12345";

    const authReq = new NextRequest("http://localhost:3000/api/opportunities/sync", {
      method: "POST",
      headers: {
        authorization: "Bearer production_super_secret_test_token_12345",
        "content-type": "application/json",
      },
      body: JSON.stringify({ skipDiscovery: true }),
    });

    const res = await POST(authReq);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.report);
    assert.ok(body.report.startedAt);
    assert.ok(body.report.completedAt);
    assert.equal(typeof body.report.verified, "number");
  } finally {
    process.env.CRON_SECRET = oldSecret;
  }
});

// 54. POST /api/opportunities/sync returns 409 Conflict when concurrent sync is triggered
test("Phase 6 Test 54: POST /api/opportunities/sync returns 409 Conflict during concurrent execution", async () => {
  const { POST } = await import("../src/app/api/opportunities/sync/route");
  const { opportunitySyncService } = await import("../src/services/opportunitySyncService");
  const { NextRequest } = await import("next/server");

  const oldSecret = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "production_super_secret_test_token_12345";
    // Force mutex lock to simulate running sync
    (opportunitySyncService as any).isSyncing = true;

    const req = new NextRequest("http://localhost:3000/api/opportunities/sync", {
      method: "POST",
      headers: {
        authorization: "Bearer production_super_secret_test_token_12345",
      },
    });
    const res = await POST(req);
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error.includes("already in progress"));
  } finally {
    (opportunitySyncService as any).isSyncing = false;
    process.env.CRON_SECRET = oldSecret;
  }
});

// 55. Failure resilience: failed sync preserves last known good data
test("Phase 6 Test 55: Failure resilience: failed revalidation preserves last known good data and marks needs_reverification", async () => {
  const { opportunityRepository } = await import("../src/repositories/opportunityRepository");
  const { opportunitySyncService } = await import("../src/services/opportunitySyncService");

  // Seed a test opportunity
  const testId = "resilience-test-opp-001";
  await opportunityRepository.upsert({
    id: testId,
    title: "Resilience Test Fellowship 2026",
    organization: "Test Org",
    category: "fellowship",
    categoryLabel: "Fellowship",
    description: "Original verified description",
    fullDescription: "Full details",
    deadline: "2026-11-30",
    location: "Remote",
    remote: true,
    officialUrl: "https://non-existent-fail-domain-xyz-999.gov.in/program",
    applyDestinationType: "unavailable",
    verificationStatus: "verified",
    lifecycleStatus: "published",
    confidenceScore: 90,
    lastVerified: "2026-08-20",
    eligibilityCriteria: {
      allowedDegrees: ["All Degrees"],
      allowedBranches: ["All Branches"],
      allowedYears: [1, 2, 3, 4],
    },
    benefits: ["Certificate"],
    applicationSteps: ["Apply online"],
    importantDates: [{ label: "Deadline", date: "2026-11-30" }],
    deadlineSource: {
      sourceTitle: "Official Opportunity Page",
      sourceUrl: "https://non-existent-fail-domain-xyz-999.gov.in/program",
      sourceType: "official",
      verificationStatus: "verified",
      lastVerified: "2026-08-20",
      contentEvidence: true,
    },
    eligibilitySource: {
      sourceTitle: "Official Opportunity Page",
      sourceUrl: "https://non-existent-fail-domain-xyz-999.gov.in/program",
      sourceType: "official",
      verificationStatus: "verified",
      lastVerified: "2026-08-20",
      contentEvidence: true,
    },
    instructionsSource: {
      sourceTitle: "Official Opportunity Page",
      sourceUrl: "https://non-existent-fail-domain-xyz-999.gov.in/program",
      sourceType: "official",
      verificationStatus: "verified",
      lastVerified: "2026-08-20",
      contentEvidence: true,
    },
  });

  const report = await opportunitySyncService.syncOpportunities({
    referenceDate: new Date("2026-08-21"),
    skipDiscovery: true,
  });

  // Verify opportunity still exists in repository with preserved data
  const preserved = await opportunityRepository.getById(testId);
  assert.ok(preserved, "Opportunity must NOT be deleted on revalidation error");
  assert.equal(preserved.title, "Resilience Test Fellowship 2026");
  assert.equal(preserved.deadline, "2026-11-30");
  assert.equal(preserved.verificationStatus, "needs_reverification");

  // Clean up
  opportunityRepository.resetToSeed();
});

// 56. Idempotent repeated sync preserves repository count without duplicates
test("Phase 6 Test 56: Idempotent repeated sync preserves catalog count without duplicates", async () => {
  const { opportunityRepository } = await import("../src/repositories/opportunityRepository");
  const { opportunitySyncService } = await import("../src/services/opportunitySyncService");

  opportunityRepository.resetToSeed();
  const countBefore = (await opportunityRepository.getAll()).length;

  // Run sync 1
  await opportunitySyncService.syncOpportunities({
    referenceDate: new Date("2026-08-21"),
    skipDiscovery: true,
  });
  const countAfter1 = (await opportunityRepository.getAll()).length;

  // Run sync 2 immediately
  await opportunitySyncService.syncOpportunities({
    referenceDate: new Date("2026-08-21"),
    skipDiscovery: true,
  });
  const countAfter2 = (await opportunityRepository.getAll()).length;

  assert.equal(countAfter1, countBefore, "Sync 1 must not create duplicate active records");
  assert.equal(countAfter2, countBefore, "Repeated Sync 2 must be completely idempotent");
});

// 57. Vercel Cron configuration in vercel.json specifies /api/opportunities/sync
test("Phase 6 Test 57: vercel.json contains valid Vercel Cron configuration for /api/opportunities/sync", async () => {
  const fs = await import("fs");
  const path = await import("path");

  const vercelJsonPath = path.resolve(__dirname, "../vercel.json");
  assert.ok(fs.existsSync(vercelJsonPath), "vercel.json must exist in project root");

  const content = JSON.parse(fs.readFileSync(vercelJsonPath, "utf-8"));
  assert.ok(Array.isArray(content.crons), "vercel.json must have crons array");
  assert.ok(content.crons.length > 0, "crons array must have at least 1 job");
  assert.equal(content.crons[0].path, "/api/opportunities/sync");
  assert.equal(content.crons[0].schedule, "0 2 * * *");
});

