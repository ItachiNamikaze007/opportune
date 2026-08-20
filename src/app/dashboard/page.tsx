"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useStudent } from "@/context/StudentContext";
import { useSaved } from "@/context/SavedContext";
import { OpportunityCard } from "@/components/ui/OpportunityCard";
import { StatCard } from "@/components/ui/StatCard";
import { ProfileProgress } from "@/components/ui/ProfileProgress";
import { calculateEligibility } from "@/services/eligibilityEngine";
import {
  Sparkles,
  Flame,
  Target,
  Clock,
  Compass,
  ArrowRight,
  ShieldCheck,
  Zap,
  Bookmark,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export default function DashboardPage() {
  const {
    studentProfile,
    opportunitiesWithEligibility,
    topMatches,
    closingSoonMatches,
    newForYouMatches,
    interestMatches,
    stats,
  } = useStudent();
  const { savedCount } = useSaved();

  // Greeting based on time
  const firstName = studentProfile.name ? studentProfile.name.split(" ")[0] : "Student";

  // Slices for top section grids (max 4 per section)
  const closingSoonList = useMemo(() => {
    return closingSoonMatches.slice(0, 4).map((r) => ({
      opportunity: r.opportunity,
      eligibility: calculateEligibility(studentProfile, r.opportunity),
    }));
  }, [closingSoonMatches, studentProfile]);

  const bestMatchesList = useMemo(() => {
    return topMatches.slice(0, 4).map((r) => ({
      opportunity: r.opportunity,
      eligibility: calculateEligibility(studentProfile, r.opportunity),
    }));
  }, [topMatches, studentProfile]);

  const newForYouList = useMemo(() => {
    return newForYouMatches.slice(0, 4).map((r) => ({
      opportunity: r.opportunity,
      eligibility: calculateEligibility(studentProfile, r.opportunity),
    }));
  }, [newForYouMatches, studentProfile]);

  const recommendedList = useMemo(() => {
    return interestMatches.slice(0, 4).map((r) => ({
      opportunity: r.opportunity,
      eligibility: calculateEligibility(studentProfile, r.opportunity),
    }));
  }, [interestMatches, studentProfile]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Personalized Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 text-xs font-semibold">
              Personalized Discovery Feed
            </span>
            <span className="text-xs text-slate-400 font-medium">
              • {studentProfile.branch || "Engineering"} (Year {studentProfile.currentYear})
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight mt-1.5">
            Good morning, {firstName} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Here are verified opportunities that match your specific eligibility criteria.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/explore"
            className="px-4 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition-all shadow-lg shadow-brand-600/20 flex items-center gap-1.5"
          >
            <Compass className="w-4 h-4" />
            <span>Explore All 20+ Listings</span>
          </Link>
        </div>
      </div>

      {/* Hero Stats Card Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Matched Opportunities"
          value={`${opportunitiesWithEligibility.length} Active`}
          subtitle="100% evaluated for you"
          icon={Target}
          iconBgColor="bg-brand-500/10"
          iconColor="text-brand-400"
          badgeText={`${stats.eligibleCount} You're Eligible`}
          badgeType="positive"
        />

        <StatCard
          title="Closing Soon"
          value={`${stats.closingSoonCount} Opportunities`}
          subtitle="Deadlines within 25 days"
          icon={Flame}
          iconBgColor="bg-rose-500/10"
          iconColor="text-rose-400"
          badgeText="Action required"
          badgeType="warning"
        />

        <StatCard
          title="Top Eligibility Matches"
          value={`${stats.highMatchCount} Matches`}
          subtitle="≥80% criteria met"
          icon={Sparkles}
          iconBgColor="bg-emerald-500/10"
          iconColor="text-emerald-400"
          badgeText="High Probability"
          badgeType="positive"
        />

        <StatCard
          title="Saved & Bookmarked"
          value={`${savedCount} Saved`}
          subtitle="Quick access & tracker"
          icon={Bookmark}
          iconBgColor="bg-purple-500/10"
          iconColor="text-purple-400"
          badgeText="In your list"
          badgeType="neutral"
        />
      </div>

      {/* Profile Completeness Recommendation Bar */}
      <ProfileProgress />

      {/* SECTION 1: 🔥 Closing Soon */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Flame className="w-5 h-5 fill-rose-500/20" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                Closing Soon
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Opportunities with deadlines approaching in the next few days.
              </p>
            </div>
          </div>
          <Link
            href="/explore?closing=true"
            className="text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1 hover:underline"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {closingSoonList.map(({ opportunity, eligibility }) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              eligibility={eligibility}
            />
          ))}
        </div>
      </section>

      {/* SECTION 2: 🎯 Best Matches */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                Best Matches For You
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ranked by deterministic eligibility match with your degree, branch, year & CGPA.
              </p>
            </div>
          </div>
          <Link
            href="/explore?sort=best_match"
            className="text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1 hover:underline"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {bestMatchesList.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center mx-auto border border-brand-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">We're looking for opportunities for you</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Complete your profile, add your key engineering skills, and select your interests to unlock personalized matches.
            </p>
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-md"
            >
              <span>Complete Profile Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {bestMatchesList.map(({ opportunity, eligibility }) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                eligibility={eligibility}
                featured={eligibility.score >= 90}
              />
            ))}
          </div>
        )}
      </section>

      {/* SECTION 3: 🆕 New For You */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                New This Week
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Freshly verified government initiatives and premier industry challenges.
              </p>
            </div>
          </div>
          <Link
            href="/explore?sort=newest"
            className="text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1 hover:underline"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {newForYouList.map(({ opportunity, eligibility }) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              eligibility={eligibility}
            />
          ))}
        </div>
      </section>

      {/* SECTION 4: 📌 Recommended For You (Based on Interests) */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                Recommended by Your Interests
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tailored for your selected tracks ({studentProfile.interests.join(", ")}).
              </p>
            </div>
          </div>
          <Link
            href="/profile"
            className="text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1 hover:underline"
          >
            <span>Edit interests</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {recommendedList.map(({ opportunity, eligibility }) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              eligibility={eligibility}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
