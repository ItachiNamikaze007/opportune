"use client";

import React, { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { MobileBottomNav } from "./MobileBottomNav";
import { Footer } from "./Footer";
import { usePathname } from "next/navigation";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/onboarding";

  return (
    <div className="min-h-screen flex flex-col bg-surface-light dark:bg-surface-dark text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />
      <main className={`flex-1 ${!isAuthPage ? "pb-20 md:pb-12" : ""}`}>
        {children}
      </main>
      {!isAuthPage && <Footer />}
      <MobileBottomNav />
    </div>
  );
};
