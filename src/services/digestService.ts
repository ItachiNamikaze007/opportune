import { Opportunity, StudentProfile } from "@/types";
import { matchingService, RankedOpportunityMatch } from "./matchingService";

export interface WeeklyOpportunityDigest {
  studentName: string;
  studentEmail: string;
  generatedDate: string;
  topMatches: RankedOpportunityMatch[];
  closingSoon: Opportunity[];
  newOpportunities: Opportunity[];
  savedNearingDeadline: Opportunity[];
  totalEligibleFound: number;
  highlightMessage: string;
}

export const digestService = {
  /**
   * Aggregates weekly opportunity digest payload for a student
   */
  generateWeeklyDigest(
    student: StudentProfile,
    allOpportunities: Opportunity[],
    savedOpportunityIds: string[] = []
  ): WeeklyOpportunityDigest {
    const now = new Date("2026-08-20");

    // 1. Evaluate and rank all matches
    const opportunitiesWithMatches = allOpportunities.map((opp) => ({
      opportunity: opp,
      match: matchingService.evaluateMatch("digest-student", student, opp),
    }));

    const rankedMatches = matchingService.rankMatchesForStudent(student, opportunitiesWithMatches);
    const eligibleMatches = rankedMatches.filter((r) => r.match.status === "eligible");

    // 2. Top Matches (Highest ranked)
    const topMatches = eligibleMatches.slice(0, 5);

    // 3. Closing Soon (Within 7 days)
    const closingSoon = allOpportunities.filter((opp) => {
      const deadline = new Date(opp.deadline);
      const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    });

    // 4. Saved Nearing Deadline
    const savedNearingDeadline = allOpportunities.filter((opp) => {
      if (!savedOpportunityIds.includes(opp.id)) return false;
      const deadline = new Date(opp.deadline);
      const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 10;
    });

    // 5. New Opportunities (Featured or Recently verified)
    const newOpportunities = allOpportunities
      .filter((opp) => opp.featured || !opp.isDemo)
      .slice(0, 4);

    const highlightMessage =
      topMatches.length > 0
        ? `We found ${eligibleMatches.length} opportunities perfectly matching your ${student.degree} in ${student.branch}.`
        : "Complete more profile details to unlock personalized matches.";

    return {
      studentName: student.name || "Student",
      studentEmail: student.email,
      generatedDate: new Date().toISOString().split("T")[0],
      topMatches,
      closingSoon,
      newOpportunities,
      savedNearingDeadline,
      totalEligibleFound: eligibleMatches.length,
      highlightMessage,
    };
  },
};
