"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  Award,
  Sparkles,
  Info,
  Check,
  Clock,
  ChevronRight,
  Database,
  Search,
  Activity,
  FileText,
  Play,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { reviewQueueService } from "@/ingestion/reviewQueueService";
import { sourceRegistry } from "@/ingestion/sourceRegistry";
import { ReviewQueueItem } from "@/ingestion/types";
import { useToast } from "@/context/ToastContext";
import { sourceHealthService, SourceHealthMetrics } from "@/ingestion/sourceHealthService";
import { auditLogService, AuditLogEntry } from "@/services/auditLogService";
import { analyticsService, SystemAnalyticsSummary } from "@/services/analyticsService";
import { ingestionScheduler } from "@/ingestion/scheduler";
import { matchingService } from "@/services/matchingService";
import { defaultStudentProfile } from "@/data/mockStudent";
import { appConfig } from "@/lib/config";
import { catalogAuditService, CatalogAuditReport } from "@/services/catalogAuditService";
import { mockOpportunities } from "@/data/mockOpportunities";

export default function AdminReviewPage() {
  const [activeTab, setActiveTab] = useState<"queue" | "sources" | "audit" | "freshness">("queue");
  const [reviews, setReviews] = useState<ReviewQueueItem[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [sourceMetrics, setSourceMetrics] = useState<SourceHealthMetrics[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [analytics, setAnalytics] = useState<SystemAnalyticsSummary | null>(null);

  const { showToast } = useToast();

  const loadData = async () => {
    const list = reviewQueueService.getAllReviews();
    setReviews(list);
    if (list.length > 0 && !selectedReviewId) {
      setSelectedReviewId(list[0].id);
    }
    setSourceMetrics(sourceHealthService.getAllMetrics());
    setAuditLogs(auditLogService.getRecentLogs(25));
    const metrics = await analyticsService.getSystemMetricsSummary();
    setAnalytics(metrics);
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedItem = reviews.find((r) => r.id === selectedReviewId);

  const handleApprove = async (id: string) => {
    const notes = reviewNotes || "Verified against official portal notification.";
    const result = reviewQueueService.approveReview(id, "Admin Staff", notes);
    if (result.approved && result.publishedOpportunity) {
      // Step 6: Log Audit Trail
      await auditLogService.logAction(
        "Admin Staff",
        "opportunity_approved",
        id,
        `Approved & Published: "${result.publishedOpportunity.title}". Verification status set to verified.`
      );

      // Step 7: Match with active students and create notification
      await matchingService.matchPublishedOpportunityWithStudents(result.publishedOpportunity, [
        { id: "demo-user", profile: defaultStudentProfile },
      ]);

      showToast("Opportunity Approved 🎉", "Marked as Verified, Published to real catalog & matched with eligible students.", "success");
      setReviewNotes("");
      loadData();
    }
  };

  const handleReject = async (id: string) => {
    const notes = reviewNotes || "Rejected by administrator review.";
    const result = reviewQueueService.rejectReview(id, "Admin Staff", notes);
    if (result.rejected) {
      await auditLogService.logAction("Admin Staff", "opportunity_rejected", id, notes);
      showToast("Opportunity Rejected", "Marked as rejected.", "info");
      setReviewNotes("");
      loadData();
    }
  };

  const handleRequestInfo = (id: string) => {
    const notes = reviewNotes || "Need further verification on branch eligibility quotas.";
    const result = reviewQueueService.requestMoreInfo(id, "Admin Staff", notes);
    if (result.updated) {
      showToast("Flagged for Info", "Marked as needs more information.", "info");
      setReviewNotes("");
      loadData();
    }
  };

  const handleRunAllConnectors = async () => {
    setIsRunningPipeline(true);
    try {
      const results = await ingestionScheduler.runDueJobs([]);
      showToast(
        "Ingestion Scheduler Completed",
        `Ran active source connectors. Placed ${results.reduce((acc, r) => acc + r.summary.queuedForReviewCount, 0)} records in review queue.`,
        "success"
      );
      loadData();
    } catch (e: any) {
      showToast("Pipeline Error", e.message || "Failed to run sources", "error");
    } finally {
      setIsRunningPipeline(false);
    }
  };

  const handleTriggerSingleSource = async (sourceId: string) => {
    try {
      await ingestionScheduler.triggerSourceNow(sourceId, []);
      showToast("Source Ingestion Triggered", `Ingested latest records for ${sourceId}.`, "success");
      loadData();
    } catch (e: any) {
      showToast("Trigger Failed", e.message || "Error running source", "error");
    }
  };

  const filteredReviews = reviews.filter((r) => {
    if (filterStatus !== "all" && r.reviewStatus !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        r.opportunity.title.toLowerCase().includes(term) ||
        r.opportunity.organization.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with App Mode Indicator */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Administrative Governance
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  appConfig.isProduction
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                }`}
              >
                {appConfig.mode} Mode
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Opportunity Review & Source Health Center
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Review extracted opportunities, monitor official source health, and oversee system audit logs. Zero auto-publish.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunAllConnectors}
              disabled={isRunningPipeline}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningPipeline ? "animate-spin" : ""}`} />
              {isRunningPipeline ? "Ingesting..." : "Run Scheduler"}
            </button>
            <Link
              href="/dashboard"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700/60"
            >
              Back to App
            </Link>
          </div>
        </div>

        {/* Analytics Highlights */}
        {analytics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Pending Reviews</div>
              <div className="text-xl font-bold text-amber-400">{reviews.filter((r) => r.reviewStatus === "pending").length}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Published Real Opps</div>
              <div className="text-xl font-bold text-emerald-400">{analytics.publishedOpportunities}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Active Official Sources</div>
              <div className="text-xl font-bold text-blue-400">{analytics.officialSourcesActive}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Matches Generated</div>
              <div className="text-xl font-bold text-purple-400">{analytics.matchesGenerated}</div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 space-x-6 text-sm font-semibold">
          <button
            onClick={() => setActiveTab("queue")}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "queue"
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Review Queue ({reviews.length})
          </button>
          <button
            onClick={() => setActiveTab("sources")}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "sources"
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-4 h-4" /> Source Health & Scheduler
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "audit"
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" /> Audit Log & Actions
          </button>
          <button
            onClick={() => setActiveTab("freshness")}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "freshness"
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Clock className="w-4 h-4" /> Catalog Freshness Audit
          </button>
        </div>

        {/* TAB 1: REVIEW QUEUE */}
        {activeTab === "queue" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {["all", "pending", "approved", "rejected", "needs_more_information"].map((st) => {
                  const count =
                    st === "all" ? reviews.length : reviews.filter((r) => r.reviewStatus === st).length;
                  return (
                    <button
                      key={st}
                      onClick={() => setFilterStatus(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all border ${
                        filterStatus === st
                          ? "bg-brand-500 text-white border-brand-400"
                          : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800"
                      }`}
                    >
                      {st.replace(/_/g, " ")} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search opportunity or org..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-xl text-xs bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 w-64"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Queue List (4 cols) */}
              <div className="lg:col-span-4 space-y-3">
                {filteredReviews.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-slate-500 text-xs">
                    No items matching current filter.
                  </div>
                ) : (
                  filteredReviews.map((item) => {
                    const isSelected = item.id === selectedReviewId;
                    const confPercent = Math.round(item.confidence * 100);

                    let statusBadge = (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Pending
                      </span>
                    );
                    if (item.reviewStatus === "approved") {
                      statusBadge = (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Approved
                        </span>
                      );
                    } else if (item.reviewStatus === "rejected") {
                      statusBadge = (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                          Rejected
                        </span>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedReviewId(item.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-slate-900 border-brand-500/80 shadow-lg shadow-brand-500/5 ring-1 ring-brand-500/30"
                            : "bg-slate-900/60 hover:bg-slate-900 border-slate-800/80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[11px] font-medium text-slate-400 truncate">
                            {item.opportunity.organization}
                          </span>
                          {statusBadge}
                        </div>

                        <h3 className="text-sm font-semibold text-white line-clamp-2 mb-2">
                          {item.opportunity.title}
                        </h3>

                        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            {item.opportunity.deadline}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                              confPercent >= 85
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-blue-500/10 text-blue-400"
                            }`}
                          >
                            {confPercent}% Conf.
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: Review Details (8 cols) */}
              <div className="lg:col-span-8">
                {selectedItem ? (
                  <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-800 pb-5">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                            {selectedItem.opportunity.categoryLabel}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">ID: {selectedItem.opportunityId}</span>
                        </div>
                        <h2 className="text-xl font-bold text-white">{selectedItem.opportunity.title}</h2>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          {selectedItem.opportunity.organization}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-2xl font-black text-white">
                          {Math.round(selectedItem.confidence * 100)}%
                        </div>
                        <div className="text-[11px] text-slate-400 capitalize">
                          {selectedItem.confidenceLevel.replace(/_/g, " ")}
                        </div>
                      </div>
                    </div>

                    {/* Multi-Dimensional Confidence Breakdown */}
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-brand-400" /> Extraction Confidence Matrix
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <div className="text-xs font-semibold text-slate-400">Title</div>
                          <div className="text-sm font-bold text-white">
                            {Math.round(selectedItem.confidenceBreakdown.title * 100)}%
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <div className="text-xs font-semibold text-slate-400">Deadline</div>
                          <div className="text-sm font-bold text-white">
                            {Math.round(selectedItem.confidenceBreakdown.deadline * 100)}%
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <div className="text-xs font-semibold text-slate-400">Organization</div>
                          <div className="text-sm font-bold text-white">
                            {Math.round(selectedItem.confidenceBreakdown.organization * 100)}%
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <div className="text-xs font-semibold text-slate-400">URLs</div>
                          <div className="text-sm font-bold text-white">
                            {Math.round(selectedItem.confidenceBreakdown.url * 100)}%
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <div className="text-xs font-semibold text-slate-400">Eligibility</div>
                          <div className="text-sm font-bold text-white">
                            {Math.round(selectedItem.confidenceBreakdown.eligibility * 100)}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Official URLs */}
                    <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2 text-xs">
                      <div className="font-semibold text-slate-300">Official Provenance URLs</div>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <a
                          href={selectedItem.opportunity.officialUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-400 hover:underline flex items-center gap-1 truncate"
                        >
                          Official Portal: {selectedItem.opportunity.officialUrl} <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href={selectedItem.opportunity.applyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-400 hover:underline flex items-center gap-1 truncate"
                        >
                          Apply Portal: {selectedItem.opportunity.applyUrl} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Structured Eligibility Rules */}
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-400" /> Extracted Structured Eligibility
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                          <span className="text-slate-500 block text-[11px]">Allowed Degrees:</span>
                          <span className="font-medium text-slate-200">
                            {selectedItem.opportunity.eligibilityCriteria.allowedDegrees.join(", ")}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                          <span className="text-slate-500 block text-[11px]">Eligible Years:</span>
                          <span className="font-medium text-slate-200">
                            Year {selectedItem.opportunity.eligibilityCriteria.allowedYears.join(", ")}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                          <span className="text-slate-500 block text-[11px]">Min CGPA / Max Age:</span>
                          <span className="font-medium text-slate-200">
                            CGPA: {selectedItem.opportunity.eligibilityCriteria.minCGPA || "None"} | Max Age:{" "}
                            {selectedItem.opportunity.eligibilityCriteria.maxAge || "None"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Review Notes & Actions */}
                    <div className="pt-4 border-t border-slate-800 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Verification Audit Notes:
                        </label>
                        <textarea
                          rows={2}
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          placeholder="Add audit notes (e.g. 'Verified against ISRO gazette notification dated 18 Aug 2026')..."
                          className="w-full p-3 rounded-xl text-xs bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <button
                          onClick={() => handleRequestInfo(selectedItem.id)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-950 text-blue-300 hover:bg-blue-900 border border-blue-800/60 transition-all flex items-center gap-1.5"
                        >
                          <AlertCircle className="w-3.5 h-3.5" /> Request More Info
                        </button>
                        <button
                          onClick={() => handleReject(selectedItem.id)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-950 text-red-300 hover:bg-red-900 border border-red-800/60 transition-all flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                        <button
                          onClick={() => handleApprove(selectedItem.id)}
                          className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Publish
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-slate-500 text-sm">
                    Select an opportunity from the left to review its extraction details.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SOURCE HEALTH & SCHEDULER */}
        {activeTab === "sources" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Registered Official Connectors</h3>
                  <p className="text-xs text-slate-400">
                    Live operational metrics, consecutive failure counters, and manual trigger controls.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Source Name</th>
                      <th className="py-2.5 px-3">Health Status</th>
                      <th className="py-2.5 px-3">Successes / Failures</th>
                      <th className="py-2.5 px-3">Records (Discovered / Accepted)</th>
                      <th className="py-2.5 px-3">Last Successful Fetch</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {sourceMetrics.map((m) => {
                      let statusBadge = (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Healthy
                        </span>
                      );
                      if (m.healthStatus === "Manual Review") {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Manual Review
                          </span>
                        );
                      } else if (m.healthStatus === "Error") {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                            Error
                          </span>
                        );
                      }

                      return (
                        <tr key={m.sourceId} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{m.sourceName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{m.sourceId}</div>
                          </td>
                          <td className="py-3 px-3">{statusBadge}</td>
                          <td className="py-3 px-3 font-mono">
                            <span className="text-emerald-400">{m.successCount}</span> /{" "}
                            <span className="text-red-400">{m.failureCount}</span>
                          </td>
                          <td className="py-3 px-3 font-mono">
                            {m.recordsDiscovered} / {m.recordsAccepted}
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {m.lastSuccessfulFetch ? new Date(m.lastSuccessfulFetch).toLocaleTimeString() : "Pending"}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleTriggerSingleSource(m.sourceId)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all border border-slate-700"
                            >
                              Trigger Now
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT LOG */}
        {activeTab === "audit" && (
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-base font-bold text-white">Administrative Audit Trail</h3>
            <p className="text-xs text-slate-400">
              Immutable log of approval decisions, source triggers, and verification updates.
            </p>

            <div className="space-y-2 pt-2">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand-400 uppercase tracking-wider text-[10px]">
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-slate-500 font-mono">• {log.target}</span>
                    </div>
                    <p className="text-slate-300">{log.notes || "No notes provided."}</p>
                  </div>

                  <div className="text-right shrink-0 text-[11px] text-slate-500">
                    <div>{log.actor}</div>
                    <div className="font-mono">{new Date(log.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: CATALOG FRESHNESS AUDIT */}
        {activeTab === "freshness" && (() => {
          const auditReport = catalogAuditService.generateAuditReport(mockOpportunities);
          return (
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-white">Full Catalog Freshness & Deadline Audit</h3>
                  <p className="text-xs text-slate-400">
                    Comprehensive audit verifying stored deadlines against server date (20 Aug 2026). Accuracy over quantity.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active: {auditReport.activeCount}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Closing Soon: {auditReport.closingSoonCount}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                    Expired: {auditReport.expiredCount}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Sample Demo: {auditReport.demoCount}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Opportunity</th>
                      <th className="py-2.5 px-3">Stored Deadline</th>
                      <th className="py-2.5 px-3">Resolved Status</th>
                      <th className="py-2.5 px-3">Freshness</th>
                      <th className="py-2.5 px-3">Action Required</th>
                      <th className="py-2.5 px-3">Official Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {auditReport.items.map((item) => {
                      let badge = (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ACTIVE ({item.statusResult.daysRemaining}d left)
                        </span>
                      );
                      if (item.statusResult.status === "EXPIRED") {
                        badge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                            EXPIRED (0d)
                          </span>
                        );
                      } else if (item.statusResult.status === "CLOSING_SOON") {
                        badge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            CLOSING SOON ({item.statusResult.daysRemaining}d left)
                          </span>
                        );
                      } else if (item.statusResult.status === "UNKNOWN") {
                        badge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            STATUS UNVERIFIED
                          </span>
                        );
                      } else if (item.isDemo) {
                        badge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            SAMPLE DEMO ({item.statusResult.daysRemaining}d)
                          </span>
                        );
                      }

                      return (
                        <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{item.title}</div>
                            <div className="text-[10px] text-slate-500">{item.organization}</div>
                          </td>
                          <td className="py-3 px-3 font-mono">{item.storedDeadline}</td>
                          <td className="py-3 px-3">{badge}</td>
                          <td className="py-3 px-3">
                            <span className="text-[11px] text-slate-400">{item.statusResult.freshnessState}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.actionRequired === "Mark Expired"
                                ? "bg-red-500/20 text-red-300"
                                : item.actionRequired === "Review Official Source"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-slate-800 text-slate-400"
                            }`}>
                              {item.actionRequired}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <a
                              href={item.officialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-400 hover:underline flex items-center gap-1 text-[11px]"
                            >
                              <span>Official URL</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
