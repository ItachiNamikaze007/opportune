"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Opportunity, EligibilityResult } from "@/types";
import { EligibilityBadge } from "./EligibilityBadge";
import { MatchScore } from "./MatchScore";
import { DeadlineBadge } from "./DeadlineBadge";
import { WhyEligibleModal } from "./WhyEligibleModal";
import { useSaved } from "@/context/SavedContext";
import { getOpportunityStatus } from "@/services/opportunityStatusResolver";
import {
  Banknote,
  Bookmark,
  BookmarkCheck,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  HelpCircle,
  AlertTriangle,
  Info,
} from "lucide-react";

interface OpportunityCardProps {
  opportunity: Opportunity;
  eligibility: EligibilityResult;
  featured?: boolean;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
  opportunity,
  eligibility,
  featured = false,
}) => {
  const [isWhyModalOpen, setIsWhyModalOpen] = useState(false);
  const { isSaved, toggleSave } = useSaved();
  const saved = isSaved(opportunity.id);

  const statusResult = getOpportunityStatus(opportunity);

  const getOrgInitial = (org: string) => {
    return org.charAt(0).toUpperCase();
  };

  const getCategoryTheme = (category: string) => {
    switch (category) {
      case "government_exam":
      case "government_internship":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "hackathon":
      case "competition":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      case "scholarship":
      case "fellowship":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    }
  };

  return (
    <>
      <div
        className={`group relative flex flex-col justify-between rounded-3xl transition-all duration-300 p-5 bg-white dark:bg-slate-900 border ${
          statusResult.isExpired
            ? "border-slate-800/60 opacity-85 hover:opacity-100"
            : featured
            ? "border-brand-500/50 shadow-lg shadow-brand-500/5 ring-1 ring-brand-500/20"
            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xl dark:hover:shadow-brand-950/20"
        }`}
      >
        <div>
          {/* Top Bar: Category & Save Icon */}
          <div className="flex items-center justify-between gap-2 mb-3.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getCategoryTheme(
                  opportunity.category
                )}`}
              >
                {opportunity.categoryLabel}
              </span>
              {opportunity.remote && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60">
                  Remote
                </span>
              )}
            </div>

            <button
              onClick={() => toggleSave(opportunity.id)}
              className={`p-2 rounded-xl transition-colors ${
                saved
                  ? "bg-brand-500/10 text-brand-400 hover:bg-brand-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
              title={saved ? "Saved to your list" : "Save opportunity"}
              aria-label="Save opportunity"
            >
              {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>
          </div>

          {/* Org & Title */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-md">
              {getOrgInitial(opportunity.organization)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-medium text-slate-400 truncate">
                  {opportunity.organization}
                </span>
                {(opportunity.verificationStatus === "verified_gov" ||
                  opportunity.verificationStatus === "verified") && (
                  <span
                    className="inline-flex items-center text-blue-400"
                    title="Verified Official Source"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 fill-blue-500/20" />
                  </span>
                )}
              </div>
              <Link
                href={`/opportunities/${opportunity.id}`}
                className="group-hover:text-brand-400 transition-colors"
              >
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 mt-0.5">
                  {opportunity.title}
                </h3>
              </Link>
            </div>
          </div>

          {/* Short Description */}
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">
            {opportunity.description}
          </p>

          {/* Match Score & Status Highlights */}
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 mb-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <EligibilityBadge status={eligibility.status} size="sm" />
              <MatchScore score={eligibility.score} size="sm" />
            </div>

            {/* Quick summary reason snippet */}
            {eligibility.summaryNotes.length > 0 && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                <Sparkles className="w-3 h-3 text-brand-400 shrink-0" />
                <span className="truncate">{eligibility.summaryNotes.slice(0, 2).join(" • ")}</span>
              </p>
            )}
          </div>
        </div>

        {/* Bottom Details & Action Buttons */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
              <Banknote className="w-3.5 h-3.5 text-emerald-500" />
              <span>{opportunity.stipendOrPrize}</span>
            </div>
            <DeadlineBadge deadline={opportunity.deadline} opportunity={opportunity} compact />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => setIsWhyModalOpen(true)}
              className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-white bg-slate-200/60 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-brand-400" />
              <span>Why match?</span>
            </button>

            <Link
              href={`/opportunities/${opportunity.id}`}
              className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all shadow-md ${
                statusResult.isExpired
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  : "bg-brand-600 hover:bg-brand-500 text-white shadow-brand-600/10 hover:shadow-brand-600/20"
              }`}
            >
              <span>{statusResult.isExpired ? "View Details" : "View & Apply"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Why Match Modal Drawer */}
      <WhyEligibleModal
        isOpen={isWhyModalOpen}
        onClose={() => setIsWhyModalOpen(false)}
        opportunity={opportunity}
        eligibility={eligibility}
      />
    </>
  );
};
