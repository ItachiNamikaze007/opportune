"use client";

import React, { useState, useMemo } from "react";
import { useSaved } from "@/context/SavedContext";
import { useStudent } from "@/context/StudentContext";
import { OpportunityCard } from "@/components/ui/OpportunityCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bookmark, Flame, Clock, Sparkles } from "lucide-react";

export default function SavedPage() {
  const { savedOpportunityIds } = useSaved();
  const { opportunitiesWithEligibility } = useStudent();
  const [activeTab, setActiveTab] = useState<"all" | "deadline_soon" | "top_matches">("all");

  const savedList = useMemo(() => {
    return opportunitiesWithEligibility.filter(({ opportunity }) =>
      savedOpportunityIds.includes(opportunity.id)
    );
  }, [opportunitiesWithEligibility, savedOpportunityIds]);

  const displayedList = useMemo(() => {
    if (activeTab === "deadline_soon") {
      return [...savedList].sort(
        (a, b) =>
          new Date(a.opportunity.deadline).getTime() - new Date(b.opportunity.deadline).getTime()
      );
    }
    if (activeTab === "top_matches") {
      return [...savedList].sort((a, b) => b.eligibility.score - a.eligibility.score);
    }
    return savedList;
  }, [savedList, activeTab]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-purple-500/10 text-purple-400">
              <Bookmark className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
              Bookmarks & Watchlist
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            Saved Opportunities ({savedList.length})
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Keep track of bookmarks before deadlines close.
          </p>
        </div>

        {/* Tab Filters */}
        {savedList.length > 0 && (
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                activeTab === "all"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-white"
              }`}
            >
              All Saved ({savedList.length})
            </button>
            <button
              onClick={() => setActiveTab("deadline_soon")}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1 ${
                activeTab === "deadline_soon"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-white"
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>Deadline Soon</span>
            </button>
            <button
              onClick={() => setActiveTab("top_matches")}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1 ${
                activeTab === "top_matches"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Top Matches</span>
            </button>
          </div>
        )}
      </div>

      {/* Grid */}
      {displayedList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
          {displayedList.map(({ opportunity, eligibility }) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              eligibility={eligibility}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bookmark}
          title="No Saved Opportunities Yet"
          description="When you explore opportunities, click the bookmark icon on any card to save it here for quick deadline tracking."
          actionText="Explore Opportunities"
          actionHref="/explore"
        />
      )}
    </div>
  );
}
