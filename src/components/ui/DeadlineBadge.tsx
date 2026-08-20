import React from "react";
import { Clock, Flame, AlertCircle, CheckCircle2 } from "lucide-react";
import { Opportunity } from "@/types";
import { getOpportunityStatus, OpportunityStatusResult } from "@/services/opportunityStatusResolver";

interface DeadlineBadgeProps {
  deadline: string; // ISO format e.g. "2026-08-28"
  opportunity?: Opportunity;
  compact?: boolean;
}

export const DeadlineBadge: React.FC<DeadlineBadgeProps> = ({
  deadline,
  opportunity,
  compact = false,
}) => {
  // Use opportunity object if provided, otherwise mock a minimal container for status resolution
  const oppForResolver: Opportunity = opportunity || {
    id: "temp",
    title: "",
    organization: "",
    category: "job",
    categoryLabel: "",
    description: "",
    fullDescription: "",
    deadline,
    location: "",
    remote: false,
    stipendOrPrize: "",
    stipendType: "stipend",
    officialUrl: "",
    verificationStatus: "verified",
    lastVerified: "2026-08-18",
    tags: [],
    benefits: [],
    applicationSteps: [],
    importantDates: [],
    eligibilityCriteria: { allowedDegrees: [], allowedBranches: [], allowedYears: [] },
  };

  const statusResult: OpportunityStatusResult = getOpportunityStatus(oppForResolver);

  let formattedDate = deadline;
  const target = new Date(deadline);
  if (!isNaN(target.getTime())) {
    formattedDate = target.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  if (compact) {
    if (statusResult.status === "EXPIRED" || statusResult.status === "REGISTRATION_CLOSED") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          <span>Closed ({formattedDate})</span>
        </span>
      );
    }

    if (statusResult.status === "UNKNOWN") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
          <span>Status unverified</span>
        </span>
      );
    }

    if (statusResult.status === "CLOSING_SOON") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-500">
          <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
          <span>{statusResult.daysRemaining} {statusResult.daysRemaining === 1 ? "day" : "days"} left</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
        <Clock className="w-3.5 h-3.5" />
        <span>{formattedDate}</span>
      </span>
    );
  }

  // Full variant
  if (statusResult.status === "EXPIRED" || statusResult.status === "REGISTRATION_CLOSED") {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
        <span>Closed on {formattedDate}</span>
      </div>
    );
  }

  if (statusResult.status === "UNKNOWN") {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
        <span>Status needs verification ({formattedDate})</span>
      </div>
    );
  }

  if (statusResult.status === "CLOSING_SOON") {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold animate-pulse-subtle">
        <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
        <span>Closing in {statusResult.daysRemaining} days ({formattedDate})</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-800/60 text-slate-300 border border-slate-700/60">
      <Clock className="w-3.5 h-3.5 text-slate-400" />
      <span>Deadline: {formattedDate}</span>
    </div>
  );
};
