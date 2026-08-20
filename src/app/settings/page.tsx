"use client";

import React from "react";
import { useSettings } from "@/context/SettingsContext";
import { useTheme } from "@/context/ThemeContext";
import { useStudent } from "@/context/StudentContext";
import { useToast } from "@/context/ToastContext";
import {
  Bell,
  Moon,
  Sun,
  Laptop,
  Shield,
  Trash2,
  Download,
  CheckCircle2,
  Sliders,
  Sparkles,
} from "lucide-react";

export default function SettingsPage() {
  const { settings, updateNotifications, resetAllAppData } = useSettings();
  const { theme, setTheme } = useTheme();
  const { studentProfile } = useStudent();
  const { showToast } = useToast();

  const handleExportData = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify({ profile: studentProfile, settings }, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `opportune_student_profile_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Profile Exported", "Downloaded JSON profile data.", "success");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-xl bg-brand-500/10 text-brand-400">
            <Sliders className="w-4 h-4" />
          </span>
          <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
            Platform Settings
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
          Settings & Notifications
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Customize your deadline alerts, theme appearance, and data preferences.
        </p>
      </div>

      {/* 1. Theme & Appearance */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Sun className="w-4 h-4 text-amber-400" />
          <span>Appearance & Theme</span>
        </h3>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setTheme("dark")}
            className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${
              theme === "dark"
                ? "bg-brand-600/10 border-brand-500 text-brand-400 font-bold"
                : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400"
            }`}
          >
            <Moon className="w-5 h-5" />
            <span className="text-xs">Dark Mode</span>
          </button>

          <button
            onClick={() => setTheme("light")}
            className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${
              theme === "light"
                ? "bg-brand-600/10 border-brand-500 text-brand-600 font-bold"
                : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400"
            }`}
          >
            <Sun className="w-5 h-5" />
            <span className="text-xs">Light Mode</span>
          </button>

          <button
            onClick={() => setTheme("system")}
            className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${
              theme === "system"
                ? "bg-brand-600/10 border-brand-500 text-brand-400 font-bold"
                : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400"
            }`}
          >
            <Laptop className="w-5 h-5" />
            <span className="text-xs">System Match</span>
          </button>
        </div>
      </div>

      {/* 2. Notification Preferences */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Bell className="w-4 h-4 text-brand-400" />
          <span>Notification & Alert Preferences</span>
        </h3>

        <div className="space-y-3">
          {/* Toggle 1 */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Deadline Reminders
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Get alerted 7 days and 48 hours before an application window closes.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.deadlineReminders}
              onChange={(e) =>
                updateNotifications({ deadlineReminders: e.target.checked })
              }
              className="w-4 h-4 accent-brand-600 cursor-pointer"
            />
          </div>

          {/* Toggle 2 */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Email Digest
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Weekly curated summary of newly verified opportunities matching your degree.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.emailAlerts}
              onChange={(e) =>
                updateNotifications({ emailAlerts: e.target.checked })
              }
              className="w-4 h-4 accent-brand-600 cursor-pointer"
            />
          </div>

          {/* Toggle 3 */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Eligibility Status Updates
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Notify when new schemes match 90%+ with your student profile.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.eligibilityUpdates}
              onChange={(e) =>
                updateNotifications({ eligibilityUpdates: e.target.checked })
              }
              className="w-4 h-4 accent-brand-600 cursor-pointer"
            />
          </div>

          {/* Toggle 4 */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                WhatsApp Urgent Notifications
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Instant alerts for high-value fellowships and national hackathons.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.whatsappAlerts}
              onChange={(e) =>
                updateNotifications({ whatsappAlerts: e.target.checked })
              }
              className="w-4 h-4 accent-brand-600 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 3. Account Data Management */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Data & Local Storage</span>
        </h3>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Export Profile & Applications Data
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Download all your local saved opportunities and Kanban tracker notes in JSON.
            </p>
          </div>
          <button
            onClick={handleExportData}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs font-bold text-slate-800 dark:text-white transition-colors flex items-center justify-center gap-1.5 shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-rose-950/20 border border-rose-800/30">
          <div>
            <p className="text-xs font-bold text-rose-300">
              Reset Prototype Data
            </p>
            <p className="text-[11px] text-rose-200/70 mt-0.5">
              Clear local storage and reset the student profile and saved opportunities back to default demo state.
            </p>
          </div>
          <button
            onClick={resetAllAppData}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>
        </div>
      </div>
    </div>
  );
}
