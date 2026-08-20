import { sourceRegistry } from "./sourceRegistry";
import { runIngestionPipeline, PipelineResult } from "./pipeline";
import { sourceHealthService } from "./sourceHealthService";
import { auditLogService } from "@/services/auditLogService";
import { ingestionLogger } from "./ingestionLogger";
import type { Opportunity } from "@/types";

export interface ScheduledSourceJob {
  sourceId: string;
  sourceName: string;
  frequency: "hourly" | "daily" | "weekly";
  lastCheckedAt: string | null;
  nextCheckAt: string;
  status: "active" | "paused" | "error" | "disabled" | "manual_review_required";
  autoRunEnabled: boolean;
}

class IngestionScheduler {
  private jobs: Map<string, ScheduledSourceJob> = new Map();

  constructor() {
    this.initDefaultJobs();
  }

  private initDefaultJobs() {
    const sources = sourceRegistry.getAllSources();
    const now = new Date();

    for (const src of sources) {
      const nextRun = new Date(now.getTime() + 24 * 3600 * 1000); // 24h later
      this.jobs.set(src.id, {
        sourceId: src.id,
        sourceName: src.source_name,
        frequency: "daily",
        lastCheckedAt: src.last_checked_at || now.toISOString(),
        nextCheckAt: nextRun.toISOString(),
        status: src.status,
        autoRunEnabled: src.status === "active",
      });
    }
  }

  getAllJobs(): ScheduledSourceJob[] {
    return Array.from(this.jobs.values());
  }

  getJob(sourceId: string): ScheduledSourceJob | undefined {
    return this.jobs.get(sourceId);
  }

  /**
   * Evaluates and executes due source ingestion jobs safely.
   */
  async runDueJobs(existingCatalog: Opportunity[] = []): Promise<PipelineResult[]> {
    const results: PipelineResult[] = [];
    const now = new Date();

    for (const job of this.jobs.values()) {
      if (job.status !== "active" || !job.autoRunEnabled) {
        continue;
      }

      const nextDate = new Date(job.nextCheckAt);
      const isDue = nextDate.getTime() <= now.getTime() || job.lastCheckedAt === null;

      if (isDue) {
        try {
          ingestionLogger.info("scheduler", `Executing scheduled job for ${job.sourceName}...`);
          const res = await runIngestionPipeline(job.sourceId, existingCatalog);
          results.push(res);

          // Update job state
          job.lastCheckedAt = new Date().toISOString();
          job.nextCheckAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();

          // Record Health metrics
          sourceHealthService.recordSuccess(
            job.sourceId,
            res.summary.fetchedCount,
            res.summary.validCount,
            res.summary.invalidCount
          );

          await auditLogService.logAction(
            "Scheduler Daemon",
            "source_ingestion_run",
            job.sourceId,
            `Successfully processed ${res.summary.queuedForReviewCount} new records into review queue.`
          );
        } catch (err: any) {
          job.status = "error";
          sourceHealthService.recordFailure(job.sourceId, err.message || String(err));
          ingestionLogger.error("scheduler", `Scheduled job failed for ${job.sourceName}: ${err.message}`);
        }
      }
    }

    return results;
  }

  /**
   * Manually trigger a specific source job immediately
   */
  async triggerSourceNow(sourceId: string, existingCatalog: Opportunity[] = []): Promise<PipelineResult> {
    const job = this.jobs.get(sourceId);
    if (!job) {
      throw new Error(`Job not found for source: ${sourceId}`);
    }

    try {
      const res = await runIngestionPipeline(sourceId, existingCatalog);
      job.lastCheckedAt = new Date().toISOString();
      job.nextCheckAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

      sourceHealthService.recordSuccess(
        sourceId,
        res.summary.fetchedCount,
        res.summary.validCount,
        res.summary.invalidCount
      );

      await auditLogService.logAction(
        "Admin User",
        "source_ingestion_run",
        sourceId,
        `Manual trigger completed: ${res.summary.queuedForReviewCount} records placed in review queue.`
      );

      return res;
    } catch (err: any) {
      sourceHealthService.recordFailure(sourceId, err.message || String(err));
      throw err;
    }
  }
}

export const ingestionScheduler = new IngestionScheduler();
