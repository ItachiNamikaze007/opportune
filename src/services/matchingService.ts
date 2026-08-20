import { Opportunity, StudentProfile, EligibilityStatus, EligibilityResult } from "@/types";
import { calculateEligibility } from "./eligibilityEngine";
import { getSupabaseClient } from "@/lib/supabase/client";
import { DbStudentOpportunityMatch } from "@/types/database";
import { notificationService } from "./notificationService";
import { getOpportunityStatus } from "./opportunityStatusResolver";

export interface StudentOpportunityMatch {
  id?: string;
  studentId: string;
  opportunityId: string;
  score: number;
  status: EligibilityStatus;
  reasons: string[];
  mismatches: string[];
  matchedAt: string;
  notificationSentAt?: string | null;
}

export interface RankedOpportunityMatch {
  opportunity: Opportunity;
  match: StudentOpportunityMatch;
  rankingScore: number;
  isUrgent: boolean;
  isInterestMatch: boolean;
  isExpired: boolean;
}

class MatchingService {
  private inMemoryMatches: Map<string, StudentOpportunityMatch> = new Map(); // key: studentId:oppId

  /**
   * Evaluates a single student against an opportunity using the deterministic eligibility engine.
   * STRICT SAFETY RULE: Always represents "Eligibility Match" (never selection probability).
   */
  evaluateMatch(
    studentId: string,
    student: StudentProfile,
    opportunity: Opportunity
  ): StudentOpportunityMatch {
    const result: EligibilityResult = calculateEligibility(student, opportunity);

    return {
      studentId,
      opportunityId: opportunity.id,
      score: result.score,
      status: result.status,
      reasons: result.reasons || [],
      mismatches: result.mismatches || [],
      matchedAt: new Date().toISOString(),
    };
  }

