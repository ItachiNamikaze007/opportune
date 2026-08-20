"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { mockOpportunities } from "@/data/mockOpportunities";
import { useStudent } from "@/context/StudentContext";
import { useSaved } from "@/context/SavedContext";
import { useApplication } from "@/context/ApplicationContext";
import { useToast } from "@/context/ToastContext";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { EligibilityBadge } from "@/components/ui/EligibilityBadge";
import { MatchScore } from "@/components/ui/MatchScore";
import { DeadlineBadge } from "@/components/ui/DeadlineBadge";
import { getOpportunityStatus } from "@/services/opportunityStatusResolver";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  ShieldCheck,
  MapPin,
  Calendar,
  Banknote,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Sparkles,
  Award,
  Layers,
  ChevronRight,
  Send,
  Info,
  AlertTriangle,
} from "lucide-react";

export default function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { getOpportunityEligibility, studentProfile } = useStudent();
  const { isSaved, toggleSave } = useSaved();
  const { addApplication, getApplicationByOppId } = useApplication();
  const { showToast } = useToast();

  const opportunity = mockOpportunities.find((o) => o.id === resolvedParams.id);
  if (!opportunity) {
    notFound();
  }

  const eligibility = getOpportunityEligibility(opportunity);
  const saved = isSaved(opportunity.id);
  const existingApp = getApplicationByOppId(opportunity.id);

  const [activeTab, setActiveTab] = useState<"about" | "eligibility" | "dates" | "steps">("about");

  const handleApplyClick = () => {
    // Add to application tracker automatically
    addApplication(opportunity.id, "applied", `Applied on ${new Date().toLocaleDateString()}`);
    // Open official portal in new tab
    window.open(opportunity.officialUrl, "_blank", "noopener,noreferrer");
    showToast(
      "Opening Official Website",
      "Added to your Application Tracker as 'Applied'.",
      "success"
    );
  };

  const statusResult = getOpportunityStatus(opportunity);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Back Button & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Opportunities</span>
        </Link>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/explore" className="hover:underline">
            Explore
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="truncate max-w-[150px]">{opportunity.categoryLabel}</span>
        </div>
      </div>

      {/* Demo / Expired Notices */}
      {opportunity.isDemo && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            <strong>Sample Demo Data:</strong> This opportunity contains illustrative sample criteria and dates for testing.
          </span>
        </div>
      )}

      {statusResult.isExpired && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          <span>
            <strong>Applications Closed:</strong> The registration window for this opportunity ended on {opportunity.deadline}.
          </span>
        </div>
      )}

      {/* Main Header Hero Card */}
      <div className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={opportunity.category} />
              {opportunity.remote ? (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  🌐 Remote / Virtual
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>{opportunity.location}</span>
                </span>
              )}
              {(opportunity.verificationStatus === "verified_gov" ||
                opportunity.verificationStatus === "verified") && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Source</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              {opportunity.title}
            </h1>

            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-medium">
              <span>{opportunity.organization}</span>
              <span>•</span>
              <span className="text-xs text-slate-400 font-mono">
                Verified: {opportunity.lastVerified}
              </span>
            </div>
          </div>

          {/* Quick Actions (Save & Share) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => toggleSave(opportunity.id, opportunity.title)}
              className={`p-3 rounded-2xl border transition-all flex items-center gap-2 text-xs font-bold ${
                saved
                  ? "bg-brand-600 text-white border-brand-500 shadow-lg shadow-brand-600/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              <span>{saved ? "Saved" : "Save"}</span>
            </button>
          </div>
        </div>

        {/* Quick Highlights Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Banknote className="w-3 h-3 text-emerald-400" /> Stipend / Prize
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
              {opportunity.stipendOrPrize}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3 text-rose-400" /> Application Deadline
            </span>
            <div className="mt-1">
              <DeadlineBadge deadline={opportunity.deadline} opportunity={opportunity} compact />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-brand-400" /> Eligibility Status
            </span>
            <div className="mt-1">
              <EligibilityBadge status={eligibility.status} size="sm" />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Award className="w-3 h-3 text-amber-400" /> Profile Match
            </span>
            <div className="mt-1">
              <MatchScore score={eligibility.score} size="sm" />
            </div>
          </div>
        </div>

        {/* Primary Call to Action Strip */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {statusResult.isExpired
                ? "This opportunity is closed. You can view historical details."
                : `Redirects directly to authentic application page on ${opportunity.organization}`}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {statusResult.isExpired ? (
              <button
                disabled
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-slate-800 text-slate-500 font-bold text-xs sm:text-sm border border-slate-700 cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>Applications Closed</span>
              </button>
            ) : (
              <button
                onClick={handleApplyClick}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs sm:text-sm transition-all shadow-xl shadow-brand-600/30 flex items-center justify-center gap-2"
              >
                <span>Apply on Official Website</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* WHY YOU'RE ELIGIBLE BREAKDOWN CARD (MANDATORY REQUIREMENT) */}
      <div className="rounded-3xl p-6 sm:p-7 bg-slate-900 border border-brand-500/30 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/20 text-brand-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Why you're eligible</h3>
              <p className="text-xs text-slate-400">
                Detailed breakdown of how your profile matches this opportunity's criteria.
              </p>
            </div>
          </div>
          <span className="text-xs px-3 py-1 rounded-full font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
            {eligibility.score}% Score
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {eligibility.breakdown.map((item, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl border ${
                item.matched
                  ? "bg-slate-800/60 border-slate-700/80"
                  : "bg-rose-950/20 border-rose-800/40"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    item.matched
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-rose-500/20 text-rose-400"
                  }`}
                >
                  {item.matched ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">{item.criterion}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    <span className="text-slate-500">Requirement:</span> {item.requiredText}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-200 mt-0.5">
                    <span className="text-slate-500 font-normal">Your Profile:</span> {item.studentText}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Verification Disclaimer Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-amber-300">Important:</strong> Eligibility should always be verified against the official notification before final submission.
          </p>
        </div>
      </div>

      {/* Tabs for detailed content */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab("about")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === "about"
                ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                : "text-slate-600 dark:text-slate-400 hover:text-white"
            }`}
          >
            About & Overview
          </button>
          <button
            onClick={() => setActiveTab("eligibility")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === "eligibility"
                ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                : "text-slate-600 dark:text-slate-400 hover:text-white"
            }`}
          >
            Eligibility Criteria
          </button>
          <button
            onClick={() => setActiveTab("dates")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === "dates"
                ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                : "text-slate-600 dark:text-slate-400 hover:text-white"
            }`}
          >
            Important Dates
          </button>
          <button
            onClick={() => setActiveTab("steps")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === "steps"
                ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                : "text-slate-600 dark:text-slate-400 hover:text-white"
            }`}
          >
            Application Steps
          </button>
        </div>

        {/* Tab 1: About */}
        {activeTab === "about" && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Detailed Description
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {opportunity.fullDescription}
              </p>
            </div>

            {opportunity.benefits && (
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Key Benefits & Perks
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {opportunity.benefits.map((b, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-700 dark:text-slate-300 font-medium"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Eligibility */}
        {activeTab === "eligibility" && (
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Official Eligibility Guidelines
            </h3>
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Allowed Degrees:</span>
                <span className="font-semibold text-white">
                  {opportunity.eligibilityCriteria.allowedDegrees.join(", ")}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Eligible Branches:</span>
                <span className="font-semibold text-white">
                  {opportunity.eligibilityCriteria.allowedBranches.join(", ")}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Eligible Study Years:</span>
                <span className="font-semibold text-white">
                  Year {opportunity.eligibilityCriteria.allowedYears.join(", ")}
                </span>
              </div>
              {opportunity.eligibilityCriteria.minCGPA && (
                <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Minimum CGPA:</span>
                  <span className="font-semibold text-white">
                    {opportunity.eligibilityCriteria.minCGPA.toFixed(1)} / 10.0
                  </span>
                </div>
              )}
              {opportunity.eligibilityCriteria.maxAge && (
                <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Age Limit:</span>
                  <span className="font-semibold text-white">
                    Up to {opportunity.eligibilityCriteria.maxAge} years
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Dates */}
        {activeTab === "dates" && (
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Important Dates & Deadlines
            </h3>
            <div className="space-y-3">
              {opportunity.importantDates?.map((d, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs"
                >
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {d.label}
                  </span>
                  <span className="font-bold font-mono text-brand-400">{d.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Steps */}
        {activeTab === "steps" && (
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              How to Apply (Step-by-Step)
            </h3>
            <div className="space-y-3">
              {opportunity.applicationSteps?.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs"
                >
                  <span className="w-5 h-5 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
