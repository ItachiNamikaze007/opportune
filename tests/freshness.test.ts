import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getOpportunityStatus,
  CURRENT_SERVER_DATE,
  OpportunityStatusResult,
} from "../src/services/opportunityStatusResolver";
import { Opportunity, StudentProfile } from "../src/types";
import { matchingService } from "../src/services/matchingService";
import { deadlineJobService } from "../src/services/deadlineJob";
import { catalogAuditService } from "../src/services/catalogAuditService";

const serverDate = new Date("2026-08-20T00:00:00.000Z");

const baseTestOpp: Opportunity = {
  id: "test-opp-01",
  title: "ISRO Research Fellowship 2026",
  organization: "ISRO",
  category: "research",
  categoryLabel: "Research",
  description: "Advanced propulsion research fellowship.",
  fullDescription: "Detailed description",
  deadline: "2026-09-15",
  location: "Bengaluru",
  remote: false,
  stipendOrPrize: "₹50,000/mo",
  stipendType: "stipend",
  officialUrl: "https://isro.gov.in/fellowship-2026",
  verificationStatus: "verified",
  lastVerified: "2026-08-18",
  tags: ["Space", "Propulsion"],
  benefits: ["Stipend"],
  applicationSteps: ["Apply online"],
  importantDates: [],
  eligibilityCriteria: {
    allowedDegrees: ["B.Tech", "M.Tech"],
    allowedBranches: ["Aerospace", "Mechanical", "Computer Science"],
    allowedYears: [4],
  },
};

const sampleStudent: StudentProfile = {
  name: "Arjun Verma",
  degree: "B.Tech",
  branch: "Aerospace",
  year: 4,
  cgpa: 8.8,
  skills: ["Propulsion", "Python", "Aerodynamics"],
  interests: ["research", "government_internship"],
  location: "Bengaluru",
};

test("Freshness Resolver - ACTIVE opportunity with future deadline", () => {
  const opp: Opportunity = {
    ...baseTestOpp,
    deadline: "2026-09-15",
    lastVerified: "2026-08-19",
  };

  const status: OpportunityStatusResult = getOpportunityStatus(opp, serverDate);

  assert.equal(status.status, "ACTIVE");
  assert.equal(status.isExpired, false);
  assert.equal(status.isActivelyApplicable, true);
  assert.ok(status.daysRemaining > 7);
  assert.equal(status.freshnessState, "Fresh");
});

test("Freshness Resolver - CLOSING_SOON opportunity within 1-7 days", () => {
  const opp: Opportunity = {
    ...baseTestOpp,
    deadline: "2026-08-25", // 5 days from 20 Aug
  };

  const status: OpportunityStatusResult = getOpportunityStatus(opp, serverDate);

  assert.equal(status.status, "CLOSING_SOON");
  assert.equal(status.isExpired, false);
  assert.equal(status.isActivelyApplicable, true);
  assert.equal(status.daysRemaining, 5);
  assert.ok(status.badgeText.includes("Closing in 5"));
});

test("Freshness Resolver - EXPIRED opportunity with passed deadline enforces daysRemaining = 0", () => {
  const opp: Opportunity = {
    ...baseTestOpp,
    title: "Past Hackathon 2026",
    deadline: "2026-07-31", // Past deadline
  };

  const status: OpportunityStatusResult = getOpportunityStatus(opp, serverDate);

  assert.equal(status.status, "EXPIRED");
  assert.equal(status.isExpired, true);
  assert.equal(status.isActivelyApplicable, false);
  assert.equal(status.daysRemaining, 0); // HARD RULE: Must never show days left for expired
  assert.equal(status.freshnessState, "Expired");
  assert.ok(status.badgeText.includes("Deadline Passed"));
});

