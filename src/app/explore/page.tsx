"use client";

import React, { useState, useMemo } from "react";
import { useStudent } from "@/context/StudentContext";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterBar, FilterState } from "@/components/ui/FilterBar";
import { OpportunityCard } from "@/components/ui/OpportunityCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Compass, Sparkles, SlidersHorizontal, RefreshCw } from "lucide-react";
import { getOpportunityStatus } from "@/services/opportunityStatusResolver";

export default function ExplorePage() {
  const { opportunitiesWithEligibility } = useStudent();
  const [searchQuery, setSearchQuery] = useState("");

  const [filters, setFilters] = useState<FilterState>({
    category: "all",
    eligibility: "all",
    remoteOnly: false,
    closingSoonOnly: false,
    sortBy: "best_match",
  });

  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  const resetFilters = () => {
    setSearchQuery("");
    setFilters({
      category: "all",
      eligibility: "all",
      remoteOnly: false,
      closingSoonOnly: false,
      sortBy: "best_match",
    });
  };

  // Filter and sort items
  const filteredOpportunities = useMemo(() => {
    let results = opportunitiesWithEligibility.filter(({ opportunity, eligibility }) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = opportunity.title.toLowerCase().includes(q);
        const matchesOrg = opportunity.organization.toLowerCase().includes(q);
        const matchesDesc = opportunity.description.toLowerCase().includes(q);
        const matchesTags = opportunity.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesOrg && !matchesDesc && !matchesTags) {
          return false;
        }
      }

      // 2. Category Filter
      if (filters.category !== "all" && opportunity.category !== filters.category) {
        return false;
      }

      // 3. Eligibility Status Filter
      if (filters.eligibility !== "all" && eligibility.status !== filters.eligibility) {
        return false;
      }

      // 4. Remote Only
      if (filters.remoteOnly && !opportunity.remote) {
        return false;
      }

      // 5. Closing Soon Only (strictly using getOpportunityStatus)
      const statusRes = getOpportunityStatus(opportunity);
      if (filters.closingSoonOnly && statusRes.status !== "CLOSING_SOON") {
        return false;
      }

      return true;
    });

    // Sort results (Active first, then by selected sort)
    results.sort((a, b) => {
      const statusA = getOpportunityStatus(a.opportunity);
      const statusB = getOpportunityStatus(b.opportunity);

      if (statusA.isExpired !== statusB.isExpired) {
        return statusA.isExpired ? 1 : -1;
      }

      if (filters.sortBy === "best_match") {
        return b.eligibility.score - a.eligibility.score;
      }
      if (filters.sortBy === "deadline") {
        return (
          new Date(a.opportunity.deadline).getTime() - new Date(b.opportunity.deadline).getTime()
        );
      }
      if (filters.sortBy === "newest") {
        return (
          new Date(b.opportunity.lastVerified).getTime() -
          new Date(a.opportunity.lastVerified).getTime()
        );
      }
      return 0;
    });

    return results;
  }, [opportunitiesWithEligibility, searchQuery, filters]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-brand-500/10 text-brand-400">
              <Compass className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold text-brand-500 uppercase tracking-wider">
              Discovery Engine
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            Explore Opportunities
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Search and filter verified government schemes, tech hackathons, and research fellowships.
          </p>
        </div>

        {(searchQuery ||
          filters.category !== "all" ||
          filters.eligibility !== "all" ||
          filters.remoteOnly ||
          filters.closingSoonOnly) && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-semibold p-2 rounded-xl bg-slate-800/60 border border-slate-700/60 w-fit transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search internships, exams, hackathons, scholarships, companies..."
      />

      {/* Modern Simple Filter & Category Bar */}
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        resultCount={filteredOpportunities.length}
      />

      {/* Results Grid */}
      {filteredOpportunities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
          {filteredOpportunities.map(({ opportunity, eligibility }) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              eligibility={eligibility}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No Matching Opportunities Found"
          description="We couldn't find any opportunities matching your selected search terms and filters. Try resetting the filters or broadening your search criteria."
          actionText="Reset All Filters"
          onAction={resetFilters}
        />
      )}
    </div>
  );
}
