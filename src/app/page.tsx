"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Award,
  BookOpen,
  Briefcase,
  Code,
  GraduationCap,
  Globe2,
  Building2,
  Compass,
  Trophy,
  Zap,
  TrendingUp,
  Flame,
  Star,
  Users,
} from "lucide-react";
import { MatchScore } from "@/components/ui/MatchScore";

export default function LandingPage() {
  const categories = [
    {
      name: "Government Exams",
      count: "14+ Active",
      icon: Award,
      color: "from-blue-500/20 to-indigo-500/10 text-blue-400 border-blue-500/30",
    },
    {
      name: "Government Internships",
      count: "8+ Schemes",
      icon: Building2,
      color: "from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30",
    },
    {
      name: "Private Internships",
      count: "24+ Top Tech",
      icon: Briefcase,
      color: "from-purple-500/20 to-pink-500/10 text-purple-400 border-purple-500/30",
    },
    {
      name: "Hackathons",
      count: "18+ National",
      icon: Code,
      color: "from-indigo-500/20 to-violet-500/10 text-indigo-400 border-indigo-500/30",
    },
    {
      name: "Scholarships",
      count: "₹12 Cr+ Pool",
      icon: GraduationCap,
      color: "from-amber-500/20 to-yellow-500/10 text-amber-400 border-amber-500/30",
    },
    {
      name: "Research Fellowships",
      count: "IISc, IITs, CERN",
      icon: BookOpen,
      color: "from-cyan-500/20 to-blue-500/10 text-cyan-400 border-cyan-500/30",
    },
    {
      name: "Full-Time Jobs",
      count: "High-CTC Grad",
      icon: TrendingUp,
      color: "from-sky-500/20 to-cyan-500/10 text-sky-400 border-sky-500/30",
    },
    {
      name: "Competitions",
      count: "Case & Tech",
      icon: Trophy,
      color: "from-orange-500/20 to-amber-500/10 text-orange-400 border-orange-500/30",
    },
    {
      name: "International Programs",
      count: "Canada, Germany, EU",
      icon: Globe2,
      color: "from-rose-500/20 to-red-500/10 text-rose-400 border-rose-500/30",
    },
    {
      name: "Fellowships",
      count: "Leadership & Impact",
      icon: Compass,
      color: "from-teal-500/20 to-emerald-500/10 text-teal-400 border-teal-500/30",
    },
  ];

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-12 sm:pt-20 pb-20 px-4 sm:px-6 lg:px-8">
        {/* Glow background effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-brand-500/15 blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/3 right-10 w-[300px] h-[250px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-5xl mx-auto text-center space-y-6">
          {/* Pill announcement badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-300 text-xs font-semibold animate-fade-in shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-brand-500" />
            <span>Next-Gen 2026 Student Discovery Platform</span>
          </div>

          {/* Primary Tagline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1]">
            You don't find opportunities. <br />
            <span className="bg-gradient-to-r from-brand-500 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              Opportunities find you.
            </span>
          </h1>

          {/* Supporting Text */}
          <p className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed">
            Create your profile once and discover internships, exams, hackathons, scholarships, jobs and research fellowships that match you.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/onboarding"
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm sm:text-base transition-all shadow-xl shadow-brand-600/30 flex items-center justify-center gap-2 group"
            >
              <span>Create My Profile</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/explore"
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm sm:text-base border border-slate-200 dark:border-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <span>Explore Opportunities</span>
            </Link>
          </div>

          {/* Trust Highlights */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              100% Free for Students
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand-400" />
              Verified Government & Partner Sources
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              Real-time Eligibility Engine
            </span>
          </div>
        </div>

        {/* Visual Mockup of the Personalized Dashboard */}
        <div className="max-w-6xl mx-auto mt-14 sm:mt-16">
          <div className="relative rounded-3xl p-3 sm:p-5 bg-gradient-to-b from-slate-800/60 to-slate-900/90 border border-slate-700/60 shadow-2xl backdrop-blur-xl">
            {/* Mockup Header Bar */}
            <div className="flex items-center justify-between pb-4 px-2 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-slate-400 font-mono text-[11px] ml-2 hidden sm:inline">
                  https://opportune.app/dashboard
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
                  ● Live Matching
                </span>
              </div>
            </div>

            {/* Mockup Body */}
            <div className="pt-5 space-y-5">
              {/* Stats Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <p className="text-[11px] text-slate-400 font-medium">Matched For You</p>
                  <p className="text-xl sm:text-2xl font-black text-white mt-1">47 opportunities</p>
                  <span className="text-[10px] text-emerald-400 font-semibold">● 100% personalized</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <p className="text-[11px] text-slate-400 font-medium">Closing Soon</p>
                  <p className="text-xl sm:text-2xl font-black text-rose-400 mt-1">12 closing soon</p>
                  <span className="text-[10px] text-rose-400 font-semibold">🔥 Deadlines &lt; 7 days</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <p className="text-[11px] text-slate-400 font-medium">New This Week</p>
                  <p className="text-xl sm:text-2xl font-black text-brand-400 mt-1">8 fresh listings</p>
                  <span className="text-[10px] text-slate-400">ISRO, Google, NITI</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <p className="text-[11px] text-slate-400 font-medium">Top Match Rate</p>
                  <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">96% profile match</p>
                  <span className="text-[10px] text-emerald-400">B.Tech 3rd Yr CS</span>
                </div>
              </div>

              {/* Mockup Preview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mock Card 1 */}
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-brand-500/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        ⚡ Hackathon
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        🟢 You're eligible
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-white">Google AI Challenge 2026</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Google Developers & Research • Remote</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-400">₹1,00,000 Prize</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-400">Deadline: 28 Aug 2026</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-mono">✓ B.Tech ✓ CS ✓ 3rd Year</span>
                    <span className="text-xs font-bold text-brand-400">96% Eligibility Match</span>
                  </div>
                </div>

                {/* Mock Card 2 */}
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        🏛️ Govt Internship
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        🟢 You're eligible
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-white">NITI Aayog National Internship Scheme</h4>
                    <p className="text-xs text-slate-400 mt-0.5">NITI Aayog, Govt of India • New Delhi</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-400">Govt Certificate & Travel</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-400">Deadline: 10 Sep 2026</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-mono">✓ Degree ✓ CGPA &gt; 7.5</span>
                    <span className="text-xs font-bold text-brand-400">92% Eligibility Match</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Step Process Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-500">
              Zero Effort Discovery
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              How Opportune Works
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Stop endlessly searching 40 different job portals, official PDFs, and college WhatsApp groups.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-400 font-black flex items-center justify-center text-sm border border-brand-500/20">
                01
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Create your profile
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Enter your degree, branch, year of study, CGPA, and key skills in a 2-minute setup.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 font-black flex items-center justify-center text-sm border border-emerald-500/20">
                02
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                We understand eligibility
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Our engine parses complex multi-variable criteria against official government and company guidelines.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 font-black flex items-center justify-center text-sm border border-indigo-500/20">
                03
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Opportunities find you
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Only see opportunities you qualify for. No irrelevant noise, no dead ends, no generic listings.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-400 font-black flex items-center justify-center text-sm border border-rose-500/20">
                04
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Never miss a deadline
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Track your active applications, assessment stages, and closing deadlines in one Kanban board.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Opportunity Categories Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-800/80">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-500">
              Comprehensive Coverage
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Every Opportunity Under One Roof
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              From prestigious UPSC / ISRO government exams to Silicon Valley research fellowships.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {categories.map((cat, idx) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={idx}
                  href="/explore"
                  className={`p-4 rounded-3xl bg-gradient-to-b ${cat.color} border transition-all hover:scale-[1.03] hover:shadow-lg flex flex-col justify-between h-36`}
                >
                  <div className="p-2.5 rounded-2xl bg-slate-900/60 w-fit">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                      {cat.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                      {cat.count}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust & Verification Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 w-fit">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Verified Sources Only
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Direct links to authentic government portals (nic.in, upsc.gov.in) and verified corporate career channels. Zero spam.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 w-fit">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Eligibility-Based Matching
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Never waste hours filling out an application only to discover a hidden graduation year or CGPA disqualifier.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 w-fit">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Deadline & Stage Tracker
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Intelligent Kanban tracking ensures you submit before deadlines and stay prepared for assessments and interviews.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-800/80 relative">
        <div className="max-w-4xl mx-auto text-center p-8 sm:p-14 rounded-3xl bg-gradient-to-r from-brand-900/60 via-indigo-950/80 to-slate-900 border border-brand-500/30 shadow-2xl relative overflow-hidden space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-300 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Stop searching. Start matching.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
            Join thousands of students finding government internships, top tech hackathons, and global scholarships tailored for them.
          </p>
          <div className="pt-2">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-slate-950 font-bold text-sm sm:text-base hover:bg-slate-100 transition-all shadow-xl hover:scale-105"
            >
              <span>Build My Profile (Free)</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
