"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApplication } from "@/context/ApplicationContext";
import { mockOpportunities } from "@/data/mockOpportunities";
import { ApplicationStage, StudentApplication } from "@/types";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import {
  Kanban,
  Plus,
  ArrowRight,
  MoreVertical,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Trash2,
  FileText,
  Sparkles,
} from "lucide-react";

export default function ApplicationsTrackerPage() {
  const { applications, moveStage, removeApplication, updateNotes } = useApplication();
  const [selectedAppForNote, setSelectedAppForNote] = useState<StudentApplication | null>(null);
  const [noteText, setNoteText] = useState("");

  const columns: { id: ApplicationStage; title: string; color: string; dotBg: string }[] = [
    { id: "saved", title: "Saved / Backlog", color: "text-slate-400", dotBg: "bg-slate-500" },
    { id: "applied", title: "Applied", color: "text-blue-400", dotBg: "bg-blue-500" },
    { id: "assessment", title: "Assessment", color: "text-amber-400", dotBg: "bg-amber-500" },
    { id: "interview", title: "Interview", color: "text-purple-400", dotBg: "bg-purple-500" },
    { id: "selected", title: "Selected 🎉", color: "text-emerald-400", dotBg: "bg-emerald-500" },
    { id: "rejected", title: "Archived", color: "text-rose-400", dotBg: "bg-rose-500" },
  ];

  const getOpportunity = (oppId: string) => {
    return mockOpportunities.find((o) => o.id === oppId);
  };

  const getNextStage = (current: ApplicationStage): ApplicationStage | null => {
    const sequence: ApplicationStage[] = [
      "saved",
      "applied",
      "assessment",
      "interview",
      "selected",
    ];
    const idx = sequence.indexOf(current);
    if (idx !== -1 && idx < sequence.length - 1) {
      return sequence[idx + 1];
    }
    return null;
  };

  const getPrevStage = (current: ApplicationStage): ApplicationStage | null => {
    const sequence: ApplicationStage[] = [
      "saved",
      "applied",
      "assessment",
      "interview",
      "selected",
    ];
    const idx = sequence.indexOf(current);
    if (idx > 0) {
      return sequence[idx - 1];
    }
    return null;
  };

  const handleOpenNoteModal = (app: StudentApplication) => {
    setSelectedAppForNote(app);
    setNoteText(app.notes || "");
  };

  const handleSaveNote = () => {
    if (selectedAppForNote) {
      updateNotes(selectedAppForNote.id, noteText);
      setSelectedAppForNote(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-brand-500/10 text-brand-400">
              <Kanban className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
              Application Lifecycle
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            Application Tracker ({applications.length})
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Organize active tests, interviews, and offers in one student Kanban workflow.
          </p>
        </div>

        <Link
          href="/explore"
          className="px-4 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition-all shadow-lg shadow-brand-600/20 flex items-center gap-1.5 w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>Add Opportunity</span>
        </Link>
      </div>

      {/* Kanban Board Container (Horizontal Scrollable on mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {columns.map((column) => {
          const columnApps = applications.filter((a) => a.stage === column.id);

          return (
            <div
              key={column.id}
              className="flex flex-col rounded-3xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 p-3 min-w-[260px] md:min-w-0 min-h-[420px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-2 py-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${column.dotBg}`} />
                  <span className={`text-xs font-bold ${column.color}`}>{column.title}</span>
                </div>
                <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-600 dark:text-slate-400">
                  {columnApps.length}
                </span>
              </div>

              {/* Application Cards List */}
              <div className="space-y-3 flex-1 overflow-y-auto pr-0.5">
                {columnApps.map((app) => {
                  const opp = getOpportunity(app.opportunityId);
                  if (!opp) return null;

                  const nextStage = getNextStage(app.stage);
                  const prevStage = getPrevStage(app.stage);

                  return (
                    <div
                      key={app.id}
                      className="group p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/90 shadow-sm hover:border-brand-500/40 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <CategoryBadge category={opp.category} size="sm" />
                          <button
                            onClick={() => removeApplication(app.id)}
                            className="text-slate-400 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove from tracker"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <Link
                          href={`/opportunities/${opp.id}`}
                          className="hover:text-brand-400 transition-colors"
                        >
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                            {opp.title}
                          </h4>
                        </Link>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {opp.organization}
                        </p>

                        {/* Notes snippet */}
                        {app.notes && (
                          <div
                            onClick={() => handleOpenNoteModal(app)}
                            className="mt-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-medium line-clamp-2 cursor-pointer hover:border-brand-500/30"
                          >
                            💬 {app.notes}
                          </div>
                        )}
                      </div>

                      {/* Card Footer: Move Controls & Quick Note */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                        <button
                          onClick={() => handleOpenNoteModal(app)}
                          className="text-slate-400 hover:text-brand-400 flex items-center gap-1 text-[10px] font-medium"
                          title="Add / Edit Notes"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Notes</span>
                        </button>

                        <div className="flex items-center gap-1">
                          {prevStage && (
                            <button
                              onClick={() => moveStage(app.id, prevStage)}
                              className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-white"
                              title={`Move back to ${prevStage}`}
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {nextStage && (
                            <button
                              onClick={() => moveStage(app.id, nextStage)}
                              className="px-2 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-bold flex items-center gap-0.5 shadow-sm"
                              title={`Advance to ${nextStage}`}
                            >
                              <span>Next</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {columnApps.length === 0 && (
                  <div className="h-28 flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800/80 rounded-2xl text-[11px] text-slate-400">
                    No items
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Note Editing Modal */}
      {selectedAppForNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <h3 className="text-base font-bold">Application Notes</h3>
            <p className="text-xs text-slate-400">
              Add reminders, assessment scores, interview dates, or recruiter contact details.
            </p>
            <textarea
              rows={4}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Cleared round 1 coding challenge. Final panel scheduled for next Tuesday at 3 PM."
              className="w-full p-3 rounded-2xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedAppForNote(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
