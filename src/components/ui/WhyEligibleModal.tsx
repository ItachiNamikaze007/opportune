"use client";

import React from "react";
import { Opportunity, EligibilityResult } from "@/types";
import { Check, X, AlertTriangle, ShieldCheck, ExternalLink, UserCheck } from "lucide-react";
import Link from "next/link";

interface WhyEligibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: Opportunity;
  eligibility: EligibilityResult;
}

export const WhyEligibleModal: React.FC<WhyEligibleModalProps> = ({
  isOpen,
  onClose,
  opportunity,
  eligibility,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl text-slate-100 relative overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header decoration */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-500 via-emerald-400 to-indigo-500" />

        {/* Modal Top Bar */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">
                Eligibility Breakdown
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  eligibility.status === "eligible"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : eligibility.status === "potentially_eligible"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                }`}
              >
                {eligibility.score}% Match Score
              </span>
            </div>
            <h3 className="text-lg font-bold text-white line-clamp-1">{opportunity.title}</h3>
            <p className="text-xs text-slate-400">{opportunity.organization}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Criteria Breakdown */}
        <div className="overflow-y-auto py-4 space-y-3 pr-1 flex-1">
          <p className="text-xs text-slate-300 font-medium">
            Here is how your student profile compares with this opportunity's criteria:
          </p>

          <div className="space-y-2.5">
            {eligibility.breakdown.map((item, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-2xl border transition-all ${
                  item.matched
                    ? "bg-slate-800/40 border-slate-700/60"
                    : "bg-rose-950/20 border-rose-800/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        item.matched
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-rose-500/20 text-rose-400"
                      }`}
                    >
                      {item.matched ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-200">
                        {item.criterion}
                      </span>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        <span className="text-slate-500">Required:</span> {item.requiredText}
                      </div>
                      <div className="text-[11px] font-medium text-slate-300 mt-0.5">
                        <span className="text-slate-500">Your profile:</span> {item.studentText}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 font-medium shrink-0">
                    +{item.earned}/{item.weight} pts
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Official Verification Disclaimer Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 mt-4">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-300">
                Official Verification Notice
              </p>
              <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                Eligibility calculation is a simulated match based on your saved profile. Always verify specific clauses on the official notification before final submission.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <Link
            href="/profile"
            onClick={onClose}
            className="text-xs text-brand-400 hover:text-brand-300 font-medium inline-flex items-center gap-1 hover:underline"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Update Profile to Match More
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <Link
              href={`/opportunities/${opportunity.id}`}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors inline-flex items-center gap-1.5 shadow-lg shadow-brand-600/20"
            >
              <span>View Full Details</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
