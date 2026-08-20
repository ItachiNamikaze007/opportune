import {
  EligibilityCriteria,
  EligibilityResult,
  EligibilityStatus,
  Opportunity,
  StudentProfile,
} from "@/types";

/**
 * Deterministic Eligibility Rules Engine
 * Calculates score (0-100) and eligibility status based on student profile.
 * Designed to be clean, modular, and bridge PostgreSQL eligibility rules seamlessly.
 *
 * NOTE: Score represents Profile/Eligibility Match ONLY. Never selection chance.
 */
export function calculateEligibility(
  student: StudentProfile,
  opportunity: Opportunity,
  customCriteria?: EligibilityCriteria
): EligibilityResult {
  const criteria = customCriteria || opportunity.eligibilityCriteria;
  let totalScore = 0;
  const breakdown: EligibilityResult["breakdown"] = [];
  const reasons: string[] = [];
  const mismatches: string[] = [];
  const summaryNotes: string[] = [];

  // 1. Degree Match (Weight: 30 pts)
  const isDegreeMatch =
    criteria.allowedDegrees.includes("All Degrees") ||
    criteria.allowedDegrees.includes(student.degree);
  const degreeScore = isDegreeMatch ? 30 : 0;
  totalScore += degreeScore;
  breakdown.push({
    criterion: "Degree Requirement",
    matched: isDegreeMatch,
    requiredText: criteria.allowedDegrees.join(", "),
    studentText: student.degree || "Not specified",
    weight: 30,
    earned: degreeScore,
  });
  if (isDegreeMatch) {
    reasons.push(`Degree matches (${student.degree})`);
    summaryNotes.push(`Degree matches (${student.degree})`);
  } else {
    mismatches.push(`Requires ${criteria.allowedDegrees.join(" or ")}`);
    summaryNotes.push(`Requires ${criteria.allowedDegrees.join(" or ")}`);
  }

  // 2. Branch Match (Weight: 20 pts)
  const isBranchMatch =
    criteria.allowedBranches.includes("All Branches") ||
    criteria.allowedBranches.some(
      (b) =>
        student.branch.toLowerCase().includes(b.toLowerCase()) ||
        b.toLowerCase().includes(student.branch.toLowerCase())
    );
  const branchScore = isBranchMatch ? 20 : 0;
  totalScore += branchScore;
  breakdown.push({
    criterion: "Eligible Branch / Discipline",
    matched: isBranchMatch,
    requiredText: criteria.allowedBranches.join(", "),
    studentText: student.branch || "Not specified",
    weight: 20,
    earned: branchScore,
  });
  if (isBranchMatch) {
    reasons.push(`Eligible discipline (${student.branch})`);
    summaryNotes.push(`Eligible discipline (${student.branch})`);
  } else {
    mismatches.push(`Branch ${student.branch} not listed in eligible disciplines`);
  }

  // 3. Academic Year Match (Weight: 15 pts)
  const isYearMatch =
    criteria.allowedYears.length === 0 ||
    criteria.allowedYears.includes(student.currentYear);
  const yearScore = isYearMatch ? 15 : 0;
  totalScore += yearScore;
  breakdown.push({
    criterion: "Current Academic Year",
    matched: isYearMatch,
    requiredText:
      criteria.allowedYears.length === 0
        ? "All study years eligible"
        : `Year ${criteria.allowedYears.join(", ")}`,
    studentText: `Year ${student.currentYear}`,
    weight: 15,
    earned: yearScore,
  });
  if (isYearMatch) {
    reasons.push(`Academic year ${student.currentYear} eligible`);
    summaryNotes.push(`Academic year ${student.currentYear} eligible`);
  } else {
    mismatches.push(`Requires study year ${criteria.allowedYears.join(", ")} (You: Year ${student.currentYear})`);
  }

  // 4. CGPA / Academic Performance (Weight: 15 pts)
  let isCgpaMatch = true;
  let cgpaEarned = 15;
  const minCGPA = criteria.minCGPA || 0;
  if (minCGPA > 0) {
    if (student.cgpa >= minCGPA) {
      isCgpaMatch = true;
      cgpaEarned = 15;
    } else if (student.cgpa >= minCGPA - 0.5) {
      // Near miss gives partial score
      isCgpaMatch = false;
      cgpaEarned = 7;
    } else {
      isCgpaMatch = false;
      cgpaEarned = 0;
    }
  }
  totalScore += cgpaEarned;
  breakdown.push({
    criterion: "Minimum CGPA / Percentage",
    matched: isCgpaMatch,
    requiredText: minCGPA > 0 ? `Minimum ${minCGPA.toFixed(1)} CGPA` : "No minimum CGPA required",
    studentText: `Your CGPA: ${student.cgpa.toFixed(1)}`,
    weight: 15,
    earned: cgpaEarned,
  });
  if (minCGPA > 0) {
    if (isCgpaMatch) {
      reasons.push(`CGPA requirement met (${student.cgpa} ≥ ${minCGPA})`);
      summaryNotes.push(`CGPA requirement met (${student.cgpa} ≥ ${minCGPA})`);
    } else {
      mismatches.push(`CGPA shortfall (Needs ${minCGPA}, your CGPA: ${student.cgpa})`);
      summaryNotes.push(`CGPA shortfall (Needs ${minCGPA}, you have ${student.cgpa})`);
    }
  }

  // 5. Skills Alignment (Weight: 10 pts)
  let skillsScore = 10;
  let isSkillsMatch = true;
  const requiredSkills = criteria.requiredSkills || [];
  if (requiredSkills.length > 0) {
    const studentSkillsLower = student.skills.map((s) => s.toLowerCase());
    const matchedSkills = requiredSkills.filter((req) =>
      studentSkillsLower.some((s) => s.includes(req.toLowerCase()) || req.toLowerCase().includes(s))
    );
    const matchRatio = matchedSkills.length / requiredSkills.length;
    skillsScore = Math.round(matchRatio * 10);
    isSkillsMatch = matchRatio >= 0.5;
    breakdown.push({
      criterion: "Key Skills & Tools",
      matched: isSkillsMatch,
      requiredText: requiredSkills.join(", "),
      studentText:
        matchedSkills.length > 0
          ? `Matched: ${matchedSkills.join(", ")}`
          : "None matched currently",
      weight: 10,
      earned: skillsScore,
    });
    if (matchedSkills.length > 0) {
      reasons.push(`Relevant skills matched (${matchedSkills.slice(0, 3).join(", ")})`);
      summaryNotes.push(`Relevant skills matched (${matchedSkills.slice(0, 3).join(", ")})`);
    } else {
      mismatches.push(`Requires skills: ${requiredSkills.join(", ")}`);
    }
  } else {
    breakdown.push({
      criterion: "Key Skills & Tools",
      matched: true,
      requiredText: "No specific skill prerequisites",
      studentText: "All skills welcome",
      weight: 10,
      earned: 10,
    });
  }
  totalScore += skillsScore;

  // 6. Location / Remote Compatibility (Weight: 5 pts)
  let isLocationMatch = true;
  let locationScore = 5;
  if (opportunity.remote) {
    isLocationMatch = true;
    locationScore = 5;
    reasons.push("Remote opportunity available anywhere");
  } else if (criteria.eligibleLocations && criteria.eligibleLocations.length > 0) {
    const studentState = (student.state || "").toLowerCase();
    const studentCity = (student.city || "").toLowerCase();
    isLocationMatch = criteria.eligibleLocations.some((loc) => {
      const l = loc.toLowerCase();
      return (
        (studentState && (l.includes(studentState) || studentState.includes(l))) ||
        (studentCity && (l.includes(studentCity) || studentCity.includes(l))) ||
        l === "all india" ||
        l === "pan india"
      );
    });
    locationScore = isLocationMatch ? 5 : 2;
    if (isLocationMatch) {
      reasons.push(`Location matches (${student.city || "Pan India"})`);
    } else {
      mismatches.push(`Location restricted to ${criteria.eligibleLocations.join(", ")}`);
    }
  }
  totalScore += locationScore;
  breakdown.push({
    criterion: "Location & Mode",
    matched: isLocationMatch,
    requiredText: opportunity.remote ? "Remote / Virtual" : opportunity.location,
    studentText: `Based in ${student.city || "India"}, ${student.state || "India"}`,
    weight: 5,
    earned: locationScore,
  });

  // 7. Age & Category/Domicile (Weight: 5 pts)
  let isOtherMatch = true;
  let otherScore = 5;
  if (criteria.maxAge && student.age > criteria.maxAge) {
    isOtherMatch = false;
    otherScore = 0;
    mismatches.push(`Age limit ${criteria.maxAge} exceeded (You: ${student.age})`);
    summaryNotes.push(`Age limit ${criteria.maxAge} exceeded`);
  }
  if (criteria.domicileRequired && criteria.domicileRequired !== "All India") {
    if (student.state.toLowerCase() !== criteria.domicileRequired.toLowerCase()) {
      isOtherMatch = false;
      otherScore = 1;
      mismatches.push(`Domicile required: ${criteria.domicileRequired}`);
      summaryNotes.push(`Domicile required: ${criteria.domicileRequired}`);
    }
  }
  totalScore += otherScore;
  breakdown.push({
    criterion: "Age & Eligibility Criteria",
    matched: isOtherMatch,
    requiredText: criteria.maxAge ? `Age limit: ≤ ${criteria.maxAge} yrs` : "Standard criteria",
    studentText: `Age: ${student.age} yrs`,
    weight: 5,
    earned: otherScore,
  });

  // Clamp score
  const finalScore = Math.min(100, Math.max(0, Math.round(totalScore)));

  // Categorize
  let status: EligibilityStatus = "not_eligible";
  if (finalScore >= 75) {
    status = "eligible";
  } else if (finalScore >= 50) {
    status = "potentially_eligible";
  } else {
    status = "not_eligible";
  }

  return {
    score: finalScore,
    status,
    reasons,
    mismatches,
    breakdown,
    summaryNotes,
  };
}

/**
 * Helper to get user-friendly label and color palette based on eligibility status
 */
export function getEligibilityMeta(status: EligibilityStatus) {
  switch (status) {
    case "eligible":
      return {
        label: "You're eligible",
        shortLabel: "Eligible",
        colorClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        badgeBg: "bg-emerald-600",
        iconColor: "text-emerald-500",
        dotClass: "bg-emerald-500",
        ringClass: "ring-emerald-500/30",
      };
    case "potentially_eligible":
      return {
        label: "Potentially eligible",
        shortLabel: "Verify Criteria",
        colorClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        badgeBg: "bg-amber-500",
        iconColor: "text-amber-500",
        dotClass: "bg-amber-500",
        ringClass: "ring-amber-500/30",
      };
    case "not_eligible":
    default:
      return {
        label: "Criteria mismatch",
        shortLabel: "Not Eligible",
        colorClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        badgeBg: "bg-rose-500",
        iconColor: "text-rose-500",
        dotClass: "bg-rose-500",
        ringClass: "ring-rose-500/30",
      };
  }
}
