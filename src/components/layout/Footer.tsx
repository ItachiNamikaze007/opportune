import React from "react";
import Link from "next/link";
import { Sparkles, Heart, ShieldCheck, Github } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/50 dark:bg-slate-950/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
              Opportune 2026
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              "You don't find opportunities. Opportunities find you."
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
          <Link href="/dashboard" className="hover:text-brand-400 transition-colors">
            Dashboard
          </Link>
          <Link href="/explore" className="hover:text-brand-400 transition-colors">
            Explore
          </Link>
          <Link href="/saved" className="hover:text-brand-400 transition-colors">
            Saved
          </Link>
          <Link href="/applications" className="hover:text-brand-400 transition-colors">
            Application Tracker
          </Link>
          <Link href="/profile" className="hover:text-brand-400 transition-colors">
            My Profile
          </Link>
          <Link href="/settings" className="hover:text-brand-400 transition-colors">
            Settings
          </Link>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <span>Crafted for ambitious students</span>
          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
        </div>
      </div>
    </footer>
  );
};
