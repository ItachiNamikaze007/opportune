"use client";

import React from "react";
import { OpportunityCategory, EligibilityStatus } from "@/types";
import { Filter, SlidersHorizontal, ArrowUpDown, Check, Sparkles } from "lucide-react";

export interface FilterState {
  category: OpportunityCategory | "all";
  eligibility: EligibilityStatus | "all";
  remoteOnly: boolean;
  closingSoonOnly: boolean;
  sortBy: "best_match" | "deadline" | "newest";
  location?: string;
  degree?: string;
  branch?: string;
  year?: number;
}

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  resultCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  resultCount,
}) => {
  const categories: { label: string; value: OpportunityCategory | "all" }[] = [
    { label: "All Opportunities", value: "all" },
    { label: "⚡ Hackathons", value: "hackathon" },
    { label: "🎓 Scholarships", value: "scholarship" },
    { label: "💼 Internships", value: "internship" },
    { label: "🌱 Fellowships", value: "fellowship" },
    { label: "🏆 Competitions", value: "competition" },
    { label: "🔬 Research", value: "research" },
    { label: "📜 Govt Exams", value: "government_exam" },
  ];

  return (
    <div className="space-y-4">
      {/* Category Pills (Horizontal Scrollable) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
        {categories.map((cat) => {
          const isActive = filters.category === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => onFilterChange({ category: cat.value })}
              className={`px-3.5 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20 border border-brand-500"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Secondary Bar: Eligibility, Degree, Location, Remote, Deadline & Sort */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Degree Filter */}
          <select
            value={filters.degree || "all"}
            onChange={(e) => onFilterChange({ degree: e.target.value })}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
          >
            <option value="all">Degree: All</option>
            <option value="B.Tech">B.Tech / B.E.</option>
            <option value="M.Tech">M.Tech</option>
            <option value="MCA">MCA</option>
            <option value="B.Sc">B.Sc / M.Sc</option>
          </select>

          {/* Location Filter */}
          <select
            value={filters.location || "all"}
            onChange={(e) => onFilterChange({ location: e.target.value })}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
          >
            <option value="all">Location: All India</option>
            <option value="remote">Remote Only</option>
            <option value="Delhi">Delhi NCR</option>
            <option value="Karnataka">Karnataka / Bangalore</option>
            <option value="Maharashtra">Maharashtra / Mumbai</option>
          </select>

          {/* Eligibility Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => onFilterChange({ eligibility: "all" })}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                filters.eligibility === "all"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-200"
              }`}
            >
              All Match Levels
            </button>
            <button
              onClick={() => onFilterChange({ eligibility: "eligible" })}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                filters.eligibility === "eligible"
                  ? "bg-emerald-600 text-white shadow-sm font-semibold"
                  : "text-emerald-500 hover:text-emerald-400"
              }`}
            >
              🟢 Eligible Only
            </button>
          </div>

          {/* Remote Toggle */}
          <button
            onClick={() => onFilterChange({ remoteOnly: !filters.remoteOnly })}
            className={`px-3 py-1.5 rounded-xl border font-medium flex items-center gap-1.5 transition-all ${
              filters.remoteOnly
                ? "bg-brand-500/20 text-brand-300 border-brand-500/40 font-semibold"
                : "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🌐 Remote</span>
            {filters.remoteOnly && <Check className="w-3.5 h-3.5 text-brand-400" />}
          </button>

          {/* Closing Soon Toggle */}
          <button
            onClick={() => onFilterChange({ closingSoonOnly: !filters.closingSoonOnly })}
            className={`px-3 py-1.5 rounded-xl border font-medium flex items-center gap-1.5 transition-all ${
              filters.closingSoonOnly
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold"
                : "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-700"
            }`}
          >
            <span>🔥 Closing Soon</span>
            {filters.closingSoonOnly && <Check className="w-3.5 h-3.5 text-rose-400" />}
          </button>
        </div>

        {/* Right side: Sort Dropdown & Count */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="font-bold text-slate-900 dark:text-white">{resultCount}</span> opportunities
          </span>

          <div className="flex items-center gap-1.5 text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={filters.sortBy}
              onChange={(e) =>
                onFilterChange({
                  sortBy: e.target.value as FilterState["sortBy"],
                })
              }
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-900 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
            >
              <option value="best_match">Sort by: Best Match</option>
              <option value="deadline">Sort by: Deadline (Soonest)</option>
              <option value="newest">Sort by: Recently Added</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
