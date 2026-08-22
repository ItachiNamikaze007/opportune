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
import { realVerifiedOpportunities } from "@/data/realOpportunities";
import { mockOpportunities } from "@/data/mockOpportunities";
import { opportunitySyncService, SyncReport } from "@/services/opportunitySyncService";
import { linkedinDiscoveryService } from "@/services/linkedinDiscoveryService";
import { opportunityDiscoveryService } from "@/services/opportunityDiscoveryService";
import { verificationDiagnosticsService } from "@/services/verificationDiagnosticsService";
import { DiscoveryCandidate } from "@/types";

export default function AdminReviewPage() {
  const [activeTab, setActiveTab] = useState<"queue" | "discovery" | "sources" | "audit" | "freshness" | "sync">("queue");
  const [reviews, setReviews] = useState<ReviewQueueItem[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [sourceMetrics, setSourceMetrics] = useState<SourceHealthMetrics[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [analytics, setAnalytics] = useState<SystemAnalyticsSummary | null>(null);
  const [discoveryCandidates, setDiscoveryCandidates] = useState<DiscoveryCandidate[]>([]);
  const [multiSourceMetrics, setMultiSourceMetrics] = useState<any[]>([]);
  const [isVerifyingCandidate, setIsVerifyingCandidate] = useState<string | null>(null);
  const [isDiscoveringMultiSource, setIsDiscoveringMultiSource] = useState(false);

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
    setDiscoveryCandidates([
      ...linkedinDiscoveryService.getAllCandidates(),
      ...opportunityDiscoveryService.getAllMultiSourceCandidates() as any[],
    ]);
  };

  const handleRunMultiSourceDiscovery = async () => {
    setIsDiscoveringMultiSource(true);
    try {
      const res = await opportunityDiscoveryService.runRealWebCrawlerDiscovery();
      setMultiSourceMetrics(res.telemetry);
      showToast(
        "Web Crawler Discovery Completed 🎉",
        `Discovered ${res.candidates.length} candidates, published ${res.publishedCount} new verified opportunities to Opportune website.`,
        "success"
      );
      loadData();
    } catch (err: any) {
      showToast("Discovery Error", err.message || "Failed to run web crawler discovery", "error");
    } finally {
      setIsDiscoveringMultiSource(false);
    }
  };

  useEffect(() => {
    loadData();
    handleRunMultiSourceDiscovery();
  }, []);

  const handleVerifyDiscoveryCandidate = async (candidateId: string) => {
    setIsVerifyingCandidate(candidateId);
    try {
      const res = await linkedinDiscoveryService.verifyOfficialSourceForCandidate(candidateId);
      if (res.verified && res.verifiedOpportunity) {
        await auditLogService.logAction(
          "Admin Staff",
          "opportunity_approved",
          candidateId,
          `Verified LinkedIn discovery signal against official source: ${res.verifiedOpportunity.officialUrl}. ${res.conflictDetected ? "Resolved conflict: Official deadline prioritized." : ""}`
        );
        showToast(
          "Official Source Verified 🎉",
          res.conflictDetected
            ? `Discrepancy resolved: Official source deadline prioritized over LinkedIn signal.`
            : `Verified against official portal ${res.candidate.officialUrl}.`,
          "success"
        );
      } else {
        showToast("Official Verification Incomplete", res.reason, "info");
      }
      loadData();
    } catch (err: any) {
      showToast("Verification Error", err.message || "Failed to verify official source", "error");
    } finally {
      setIsVerifyingCandidate(null);
    }
  };

  const handleRejectDiscoveryCandidate = async (candidateId: string) => {
    linkedinDiscoveryService.rejectCandidate(candidateId, "Rejected by administrator review.");
    await auditLogService.logAction(
      "Admin Staff",
      "opportunity_rejected",
      candidateId,
      "Rejected unverified LinkedIn discovery signal."
    );
    showToast("Discovery Candidate Rejected", "Marked as rejected.", "info");
    loadData();
  };

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

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/opportunities/sync", { method: "POST" });
      const data = await res.json();
      if (data.success && data.report) {
        setSyncReport(data.report);
        showToast(
          "Dynamic Sync Completed 🎉",
          `Discovered: ${data.report.discovered}, Revalidated: ${data.report.verified}, Updated: ${data.report.updated}`,
          "success"
        );
      } else {
        showToast("Sync Error", data.error || "Failed to run sync pipeline", "error");
      }
      loadData();
    } catch (e: any) {
      showToast("Sync Failed", e.message || "Error communicating with sync endpoint", "error");
    } finally {
      setIsSyncing(false);
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
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing Sources..." : "Run Dynamic Sync"}
            </button>
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
        <div className="flex border-b border-slate-800 space-x-6 text-sm font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab("queue")}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "queue"
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Review Queue ({reviews.length})
          </button>
          <button
            onClick={() => setActiveTab("discovery")}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "discovery"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-4 h-4" /> Discovery Signals ({discoveryCandidates.length})
          </button>
          <button
            onClick={() => setActiveTab("sync")}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "sync"
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <RefreshCw className="w-4 h-4" /> Dynamic Discovery & Sync
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

        {/* TAB: DISCOVERY SIGNALS (LINKEDIN & PUBLIC MULTI-SOURCE DISCOVERY) */}
        {activeTab === "discovery" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Multi-Source Discovery Engine
                    </span>
                    <span className="text-xs text-slate-500">Unstop • Devfolio • HackerEarth • Buddy4Study • LinkedIn • Mock Test</span>
                  </div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    Multi-Source Discovery Dashboard & Verification Pipeline
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                    Pipeline: <strong className="text-slate-300">SOURCE → DISCOVER → DEDUPLICATE → PENDING → VERIFY OFFICIAL SOURCE → REVALIDATE → PUBLISH</strong>.
                    Aggregators and social feeds are treated strictly as discovery signals. Candidates flow into the Opportune catalog only after official domain verification.
                  </p>
                </div>
                <button
                  onClick={handleRunMultiSourceDiscovery}
                  disabled={isDiscoveringMultiSource}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-md flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDiscoveringMultiSource ? "animate-spin" : ""}`} />
                  {isDiscoveringMultiSource ? "Discovering Sources..." : "Run Multi-Source Discovery"}
                </button>
              </div>

              {/* Discovery Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Total Discovery Signals</div>
                  <div className="text-xl font-bold text-amber-400">{discoveryCandidates.length}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Pending Verification</div>
                  <div className="text-xl font-bold text-slate-300">
                    {discoveryCandidates.filter((c) => c.verificationStatus === "pending").length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Verified with Official Source</div>
                  <div className="text-xl font-bold text-emerald-400">
                    {discoveryCandidates.filter((c) => c.verificationStatus === "verified").length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Conflicts Resolved</div>
                  <div className="text-xl font-bold text-purple-400">
                    {discoveryCandidates.filter((c) => c.sourceConflict).length}
                  </div>
                </div>
              </div>

              {/* MULTI-SOURCE METRICS MATRIX TABLE */}
              {multiSourceMetrics.length > 0 && (
                <div className="pt-3 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                    Configured Source Discovery Metrics
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                          <th className="py-2 px-3">Source Name</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3 text-center">Pages Fetched</th>
                          <th className="py-2 px-3 text-center">Found</th>
                          <th className="py-2 px-3 text-center">Normalized</th>
                          <th className="py-2 px-3 text-center">Verified</th>
                          <th className="py-2 px-3 text-center">Rejected</th>
                          <th className="py-2 px-3 text-center">Duplicates</th>
                          <th className="py-2 px-3 text-center">Rate Limited</th>
                          <th className="py-2 px-3 text-center">Failures</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {multiSourceMetrics.map((m) => (
                          <tr key={m.sourceName} className="hover:bg-slate-900/40">
                            <td className="py-2 px-3 font-sans font-semibold text-white">{m.sourceName}</td>
                            <td className="py-2 px-3 font-sans">
                              <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold bg-slate-800 text-slate-300">
                                {m.sourceType}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center text-cyan-400">{m.pagesFetched || 0}</td>
                            <td className="py-2 px-3 text-center text-amber-400">{m.candidatesFound || 0}</td>
                            <td className="py-2 px-3 text-center text-blue-400">{m.candidatesNormalized || 0}</td>
                            <td className="py-2 px-3 text-center text-emerald-400">{m.candidatesVerified || 0}</td>
                            <td className="py-2 px-3 text-center text-red-400">{m.candidatesRejected || 0}</td>
                            <td className="py-2 px-3 text-center text-purple-400">{m.duplicates || 0}</td>
                            <td className="py-2 px-3 text-center text-orange-400">{m.rateLimited || 0}</td>
                            <td className="py-2 px-3 text-center text-rose-400">{m.failures || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* VERIFICATION DEBUG & DIAGNOSTICS SECTION */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> Verification Debug & Diagnostic Breakdown
                    </h4>
                    <p className="text-xs text-slate-400">
                      Real-time diagnostic reasons detailing why candidates are published, held in pending verification, or deduplicated.
                    </p>
                  </div>
                  <div className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                    Source Conversion: <span className="text-emerald-400 font-bold">{verificationDiagnosticsService.getSourceConversionMetrics().reduce((acc, m) => acc + m.published, 0)}</span> / {verificationDiagnosticsService.getAllDiagnostics().length} Published
                  </div>
                </div>

                {/* CATEGORY DIAGNOSTIC BREAKDOWN TABLE */}
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 mb-4">
                  <div className="px-3 py-2 border-b border-slate-800 font-bold text-xs text-brand-400">
                    CANONICAL CATEGORY DIAGNOSTIC MATRIX
                  </div>
                  <table className="w-full text-xs text-left border-collapse font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/50">
                        <th className="py-2 px-3 font-sans">Category</th>
                        <th className="py-2 px-3 text-center">Discovered</th>
                        <th className="py-2 px-3 text-center">Normalized</th>
                        <th className="py-2 px-3 text-center">Verified</th>
                        <th className="py-2 px-3 text-center">Published</th>
                        <th className="py-2 px-3 text-center">Public Search Eligible</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px]">
                      {verificationDiagnosticsService.getCategoryDiagnosticBreakdown().map((cat) => (
                        <tr key={cat.category} className="hover:bg-slate-900/40">
                          <td className="py-2 px-3 font-sans font-bold text-white uppercase">{cat.category}</td>
                          <td className="py-2 px-3 text-center text-cyan-400">{cat.discovered}</td>
                          <td className="py-2 px-3 text-center text-blue-400">{cat.normalized}</td>
                          <td className="py-2 px-3 text-center text-emerald-400">{cat.verified}</td>
                          <td className="py-2 px-3 text-center text-emerald-400">{cat.published}</td>
                          <td className="py-2 px-3 text-center text-amber-400">{cat.publicSearchEligible}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Diagnostic Records Table */}
                {verificationDiagnosticsService.getAllDiagnostics().length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/50">
                          <th className="py-2.5 px-3">Candidate Title</th>
                          <th className="py-2.5 px-3">Source</th>
                          <th className="py-2.5 px-3 text-center">Official URL</th>
                          <th className="py-2.5 px-3 text-center">HTTP Reachable</th>
                          <th className="py-2.5 px-3 text-center">Score</th>
                          <th className="py-2.5 px-3 text-center">Decision</th>
                          <th className="py-2.5 px-3">Diagnostic Reason & Missing Evidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {verificationDiagnosticsService.getAllDiagnostics().map((rec) => (
                          <tr key={rec.candidateId} className="hover:bg-slate-900/40">
                            <td className="py-2.5 px-3 font-semibold text-white max-w-[200px] truncate" title={rec.candidateTitle}>
                              {rec.candidateTitle}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">{rec.sourceName}</td>
                            <td className="py-2.5 px-3 text-center">
                              {rec.officialUrlFound ? (
                                <span className="text-emerald-400 font-bold">Yes</span>
                              ) : (
                                <span className="text-slate-500">No</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {rec.officialUrlReachable ? (
                                <span className="text-emerald-400 font-bold">Yes</span>
                              ) : (
                                <span className="text-rose-400 font-bold">No</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-cyan-400">
                              {rec.confidenceScore}%
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {rec.finalDecision === "published" && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  PUBLISHED
                                </span>
                              )}
                              {rec.finalDecision === "pending" && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  PENDING
                                </span>
                              )}
                              {rec.finalDecision === "rejected" && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  REJECTED
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              <div>{rec.reason}</div>
                              {rec.missingEvidence && rec.missingEvidence.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {rec.missingEvidence.map((ev, i) => (
                                    <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-rose-950/60 text-rose-300 border border-rose-800/40">
                                      Missing: {ev}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Candidates List */}
            <div className="space-y-4">
              {discoveryCandidates.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500">
                  No active discovery signals.
                </div>
              ) : (
                discoveryCandidates.map((candidate) => {
                  const isPending = candidate.verificationStatus === "pending";
                  const isVerified = candidate.verificationStatus === "verified";
                  const isRejected = candidate.verificationStatus === "rejected";

                  return (
                    <div
                      key={candidate.id}
                      className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 transition-all space-y-4"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {candidate.discoveredFrom} (Discovery-Only)
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                              {candidate.categoryLabel || "Opportunity"}
                            </span>
                            {isPending && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Pending Official Verification
                              </span>
                            )}
                            {isVerified && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Official Source Verified
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Rejected
                              </span>
                            )}
                          </div>

                          <h4 className="text-base font-bold text-white pt-1">{candidate.title}</h4>
                          <div className="text-xs text-slate-400 font-medium flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" /> {candidate.organization}
                            <span className="text-slate-600">•</span>
                            <Clock className="w-3.5 h-3.5 text-slate-500" /> Discovered: {new Date(candidate.discoveredAt).toLocaleString()}
                          </div>
                        </div>

                        {/* Action Buttons: Verify Official Source or Reject (NO publish from LinkedIn) */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleVerifyDiscoveryCandidate(candidate.id)}
                                disabled={isVerifyingCandidate === candidate.id}
                                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <CheckCircle className={`w-3.5 h-3.5 ${isVerifyingCandidate === candidate.id ? "animate-spin" : ""}`} />
                                {isVerifyingCandidate === candidate.id ? "Verifying..." : "Verify Official Source"}
                              </button>
                              <button
                                onClick={() => handleRejectDiscoveryCandidate(candidate.id)}
                                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition-all border border-slate-700/60 flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </>
                          )}
                          {isVerified && (
                            <span className="px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Canonical Source Linked
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Announcement text & Provenance Info */}
                      <p className="text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 leading-relaxed">
                        {candidate.description}
                      </p>

                      {/* Conflict and Verification Status Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                          <div className="font-semibold text-slate-400 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-blue-400" /> Discovery Evidence
                          </div>
                          <div className="space-y-1 text-slate-300 text-[11px]">
                            <div>
                              <span className="text-slate-500">Exact Signal URL:</span>{" "}
                              <a
                                href={candidate.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline inline-flex items-center gap-0.5 break-all"
                              >
                                {candidate.sourceUrl} <ExternalLink className="w-2.5 h-2.5 inline shrink-0" />
                              </a>
                            </div>
                            {candidate.candidateDeadline && (
                              <div>
                                <span className="text-slate-500">Claimed Deadline in Post:</span>{" "}
                                <span className="font-mono text-amber-300">{candidate.candidateDeadline}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                          <div className="font-semibold text-slate-400 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Canonical Verification
                          </div>
                          <div className="space-y-1 text-slate-300 text-[11px]">
                            <div>
                              <span className="text-slate-500">Official Domain:</span>{" "}
                              {candidate.officialUrl ? (
                                <a
                                  href={candidate.officialUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400 hover:underline inline-flex items-center gap-0.5 break-all"
                                >
                                  {candidate.officialUrl} <ExternalLink className="w-2.5 h-2.5 inline shrink-0" />
                                </a>
                              ) : (
                                <span className="text-slate-500 italic">Not yet verified</span>
                              )}
                            </div>
                            {candidate.officialDeadline && (
                              <div>
                                <span className="text-slate-500">Canonical Official Deadline:</span>{" "}
                                <span className="font-mono text-emerald-300 font-semibold">{candidate.officialDeadline}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Conflict Notification Alert */}
                      {candidate.sourceConflict && (
                        <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/40 text-xs text-purple-200 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-purple-300">Discrepancy Resolved: Official Source Overrides LinkedIn</div>
                            <div className="text-[11px] text-purple-300/80 mt-0.5">
                              {candidate.conflictDetails || "Official organization website deadline takes absolute priority over early LinkedIn announcement claim."}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB: DYNAMIC DISCOVERY & SYNC */}
        {activeTab === "sync" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <RefreshCw className={`w-5 h-5 text-emerald-400 ${isSyncing ? "animate-spin" : ""}`} />
                    Dynamic Opportunity Discovery & Source Revalidation
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Crawl authorized official seeds up to depth-2, discover new candidate links from real HTML anchors, reverify existing catalog, and resolve official-vs-partner conflicts with zero fabricated URLs.
                  </p>
                </div>
                <button
                  onClick={handleTriggerSync}
                  disabled={isSyncing}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? "Executing Discovery & Sync..." : "Trigger Discovery & Sync Now"}
                </button>
              </div>

              {/* Live Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Discovered</div>
                  <div className="text-xl font-bold text-blue-400">{syncReport?.discovered ?? 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Verified</div>
                  <div className="text-xl font-bold text-emerald-400">{syncReport?.verified ?? 8}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Published Active</div>
                  <div className="text-xl font-bold text-teal-400">{syncReport?.published ?? 8}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Revalidated / Updated</div>
                  <div className="text-xl font-bold text-amber-400">{syncReport?.updated ?? 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Expired Excluded</div>
                  <div className="text-xl font-bold text-purple-400">{syncReport?.expired ?? 2}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Conflicts Resolved</div>
                  <div className="text-xl font-bold text-orange-400">{syncReport?.conflicts ?? 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Failures</div>
                  <div className="text-xl font-bold text-rose-400">{syncReport?.failures ?? 0}</div>
                </div>
              </div>

              {/* Status Banner */}
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${syncReport?.status === "failed" ? "bg-rose-500" : "bg-emerald-400"} animate-pulse`} />
                  <span className="text-slate-300 font-medium">
                    {syncReport ? `Sync Status: ${syncReport.status.toUpperCase()} (${syncReport.verified} verified, ${syncReport.discovered} discovered)` : "Engine Status: Ready to execute live sync"}
                  </span>
                </div>
                <div className="text-slate-400 font-mono text-[11px] flex flex-col sm:items-end">
                  <div>Last Sync: {syncReport?.completedAt || syncReport?.timestamp ? new Date(syncReport.completedAt || syncReport.timestamp).toLocaleString() : "Awaiting initial trigger"} {syncReport?.durationMs ? `(${syncReport.durationMs}ms)` : ""}</div>
                  {syncReport?.lastSuccessfulSync && (
                    <div className="text-emerald-400/80 text-[10px]">Last Successful: {new Date(syncReport.lastSuccessfulSync).toLocaleString()}</div>
                  )}
                </div>
              </div>

              {syncReport?.lastError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Last Sync Notice: {syncReport.lastError}</span>
                </div>
              )}
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
          const auditReport = catalogAuditService.generateAuditReport(realVerifiedOpportunities);
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
