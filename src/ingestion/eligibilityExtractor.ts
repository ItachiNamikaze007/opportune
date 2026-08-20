import type { Degree, EligibilityCriteria } from "@/types";
import type { ExtractedEligibility, RawOpportunityRecord } from "./types";

/**
 * Extracts structured eligibility information from raw records and text.
 * Strictly adheres to truth in source: Never invents requirements not present in source.
 */
export function extractEligibility(raw: RawOpportunityRecord): ExtractedEligibility {
  const combinedText = [
    raw.rawContent || "",
    raw.descriptionRaw || "",
    raw.fullDescriptionRaw || "",
    (raw.degreesRaw || []).join(" "),
    (raw.branchesRaw || []).join(" "),
  ].join("\n");

  const allowedDegrees: Degree[] = [];
  const allowedBranches: string[] = [];
  const allowedYears: number[] = [];
  let minCGPA: number | undefined = undefined;
  let maxAge: number | undefined = undefined;
  let minAge: number | undefined = undefined;
  const requiredSkills: string[] = raw.skillsRaw ? [...raw.skillsRaw] : [];
  let eligibleGender: "all" | "female" | "male" | "other" = "all";
  let domicileRequired = "All India";

  let confidencePoints = 0;
  let totalChecks = 0;

  // 1. Degree Extraction
  totalChecks++;
  if (raw.degreesRaw && raw.degreesRaw.length > 0) {
    raw.degreesRaw.forEach((d) => {
      const deg = d.trim() as Degree;
      if (!allowedDegrees.includes(deg)) allowedDegrees.push(deg);
    });
    confidencePoints++;
  } else {
    // Regex scan
    const degreePatterns: { regex: RegExp; degree: Degree }[] = [
      { regex: /\b(b\.?tech|bachelor of technology)\b/i, degree: "B.Tech" },
      { regex: /\b(b\.?e\.?|bachelor of engineering)\b/i, degree: "B.E." },
      { regex: /\b(m\.?tech|master of technology)\b/i, degree: "M.Tech" },
      { regex: /\b(m\.?e\.?|master of engineering)\b/i, degree: "M.E." },
      { regex: /\b(bca|bachelor of computer applications)\b/i, degree: "BCA" },
      { regex: /\b(mca|master of computer applications)\b/i, degree: "MCA" },
      { regex: /\b(b\.?sc|bachelor of science)\b/i, degree: "B.Sc" },
      { regex: /\b(m\.?sc|master of science)\b/i, degree: "M.Sc" },
      { regex: /\b(ph\.?d|doctor of philosophy)\b/i, degree: "PhD" },
      { regex: /\b(diploma)\b/i, degree: "Diploma" },
    ];

    degreePatterns.forEach(({ regex, degree }) => {
      if (regex.test(combinedText) && !allowedDegrees.includes(degree)) {
        allowedDegrees.push(degree);
      }
    });

    if (allowedDegrees.length > 0) confidencePoints += 0.8;
  }

  // 2. Branch Extraction
  totalChecks++;
  if (raw.branchesRaw && raw.branchesRaw.length > 0) {
    raw.branchesRaw.forEach((b) => {
      if (!allowedBranches.includes(b.trim())) allowedBranches.push(b.trim());
    });
    confidencePoints++;
  } else {
    const branchPatterns = [
      { regex: /\b(computer science|cse|cs)\b/i, branch: "Computer Science" },
      { regex: /\b(information technology|it)\b/i, branch: "IT" },
      { regex: /\b(electronics|ece|eee)\b/i, branch: "Electronics" },
      { regex: /\b(electrical|ee)\b/i, branch: "Electrical" },
      { regex: /\b(mechanical|me)\b/i, branch: "Mechanical" },
      { regex: /\b(civil|ce)\b/i, branch: "Civil" },
      { regex: /\b(data science|ai|artificial intelligence)\b/i, branch: "Data Science" },
      { regex: /\b(economics|policy|public policy)\b/i, branch: "Economics" },
    ];

    branchPatterns.forEach(({ regex, branch }) => {
      if (regex.test(combinedText) && !allowedBranches.includes(branch)) {
        allowedBranches.push(branch);
      }
    });

    if (allowedBranches.length > 0) confidencePoints += 0.8;
  }

  // 3. Study Year Extraction
  totalChecks++;
  if (raw.yearsRaw && raw.yearsRaw.length > 0) {
    raw.yearsRaw.forEach((y) => {
      const num = typeof y === "number" ? y : parseInt(String(y), 10);
      if (num && !allowedYears.includes(num)) allowedYears.push(num);
    });
    confidencePoints++;
  } else {
    if (/\b(1st year|first year)\b/i.test(combinedText)) allowedYears.push(1);
    if (/\b(2nd year|second year)\b/i.test(combinedText)) allowedYears.push(2);
    if (/\b(3rd year|third year|pre-final)\b/i.test(combinedText)) allowedYears.push(3);
    if (/\b(4th year|fourth year|final year)\b/i.test(combinedText)) allowedYears.push(4);
    if (allowedYears.length > 0) confidencePoints += 0.7;
  }

  // 4. CGPA / Percentage Extraction
  totalChecks++;
  if (raw.cgpaRaw !== undefined && raw.cgpaRaw !== null) {
    minCGPA = typeof raw.cgpaRaw === "number" ? raw.cgpaRaw : parseFloat(String(raw.cgpaRaw)) || undefined;
    confidencePoints++;
  } else {
    const cgpaMatch = combinedText.match(/\b([5-9]\.[0-9]{1,2})\s*(cgpa|gpa|\/10)/i);
    const percentageMatch = combinedText.match(/\b(60|65|70|75|80)%\s*(marks|aggregate)?/i);

    if (cgpaMatch) {
      minCGPA = parseFloat(cgpaMatch[1]);
      confidencePoints += 0.85;
    } else if (percentageMatch) {
      // 60% = 6.0 CGPA equivalent
      minCGPA = parseFloat((parseInt(percentageMatch[1], 10) / 10).toFixed(1));
      confidencePoints += 0.8;
    }
  }

  // 5. Age Limits
  totalChecks++;
  if (raw.ageLimitRaw !== undefined && raw.ageLimitRaw !== null) {
    maxAge = typeof raw.ageLimitRaw === "number" ? raw.ageLimitRaw : parseInt(String(raw.ageLimitRaw), 10) || undefined;
    confidencePoints++;
  } else {
    const maxAgeMatch = combinedText.match(/\b(not exceeding|maximum age|up to|age limit of)\s*([0-9]{2})\s*years?/i);
    const minAgeMatch = combinedText.match(/\b(minimum age|at least)\s*([0-9]{2})\s*years?/i);

    if (maxAgeMatch) {
      maxAge = parseInt(maxAgeMatch[2], 10);
      confidencePoints += 0.9;
    }
    if (minAgeMatch) {
      minAge = parseInt(minAgeMatch[2], 10);
    }
  }

  // 6. Gender & Domicile
  if (/\b(women only|female candidates only|girls only)\b/i.test(combinedText)) {
    eligibleGender = "female";
  }

  // Safe defaults if completely unconstrained in source
  if (allowedDegrees.length === 0) {
    allowedDegrees.push("All Degrees");
  }
  if (allowedBranches.length === 0) {
    allowedBranches.push("All Branches");
  }
  if (allowedYears.length === 0) {
    allowedYears.push(1, 2, 3, 4);
  }

  const confidence = Math.min(1.0, Math.max(0.5, Number((confidencePoints / totalChecks).toFixed(2))));

  const criteria: EligibilityCriteria = {
    allowedDegrees,
    allowedBranches,
    allowedYears,
    minCGPA,
    maxAge,
    requiredSkills,
    eligibleLocations: raw.locationRaw ? [raw.locationRaw] : ["All India"],
    eligibleGender,
    domicileRequired,
  };

  return {
    criteria,
    sourceText: combinedText.substring(0, 400).trim(),
    confidence,
  };
}
