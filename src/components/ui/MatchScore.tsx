import React from "react";

interface MatchScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
  variant?: "pill" | "compact" | "radial";
}

export const MatchScore: React.FC<MatchScoreProps> = ({
  score,
  size = "md",
  variant = "pill",
}) => {
  // Score color gradient
  const getScoreColor = (val: number) => {
    if (val >= 75) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    if (val >= 50) return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    return "text-slate-400 bg-slate-500/10 border-slate-500/20";
  };

  const getProgressColor = (val: number) => {
    if (val >= 75) return "#10b981"; // Emerald
    if (val >= 50) return "#f59e0b"; // Amber
    return "#94a3b8"; // Slate
  };

  if (variant === "radial") {
    const strokeDash = (score / 100) * 100;
    return (
      <div className="relative flex items-center justify-center w-14 h-14">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-slate-200 dark:text-slate-800"
            strokeWidth="3.5"
            stroke="currentColor"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            strokeDasharray={`${strokeDash}, 100`}
            strokeWidth="3.5"
            strokeLinecap="round"
            stroke={getProgressColor(score)}
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <div className="absolute text-center flex flex-col items-center justify-center">
          <span className="text-xs font-bold leading-none">{score}%</span>
          <span className="text-[8px] text-slate-400 font-medium">Match</span>
        </div>
      </div>
    );
  }

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs font-medium",
    md: "px-2.5 py-1 text-xs font-semibold",
    lg: "px-3.5 py-1.5 text-sm font-bold",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${getScoreColor(
        score
      )} ${sizeClasses[size]}`}
      title="Calculated from your student profile degree, branch, year, CGPA and skills"
    >
      <span className="w-1.5 h-1.5 rounded-full animate-pulse-subtle bg-current" />
      <span>{score}% Eligibility Match</span>
    </span>
  );
};
