import type { Opportunity } from "@/types";
import type { ReviewQueueItem, NormalizedOpportunity } from "./types";
import { ingestionLogger } from "./ingestionLogger";
import { realVerifiedOpportunities } from "@/data/realOpportunities";

class ReviewQueueService {
  private queue: Map<string, ReviewQueueItem> = new Map();
  private publishedRealOpportunities: Map<string, Opportunity> = new Map();

  constructor() {
    // Populate published real verified opportunities
    realVerifiedOpportunities.forEach((opp) => {
      if (opp.lifecycleStatus === "published" && opp.verificationStatus === "verified") {
        this.publishedRealOpportunities.set(opp.id, opp);
      }
    });
    this.seedInitialReviewItems();
  }

  private seedInitialReviewItems() {
    // Initial sample pending items in review queue
    const sampleItems: NormalizedOpportunity[] = [
      {
        id: "real-isro-2026-001",
        sourceId: "src-gov-isro",
        title: "ISRO Scientist / Engineer SC Recruitment Exam 2026",
        organization: "Indian Space Research Organisation (ISRO)",
        category: "government_exam",
        categoryLabel: "Government Exam",
        description:
          "Recruitment examination for Scientist / Engineer 'SC' posts in Electronics, Mechanical, and Computer Science disciplines at ISRO Centres.",
        fullDescription:
          "ISRO Centralised Recruitment Board invites applications for the prestigious post of Scientist/Engineer 'SC' in Level 10 of Pay Matrix for engineering graduates with first class degree.",
        deadline: "2026-09-20",
        location: "Bengaluru / Sriharikota / Thiruvananthapuram",
        remote: false,
        stipendOrPrize: "Level 10 Pay Matrix (₹56,100 - ₹1,77,500/month)",
        stipendType: "salary",
        officialUrl: "https://www.isro.gov.in/Careers.html",
        applyUrl: "https://apps.isro.gov.in/icrb/apply",
        sourceUrl: "https://www.isro.gov.in/Careers.html",
        verificationStatus: "pending",
        lifecycleStatus: "pending_review",
        confidenceScore: 0.94,
        confidenceLevel: "high_confidence",
        confidenceBreakdown: {
          title: 0.95,
          deadline: 0.95,
          organization: 0.95,
          url: 0.95,
          eligibility: 0.9,
          overall: 0.94,
          level: "high_confidence",
        },
        verificationNotes: "Sourced from official ISRO ICRB portal. Awaiting human reviewer sign-off.",
        lastVerified: new Date().toISOString().split("T")[0],
        isDemo: false,
        tags: ["ISRO", "Govt Exam", "Space Science", "Central Govt"],
        benefits: ["Central Govt Pay Matrix Level 10", "ISRO scientist research badge", "Housing & medical benefits"],
        applicationSteps: ["Register on ISRO ICRB portal", "Written exam", "Technical interview round"],
        importantDates: [{ label: "Exam Registration Closes", date: "2026-09-20" }],
        eligibilityCriteria: {
          allowedDegrees: ["B.Tech", "B.E."],
          allowedBranches: ["Computer Science", "Electronics", "Mechanical", "Electrical"],
          allowedYears: [4],
          minCGPA: 6.84,
          maxAge: 28,
          requiredSkills: ["Engineering Fundamentals", "Data Structures", "Electronics"],
          eligibleLocations: ["All India"],
          eligibleGender: "all",
          domicileRequired: "All India",
        },
      },
      {
        id: "real-meity-2026-002",
        sourceId: "src-gov-meity",
        title: "Digital India AI & Quantum Tech Fellowship 2026",
        organization: "Ministry of Electronics & Information Technology (MeitY)",
        category: "government_internship",
        categoryLabel: "Government Internship",
        description:
          "High-impact internship in next-generation sovereign AI, quantum computing algorithms, and Indian semiconductor mission.",
        fullDescription:
          "MeitY Digital India Fellowship offers undergraduate and postgraduate scholars an immersive research experience under distinguished chief scientists.",
        deadline: "2026-09-15",
        location: "New Delhi (Electronics Niketan) / Hybrid",
        remote: false,
        stipendOrPrize: "₹25,000/month Stipend + Certificate",
        stipendType: "stipend",
        officialUrl: "https://www.meity.gov.in/internship-scheme",
        applyUrl: "https://meity.gov.in/schemes/apply",
        sourceUrl: "https://www.meity.gov.in/schemes",
        verificationStatus: "pending",
        lifecycleStatus: "pending_review",
        confidenceScore: 0.91,
        confidenceLevel: "high_confidence",
        confidenceBreakdown: {
          title: 0.92,
          deadline: 0.95,
          organization: 0.95,
          url: 0.9,
          eligibility: 0.85,
          overall: 0.91,
          level: "high_confidence",
        },
        verificationNotes: "Sourced from MeitY official scheme bulletin. Ready for verification audit.",
        lastVerified: new Date().toISOString().split("T")[0],
        isDemo: false,
        tags: ["MeitY", "IndiaAI", "Quantum", "Govt Fellowship"],
        benefits: ["₹25,000 monthly research stipend", "Certificate of Merit signed by Joint Secretary"],
        applicationSteps: ["Fill online portal form", "Statement of purpose submission", "Online interview"],
        importantDates: [{ label: "Applications Close", date: "2026-09-15" }],
        eligibilityCriteria: {
          allowedDegrees: ["B.Tech", "M.Tech", "MCA", "M.Sc"],
          allowedBranches: ["Computer Science", "IT", "Data Science", "Electronics", "Artificial Intelligence"],
          allowedYears: [3, 4],
          minCGPA: 7.5,
          requiredSkills: ["Python", "Machine Learning", "Quantum Computing", "C++"],
          eligibleLocations: ["All India"],
          eligibleGender: "all",
          domicileRequired: "All India",
        },
      },
    ];

    sampleItems.forEach((item) => this.addToReviewQueue(item, "Initial pipeline ingestion from official portal"));
  }

