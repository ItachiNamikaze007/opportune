import test from "node:test";
import assert from "node:assert/strict";

import { studentService } from "../src/services/studentService";
import { runIngestionPipeline } from "../src/ingestion/pipeline";
import { reviewQueueService } from "../src/ingestion/reviewQueueService";
import { matchingService } from "../src/services/matchingService";
import { notificationService } from "../src/services/notificationService";
import { savedService } from "../src/services/savedService";
import { applicationService } from "../src/services/applicationService";
import { opportunityService } from "../src/services/opportunityService";
import { auditLogService } from "../src/services/auditLogService";
import type { StudentProfile, Opportunity } from "../src/types";

// ==============================================================================
// PHASE 5: COMPLETE END-TO-END INTEGRATION TEST SCENARIO
// ==============================================================================
test("Phase 5 E2E Flow - Student Signup -> Ingest -> Review -> Publish -> Match -> Notify -> Save -> Application Tracking", async () => {
  const testStudentId = `test-student-${Date.now()}`;

  // 1. Create Student & Complete Profile
  const initialProfile: StudentProfile = {
    name: "Arya Sharma",
    email: "arya.sharma@example.edu",
    degree: "B.Tech",
    institution: "IIT Bombay",
    branch: "Computer Science",
    currentYear: 4,
    graduationYear: 2026,
    cgpa: 9.1,
    age: 21,
    country: "India",
    state: "Maharashtra",
    city: "Mumbai",
    gender: "all",
    skills: ["Python", "Machine Learning", "Data Structures", "Algorithms", "C++"],
    interests: ["government_exam", "research_internship", "fellowship"],
    completedOnboarding: true,
  };

  const studentProfile = await studentService.updateStudentProfile(initialProfile);
  assert.equal(studentProfile.name, "Arya Sharma");
  assert.equal(studentProfile.completedOnboarding, true);

  // 2. Ingest Opportunity from Official Source (ISRO)
  const pipelineResult = await runIngestionPipeline("src-gov-isro", []);
  assert.equal(pipelineResult.summary.status, "success");
  assert.ok(pipelineResult.enqueuedForReview.length >= 1);

  const enqueuedOpp = pipelineResult.enqueuedForReview[0];
  assert.equal(enqueuedOpp.lifecycleStatus, "pending_review");
  assert.equal(enqueuedOpp.verificationStatus, "pending");

  // 3. Put Opportunity into Review Queue & Inspect
  const reviewItem = reviewQueueService.getReview(enqueuedOpp.id!);
  assert.ok(reviewItem);
  assert.equal(reviewItem.reviewStatus, "pending");
  assert.ok(reviewItem.confidence >= 0.85);

  // 4. Admin Approves Opportunity
  const approveRes = reviewQueueService.approveReview(
    reviewItem.id,
    "Lead Reviewer",
    "Verified against official ISRO ICRB gazette notification."
  );
  assert.equal(approveRes.approved, true);
  assert.ok(approveRes.publishedOpportunity);

  // 5. Verify Opportunity Status is Verified & Published
  const publishedOpp = approveRes.publishedOpportunity!;
  assert.equal(publishedOpp.verificationStatus, "verified");
  assert.equal(publishedOpp.lifecycleStatus, "published");

  await auditLogService.logAction(
    "Lead Reviewer",
    "opportunity_approved",
    publishedOpp.id,
    "E2E Verification sign-off"
  );

  // 6. Run Matching Engine for Student
  const matchResult = matchingService.evaluateMatch(testStudentId, studentProfile, publishedOpp);
  assert.equal(matchResult.status, "eligible");
  assert.ok(matchResult.score >= 80);
  assert.ok(matchResult.reasons.length >= 3);
  await matchingService.saveMatch(matchResult);

  // 7. Dispatch Grouped Anti-Spam Match Notification
  const notif = await notificationService.createGroupedMatchNotification(
    testStudentId,
    publishedOpp.title,
    publishedOpp.id,
    matchResult.score
  );
  assert.ok(notif);
  assert.equal(notif.user_id, testStudentId);

  // 8. Verify Notification Retrieved by Student
  const studentNotifs = await notificationService.getNotifications(testStudentId);
  assert.ok(studentNotifs.some((n) => n.id === notif.id));

  // 9. Student Saves the Matched Opportunity
  const saveRes = await savedService.toggleSave(publishedOpp.id, testStudentId);
  assert.equal(saveRes.saved, true);
  const savedList = await savedService.getSavedOpportunities(testStudentId);
  assert.ok(savedList.includes(publishedOpp.id));

  // 10. Student Creates Application in Application Tracker
  const app = await applicationService.createApplication(
    publishedOpp.id,
    "applied",
    "Submitted through official ICRB portal with registration number 2026-ISRO-9988.",
    testStudentId
  );
  assert.equal(app.opportunityId, publishedOpp.id);
  assert.equal(app.stage, "applied");

  // 11. Student Updates Application Stage (e.g. moving to interview)
  const updatedApp = await applicationService.updateApplicationStage(
    app.id,
    "interview",
    testStudentId
  );
  assert.equal(updatedApp?.stage, "interview");

  // 12. Verify Catalog returns Published Opportunity
  const fullCatalog = await opportunityService.getOpportunities();
  assert.ok(fullCatalog.some((o) => o.id === publishedOpp.id));
});
