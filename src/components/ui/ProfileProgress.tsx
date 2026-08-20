"use client";

import React from "react";
import { useStudent } from "@/context/StudentContext";
import { Sparkles, ArrowUpRight, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface ProfileProgressProps {
  compact?: boolean;
}

export const ProfileProgress: React.FC<ProfileProgressProps> = ({ compact = false }) => {
  const { profileCompleteness, missingFields } = useStudent();

  if (compact) {
    return (
      <Link
        href="/profile"
        className="group flex items-center gap-3 p-2.5 px-3 rounded-2xl bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 transition-all"
      >
        <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-brand-500/20"
              strokeWidth="4"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              strokeDasharray={`${profileCompleteness}, 100`}
              strokeWidth="4"
              strokeLinecap="round"
              className="text-brand-400 transition-all duration-700"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="absolute text-[10px] font-bold text-brand-300">
            {profileCompleteness}%
          </span>
        </div>
        <div className="flex-1 min-w-0 hidden md:block">
          <p className="text-xs font-semibold text-slate-200 group-hover:text-brand-300 transition-colors">
            Profile {profileCompleteness}%
          </p>
          <p className="text-[10px] text-slate-400 truncate">
            {profileCompleteness === 100
              ? "All eligible criteria unlocked!"
              : `Add ${missingFields[0] || "details"} for more matches`}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <div className="rounded-3xl p-5 sm:p-6 bg-gradient-to-r from-brand-950/70 via-indigo-950/60 to-slate-900 border border-brand-500/30 text-white shadow-xl relative overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-brand-500/20 text-brand-300">
              <Sparkles className="w-4 h-4" />
            </span>
            <h4 className="text-base font-bold text-white">
              Profile Completeness: {profileCompleteness}%
            </h4>
          </div>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            {profileCompleteness === 100 ? (
              "Awesome! Your profile is 100% complete. You're receiving maximum personalized opportunity discovery."
            ) : (
              <>
                Complete your profile to unlock more opportunities. Missing:{" "}
                <span className="font-semibold text-brand-300">
                  {missingFields.slice(0, 3).join(", ")}
                </span>
                .
              </>
            )}
          </p>
        </div>

        <Link
          href="/profile"
          className="shrink-0 px-4 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-brand-600/30"
        >
          <span>{profileCompleteness === 100 ? "Review Profile" : "Complete Profile"}</span>
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Visual Progress Bar */}
      <div className="mt-4 w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-700/50">
        <div
          className="bg-gradient-to-r from-brand-500 to-emerald-400 h-full rounded-full transition-all duration-700"
          style={{ width: `${profileCompleteness}%` }}
        />
      </div>
    </div>
  );
};
