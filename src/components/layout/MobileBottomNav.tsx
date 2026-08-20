"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSaved } from "@/context/SavedContext";
import { useApplication } from "@/context/ApplicationContext";
import { useStudent } from "@/context/StudentContext";
import {
  LayoutDashboard,
  Compass,
  Bookmark,
  Kanban,
  User,
} from "lucide-react";

export const MobileBottomNav: React.FC = () => {
  const pathname = usePathname();
  const { savedCount } = useSaved();
  const { applications } = useApplication();
  const { profileCompleteness } = useStudent();

  // Hide on landing and onboarding/auth
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/onboarding"
  ) {
    return null;
  }

  const navItems = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/explore", label: "Explore", icon: Compass },
    {
      href: "/saved",
      label: "Saved",
      icon: Bookmark,
      badge: savedCount > 0 ? savedCount : null,
    },
    {
      href: "/applications",
      label: "Tracker",
      icon: Kanban,
      badge: applications.length > 0 ? applications.length : null,
    },
    {
      href: "/profile",
      label: "Profile",
      icon: User,
      badgeText: `${profileCompleteness}%`,
    },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/80 px-2 py-1.5 safe-area-pb">
      <div className="grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition-all relative ${
                isActive
                  ? "text-brand-600 dark:text-brand-400 font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium"
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-3.5 rounded-full bg-brand-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 leading-none">{item.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-brand-500 mt-0.5" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