  /**
   * Persists or updates a match in memory and Supabase (when connected)
   */
  async saveMatch(match: StudentOpportunityMatch): Promise<void> {
    const key = `${match.studentId}:${match.opportunityId}`;
    this.inMemoryMatches.set(key, match);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from("student_opportunity_matches").upsert(
          {
            student_id: match.studentId,
            opportunity_id: match.opportunityId,
            score: match.score,
            status: match.status,
            reasons: match.reasons,
            mismatches: match.mismatches,
            last_evaluated_at: match.matchedAt,
          },
          { onConflict: "student_id,opportunity_id" }
        );
      } catch (err) {
        console.warn("Supabase match upsert fallback:", err);
      }
    }
  }

  /**
   * Evaluates and persists all matches for a student against a given opportunity catalog.
   */
  async matchStudentWithCatalog(
    studentId: string,
    student: StudentProfile,
    catalog: Opportunity[]
  ): Promise<StudentOpportunityMatch[]> {
    const results: StudentOpportunityMatch[] = [];

    for (const opp of catalog) {
      const match = this.evaluateMatch(studentId, student, opp);
      await this.saveMatch(match);
      results.push(match);
    }

    return results;
  }

  /**
   * Trigger 1 & 6: When a real opportunity is published or its eligibility rules change,
   * match it against student profiles and send grouped anti-spam notifications.
   * SUPPRESSION RULE: Never send notifications for expired or closed opportunities.
   */
  async matchPublishedOpportunityWithStudents(
    opportunity: Opportunity,
    students: { id: string; profile: StudentProfile }[]
  ): Promise<{ eligibleCount: number; matchedStudentIds: string[] }> {
    const statusResult = getOpportunityStatus(opportunity);
    const matchedStudentIds: string[] = [];

    for (const s of students) {
      const match = this.evaluateMatch(s.id, s.profile, opportunity);
      const prevKey = `${s.id}:${opportunity.id}`;
      const prevMatch = this.inMemoryMatches.get(prevKey);
      await this.saveMatch(match);

      if (match.status === "eligible" || match.score >= 75) {
        matchedStudentIds.push(s.id);

        // Check if student became newly eligible AND opportunity is actively open
        const becameNewlyEligible = !prevMatch || prevMatch.status !== "eligible";
        if (becameNewlyEligible && !statusResult.isExpired) {
          await notificationService.createGroupedMatchNotification(
            s.id,
            opportunity.title,
            opportunity.id,
            match.score
          );
        }
      }
    }

    return {
      eligibleCount: matchedStudentIds.length,
      matchedStudentIds,
    };
  }

  /**
   * Trigger 2, 3, 4, 5: When student completes onboarding or updates degree/branch/year/CGPA/skills/interests,
   * re-evaluate all catalog matches.
   * SUPPRESSION RULE: Filter out expired opportunities from newly eligible notification alerts.
   */
  async rematchStudentOnProfileChange(
    studentId: string,
    updatedProfile: StudentProfile,
    catalog: Opportunity[]
  ): Promise<{ newEligibleMatches: Opportunity[]; totalEligible: number }> {
    const newEligibleMatches: Opportunity[] = [];
    let totalEligible = 0;

    for (const opp of catalog) {
      const prevKey = `${studentId}:${opp.id}`;
      const prevMatch = this.inMemoryMatches.get(prevKey);
      const newMatch = this.evaluateMatch(studentId, updatedProfile, opp);
      await this.saveMatch(newMatch);

      const statusResult = getOpportunityStatus(opp);

      if (newMatch.status === "eligible") {
        totalEligible++;
        if ((!prevMatch || prevMatch.status !== "eligible") && !statusResult.isExpired) {
          newEligibleMatches.push(opp);
        }
      }
    }

    if (newEligibleMatches.length > 0) {
      await notificationService.createBulkMatchNotification(
        studentId,
        newEligibleMatches.length,
        newEligibleMatches[0]?.id
      );
    }

    return {
      newEligibleMatches,
      totalEligible,
    };
  }

  /**
   * Multi-Factor Match Ranking Engine:
   * 1. Primary: Eligibility Match score (50%)
   * 2. Secondary: Category / Interest relevance (25%)
   * 3. Tertiary: Deadline urgency (15%)
   * 4. Quaternary: Freshness / Featured (10%)
   */
  rankMatchesForStudent(
    student: StudentProfile,
    opportunitiesWithMatches: { opportunity: Opportunity; match: StudentOpportunityMatch }[]
  ): RankedOpportunityMatch[] {
    const ranked = opportunitiesWithMatches.map(({ opportunity, match }) => {
      const statusResult = getOpportunityStatus(opportunity);

      // 1. Eligibility component (0 - 50)
      const eligComponent = (match.score / 100) * 50;

      // 2. Interest component (0 - 25)
      const isInterestMatch = student.interests.includes(opportunity.category);
      const interestComponent = isInterestMatch ? 25 : 5;

      // 3. Deadline urgency component (0 - 15)
      let urgencyComponent = 5;
      const isUrgent = statusResult.status === "CLOSING_SOON";

      if (statusResult.isExpired) {
        urgencyComponent = 0;
      } else if (statusResult.daysRemaining >= 1 && statusResult.daysRemaining <= 7) {
        urgencyComponent = 15;
      } else if (statusResult.daysRemaining > 7 && statusResult.daysRemaining <= 14) {
        urgencyComponent = 10;
      } else if (statusResult.daysRemaining > 14 && statusResult.daysRemaining <= 30) {
        urgencyComponent = 7;
      }

      // 4. Featured / Freshness (0 - 10)
      const freshnessComponent = statusResult.isExpired
        ? 0
        : opportunity.featured
        ? 10
        : 5;

      const rankingScore = Number(
        (eligComponent + interestComponent + urgencyComponent + freshnessComponent).toFixed(2)
      );

      return {
        opportunity,
        match,
        rankingScore,
        isUrgent,
        isInterestMatch,
        isExpired: statusResult.isExpired,
      };
    });

    return ranked.sort((a, b) => b.rankingScore - a.rankingScore);
  }

  /**
   * Get cached matches for a student
   */
  getMatchesForStudent(studentId: string): StudentOpportunityMatch[] {
    const prefix = `${studentId}:`;
    const list: StudentOpportunityMatch[] = [];
    for (const [key, match] of this.inMemoryMatches.entries()) {
      if (key.startsWith(prefix)) {
        list.push(match);
      }
    }
    return list;
  }
}

export const matchingService = new MatchingService();
