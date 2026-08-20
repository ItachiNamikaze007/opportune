import React from "react";
import { EligibilityStatus } from "@/types";
import { getEligibilityMeta } from "@/services/eligibilityEngine";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface EligibilityBadgeProps {
  status: EligibilityStatus;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

export const EligibilityBadge: React.FC<EligibilityBadgeProps> = ({
  status,
  size = "md",
  showIcon = true,
}) => {
  const meta = getEligibilityMeta(status);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-xs font-medium gap-1.5",
    lg: "px-3.5 py-1.5 text-sm font-semibold gap-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border transition-all ${meta.colorClass} ${sizeClasses[size]}`}
    >
      {showIcon && (
        <>
          {status === "eligible" && <CheckCircle2 className={`${iconSizes[size]} text-emerald-500`} />}
          {status === "potentially_eligible" && (
            <AlertTriangle className={`${iconSizes[size]} text-amber-500`} />
          )}
          {status === "not_eligible" && <XCircle className={`${iconSizes[size]} text-rose-500`} />}
        </>
      )}
      <span>{meta.label}</span>
    </span>
  );
};