  /**
   * Enqueues an opportunity into the human review queue
   */
  addToReviewQueue(opportunity: NormalizedOpportunity, reason: string = "Automated Ingestion Queue"): ReviewQueueItem {
    const oppId = opportunity.id || `real-${Date.now().toString(36)}`;
    opportunity.id = oppId;
    opportunity.lifecycleStatus = "pending_review";
    opportunity.verificationStatus = "pending";

    const reviewItem: ReviewQueueItem = {
      id: `rev-${oppId}`,
      opportunityId: oppId,
      opportunity,
      reason,
      confidence: opportunity.confidenceScore,
      confidenceLevel: opportunity.confidenceLevel,
      confidenceBreakdown: opportunity.confidenceBreakdown,
      sourceUrl: opportunity.sourceUrl,
      reviewStatus: "pending",
      createdAt: new Date().toISOString(),
    };

    this.queue.set(oppId, reviewItem);
    ingestionLogger.info(
      opportunity.sourceId,
      `Opportunity [${oppId}] "${opportunity.title}" enqueued for human review (Confidence: ${(
        opportunity.confidenceScore * 100
      ).toFixed(0)}%)`
    );

    return reviewItem;
  }

  /**
   * Returns all pending items requiring review
   */
  getPendingReviews(): ReviewQueueItem[] {
    return Array.from(this.queue.values()).filter((item) => item.reviewStatus === "pending");
  }

  /**
   * Returns all items in review queue
   */
  getAllReviews(): ReviewQueueItem[] {
    return Array.from(this.queue.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Returns review by Opportunity ID or Review ID
   */
  getReview(id: string): ReviewQueueItem | undefined {
    return (
      this.queue.get(id) ||
      Array.from(this.queue.values()).find((item) => item.id === id || item.opportunityId === id)
    );
  }

  /**
   * Human Reviewer Approval:
   * Transitions opportunity to 'verified' + 'published' and adds to published catalog.
   */
  approveReview(
    id: string,
    reviewer: string = "Admin Reviewer",
    notes: string = "Approved after verifying against official notification document."
  ): { approved: boolean; publishedOpportunity?: Opportunity } {
    const review = this.getReview(id);
    if (!review) {
      return { approved: false };
    }

    review.reviewStatus = "approved";
    review.reviewedBy = reviewer;
    review.reviewedAt = new Date().toISOString();
    review.reviewNotes = notes;

    const opp = review.opportunity;
    opp.verificationStatus = "verified";
    opp.lifecycleStatus = "published";
    opp.verificationNotes = `Officially verified by ${reviewer} on ${new Date().toLocaleDateString("en-IN")}. ${notes}`;
    opp.lastVerified = new Date().toISOString().split("T")[0];

    const publishedOpp: Opportunity = {
      ...opp,
      id: opp.id || review.opportunityId,
      isDemo: false,
    };

    this.publishedRealOpportunities.set(publishedOpp.id, publishedOpp);
    ingestionLogger.info("review", `Opportunity [${publishedOpp.id}] "${publishedOpp.title}" APPROVED and PUBLISHED.`);

    return { approved: true, publishedOpportunity: publishedOpp };
  }

  /**
   * Human Reviewer Rejection
   */
  rejectReview(
    id: string,
    reviewer: string = "Admin Reviewer",
    notes: string = "Rejected: Does not meet publication guidelines or terms."
  ): { rejected: boolean } {
    const review = this.getReview(id);
    if (!review) {
      return { rejected: false };
    }

    review.reviewStatus = "rejected";
    review.reviewedBy = reviewer;
    review.reviewedAt = new Date().toISOString();
    review.reviewNotes = notes;

    review.opportunity.lifecycleStatus = "rejected";
    this.publishedRealOpportunities.delete(review.opportunityId);
    ingestionLogger.warn("review", `Opportunity [${review.opportunityId}] REJECTED by ${reviewer}: ${notes}`);

    return { rejected: true };
  }

  /**
   * Request More Information
   */
  requestMoreInfo(
    id: string,
    reviewer: string = "Admin Reviewer",
    notes: string = "Official brochure PDF needed to verify degree quotas."
  ): { updated: boolean } {
    const review = this.getReview(id);
    if (!review) {
      return { updated: false };
    }

    review.reviewStatus = "needs_more_information";
    review.reviewedBy = reviewer;
    review.reviewedAt = new Date().toISOString();
    review.reviewNotes = notes;
    ingestionLogger.info("review", `Opportunity [${review.opportunityId}] flagged as needs_more_information`);

    return { updated: true };
  }

  /**
   * Returns list of approved & published real opportunities
   */
  getPublishedRealOpportunities(): Opportunity[] {
    return Array.from(this.publishedRealOpportunities.values());
  }
}

export const reviewQueueService = new ReviewQueueService();
