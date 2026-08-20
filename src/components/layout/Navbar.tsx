"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStudent } from "@/context/StudentContext";
import { useSaved } from "@/context/SavedContext";
import { useApplication } from "@/context/ApplicationContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ProfileProgress } from "@/components/ui/ProfileProgress";
import {
  Sparkles,
  Compass,
  Bookmark,
  Kanban,
  User,
  LayoutDashboard,
  Bell,
} from "lucide-react";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { studentProfile } = useStudent();
  const { savedCount } = useSaved();
  const { applications } = useApplication();

  const isLanding = pathname === "/";
  const isAuth = pathname === "/login" || pathname === "/signup" || pathname === "/onboarding";

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/explore", label: "Explore", icon: Compass },
    {
      href: "/saved",
      label: "Saved",
      icon: Bookmark,
      badge: savedCount > 0 ? savedCount : undefined,
    },
    {
      href: "/applications",
      label: "Tracker",
      icon: Kanban,
      badge: applications.length > 0 ? applications.length : undefined,
    },
    { href: "/profile", label: "Profile", icon: User },
  ];

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href={studentProfile.completedOnboarding ? "/dashboard" : "/"} className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center font-black shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              Opportune
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                2026
              </span>
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links (When not on Landing / Auth) */}
        {!isLanding && !isAuth && (
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all relative ${
                    isActive
                      ? "bg-brand-500/10 text-brand-600 dark:text-brand-300 border border-brand-500/20 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                  {link.badge !== undefined && (
                    <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {isLanding ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <Link
                href="/login"
                className="text-xs font-semibold px-4 py-2 rounded-2xl text-slate-700 dark:text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/onboarding"
                className="text-xs font-bold px-4 py-2 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20 transition-all"
              >
                Create Profile
              </Link>
            </div>
          ) : isAuth ? (
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link
                href="/"
                className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Back to Home
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:block">
                <ProfileProgress compact />
              </div>
              <ThemeToggle />
              <Link
                href="/settings"
                className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-white border border-slate-200 dark:border-slate-800 transition-colors"
                title="Settings & Notifications"
                aria-label="Settings"
              >
                <Bell className="w-4 h-4" />
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 transition-colors"
              >
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                  {studentProfile.name ? studentProfile.name.charAt(0) : "S"}
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 hidden lg:inline max-w-[100px] truncate">
                  {studentProfile.name ? studentProfile.name.split(" ")[0] : "Profile"}
                </span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