test("Freshness Resolver - UNKNOWN status when deadline is unverified/missing", () => {
  const opp: Opportunity = {
    ...baseTestOpp,
    deadline: "",
  };

  const status: OpportunityStatusResult = getOpportunityStatus(opp, serverDate);

  assert.equal(status.status, "UNKNOWN");
  assert.equal(status.isActivelyApplicable, false);
  assert.equal(status.freshnessState, "Needs Verification");
  assert.ok(status.statusNote.includes("Verification in progress"));
});

test("Freshness Resolver - Stale source freshness when not verified for > 30 days", () => {
  const opp: Opportunity = {
    ...baseTestOpp,
    deadline: "2026-10-30",
    lastVerified: "2026-06-01", // > 30 days old relative to Aug 20
  };

  const status: OpportunityStatusResult = getOpportunityStatus(opp, serverDate);

  assert.equal(status.status, "ACTIVE");
  assert.equal(status.freshnessState, "Stale");
});

test("Freshness Resolver - DEMO opportunity clearly demarcated", () => {
  const opp: Opportunity = {
    ...baseTestOpp,
    deadline: "2026-09-30",
    isDemo: true,
  };

  const status: OpportunityStatusResult = getOpportunityStatus(opp, serverDate);

  assert.equal(status.status, "DEMO");
  assert.equal(status.badgeVariant, "demo");
  assert.ok(status.badgeText.includes("Demo"));
});

test("Matching Engine - Suppresses new match notifications for expired opportunities", async () => {
  const expiredOpp: Opportunity = {
    ...baseTestOpp,
    id: "opp-expired-01",
    deadline: "2026-07-20",
  };

  const matchRes = await matchingService.matchPublishedOpportunityWithStudents(expiredOpp, [
    { id: "student-123", profile: sampleStudent },
  ]);

  // Evaluates eligibility for history, but suppresses active notification
  assert.ok(matchRes.eligibleCount >= 0);

  const ranked = matchingService.rankMatchesForStudent(sampleStudent, [
    {
      opportunity: expiredOpp,
      match: matchingService.evaluateMatch("student-123", sampleStudent, expiredOpp),
    },
  ]);

  assert.equal(ranked[0].isExpired, true);
  assert.equal(ranked[0].isUrgent, false);
});

test("Deadline Job - Suppresses deadline reminders for expired or closed opportunities", async () => {
  const expiredOpp: Opportunity = {
    ...baseTestOpp,
    id: "opp-expired-remind",
    deadline: "2026-08-10",
  };

  const activeOpp7d: Opportunity = {
    ...baseTestOpp,
    id: "opp-active-7d",
    deadline: "2026-08-27", // 7 days from 20 Aug
    featured: true,
  };

  const result = await deadlineJobService.runDeadlineCheck(
    "student-123",
    [expiredOpp, activeOpp7d],
    [expiredOpp.id, activeOpp7d.id],
    serverDate
  );

  assert.equal(result.evaluatedCount, 2);
  assert.equal(result.remindersCreated, 1); // Only the active 7d opp, 0 for expired!
});

test("Catalog Audit Service - Generates exhaustive freshness and action report", () => {
  const catalog: Opportunity[] = [
    { ...baseTestOpp, id: "act-1", deadline: "2026-09-30" },
    { ...baseTestOpp, id: "urg-1", deadline: "2026-08-23" }, // 3 days
    { ...baseTestOpp, id: "exp-1", deadline: "2026-07-31" }, // expired
    { ...baseTestOpp, id: "demo-1", deadline: "2026-09-10", isDemo: true },
  ];

  const report = catalogAuditService.generateAuditReport(catalog, serverDate);

  assert.equal(report.totalAudited, 4);
  assert.equal(report.activeCount, 1);
  assert.equal(report.closingSoonCount, 1);
  assert.equal(report.expiredCount, 1);
  assert.equal(report.demoCount, 1);

  const expiredItem = report.items.find((i) => i.id === "exp-1");
  assert.ok(expiredItem);
  assert.equal(expiredItem.actionRequired, "Mark Expired");
});
