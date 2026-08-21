"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";
import { Opportunity, StudentProfile, EligibilityResult } from "@/types";
import { defaultStudentProfile } from "@/data/mockStudent";
import { realVerifiedOpportunities } from "@/data/realOpportunities";
import { calculateEligibility } from "@/services/eligibilityEngine";
import { studentService } from "@/services/studentService";
import { opportunityService } from "@/services/opportunityService";
import { matchingService, RankedOpportunityMatch } from "@/services/matchingService";
import { getOpportunityStatus } from "@/services/opportunityStatusResolver";

interface StudentContextType {
  studentProfile: StudentProfile;
  updateProfile: (updates: Partial<StudentProfile>) => Promise<void>;
  resetProfileToDefault: () => Promise<void>;
  clearProfile: () => Promise<void>;
  profileCompleteness: number;
  missingFields: string[];
  getOpportunityEligibility: (opp: Opportunity) => EligibilityResult;
  opportunitiesWithEligibility: {
    opportunity: Opportunity;
    eligibility: EligibilityResult;
  }[];
  rankedMatches: RankedOpportunityMatch[];
  topMatches: RankedOpportunityMatch[];
  closingSoonMatches: RankedOpportunityMatch[];
  interestMatches: RankedOpportunityMatch[];
  newForYouMatches: RankedOpportunityMatch[];
  stats: {
    totalCount: number;
    eligibleCount: number;
    potentiallyEligibleCount: number;
    closingSoonCount: number;
    highMatchCount: number;
  };
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const [studentProfile, setStudentProfile] = useState<StudentProfile>(defaultStudentProfile);
  const [allOpportunities, setAllOpportunities] = useState<Opportunity[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from studentService & opportunityService (Database or fallback)
  useEffect(() => {
    async function loadData() {
      try {
        const [profile, opps] = await Promise.all([
          studentService.getStudentProfile(),
          opportunityService.getActiveOpportunities(),
        ]);
        setStudentProfile(profile);
        if (opps) {
          setAllOpportunities(opps);
          if (opps.length > 0) {
            // Pre-evaluate matches in matchingService
            await matchingService.matchStudentWithCatalog("demo-student-id", profile, opps);
          }
        }
      } catch (e) {
        console.error("Failed to load initial student data:", e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadData();
  }, []);

  const updateProfile = async (updates: Partial<StudentProfile>) => {
    const updated = await studentService.updateStudentProfile(updates);
    setStudentProfile(updated);
    // Trigger automatic rematching on profile/skills/interests changes!
    await matchingService.rematchStudentOnProfileChange("demo-student-id", updated, allOpportunities);
  };

  const resetProfileToDefault = async () => {
    const updated = await studentService.updateStudentProfile(defaultStudentProfile);
    setStudentProfile(updated);
    await matchingService.rematchStudentOnProfileChange("demo-student-id", updated, allOpportunities);
  };

  const clearProfile = async () => {
    const cleared: StudentProfile = {
      name: "",
      email: "",
      degree: "B.Tech",
      institution: "",
      branch: "",
      currentYear: 1,
      graduationYear: 2028,
      cgpa: 0,
      age: 18,
      country: "India",
      state: "",
      city: "",
      gender: "all",
      skills: [],
      interests: [],
      completedOnboarding: false,
    };
    const updated = await studentService.updateStudentProfile(cleared);
    setStudentProfile(updated);
    await matchingService.rematchStudentOnProfileChange("demo-student-id", updated, allOpportunities);
  };

  // Calculate profile completeness score
  const { completeness, missingFields } = useMemo(() => {
    let score = 0;
    const missing: string[] = [];

    if (studentProfile.name && studentProfile.name.trim() !== "") score += 10;
    else missing.push("Full Name");

    if (studentProfile.degree) score += 15;
    else missing.push("Degree Level");

    if (studentProfile.institution && studentProfile.institution.trim() !== "") score += 10;
    else missing.push("College / University Name");

    if (studentProfile.branch && studentProfile.branch.trim() !== "") score += 15;
    else missing.push("Branch / Specialization");

    if (studentProfile.currentYear && studentProfile.currentYear > 0) score += 10;
    else missing.push("Current Year of Study");

    if (studentProfile.cgpa && studentProfile.cgpa > 0) score += 15;
    else missing.push("CGPA / Percentage");

    if (studentProfile.skills && studentProfile.skills.length >= 3) score += 15;
    else missing.push("At least 3 Key Skills");

    if (studentProfile.interests && studentProfile.interests.length >= 1) score += 10;
    else missing.push("Opportunity Preferences");

    return { completeness: Math.min(100, score), missingFields: missing };
  }, [studentProfile]);

  // Dynamic eligibility calculation for all opportunities
  const opportunitiesWithEligibility = useMemo(() => {
    return allOpportunities.map((opp) => ({
      opportunity: opp,
      eligibility: calculateEligibility(studentProfile, opp),
    }));
  }, [studentProfile, allOpportunities]);

  const getOpportunityEligibility = (opp: Opportunity): EligibilityResult => {
    return calculateEligibility(studentProfile, opp);
  };

  // Multi-Factor Personalized Matches Ranking (Phase 4)
  const rankedMatches: RankedOpportunityMatch[] = useMemo(() => {
    const validOpportunities = allOpportunities.filter(
      (opp) => !opp.isDemo && opp.verificationStatus === "verified"
    );
    const rawMatches = validOpportunities.map((opp) => ({
      opportunity: opp,
      match: matchingService.evaluateMatch("demo-student-id", studentProfile, opp),
    }));
    return matchingService.rankMatchesForStudent(studentProfile, rawMatches);
  }, [studentProfile, allOpportunities]);

  // Top Matches (Score >= 80% & Eligible & Not Expired)
  const topMatches = useMemo(() => {
    return rankedMatches.filter(
      (r) => !r.isExpired && r.match.score >= 80 && r.match.status === "eligible"
    );
  }, [rankedMatches]);

  // Closing Soon Matches (Urgent & Eligible/Potentially Eligible & Not Expired)
  const closingSoonMatches = useMemo(() => {
    return rankedMatches.filter(
      (r) => !r.isExpired && r.isUrgent && r.match.status !== "not_eligible"
    );
  }, [rankedMatches]);

  // Recommended by Interests (Not Expired)
  const interestMatches = useMemo(() => {
    return rankedMatches.filter(
      (r) => !r.isExpired && r.isInterestMatch && r.match.status !== "not_eligible"
    );
  }, [rankedMatches]);

  // New For You (Featured or Real Ingested & Not Expired)
  const newForYouMatches = useMemo(() => {
    return rankedMatches.filter(
      (r) => !r.isExpired && (r.opportunity.featured || !r.opportunity.isDemo)
    );
  }, [rankedMatches]);

  // Dashboard Stats
  const stats = useMemo(() => {
    let eligibleCount = 0;
    let potentiallyEligibleCount = 0;
    let closingSoonCount = 0;
    let highMatchCount = 0;

    let activeEvaluatedCount = 0;
    opportunitiesWithEligibility.forEach(({ opportunity, eligibility }) => {
      const statusRes = getOpportunityStatus(opportunity);

      if (!statusRes.isExpired) {
        activeEvaluatedCount++;
        if (eligibility.status === "eligible") {
          eligibleCount++;
        } else if (eligibility.status === "potentially_eligible") {
          potentiallyEligibleCount++;
        }

        if (eligibility.score >= 80) {
          highMatchCount++;
        }

        if (statusRes.status === "CLOSING_SOON") {
          closingSoonCount++;
        }
      }
    });

    return {
      totalCount: activeEvaluatedCount,
      eligibleCount,
      potentiallyEligibleCount,
      closingSoonCount,
      highMatchCount,
    };
  }, [opportunitiesWithEligibility]);

  return (
    <StudentContext.Provider
      value={{
        studentProfile,
        updateProfile,
        resetProfileToDefault,
        clearProfile,
        profileCompleteness: completeness,
        missingFields,
        getOpportunityEligibility,
        opportunitiesWithEligibility,
        rankedMatches,
        topMatches,
        closingSoonMatches,
        interestMatches,
        newForYouMatches,
        stats,
      }}
    >
      {children}
    </StudentContext.Provider>
  );
};

export const useStudent = () => {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error("useStudent must be used within a StudentProvider");
  }
  return context;
};
