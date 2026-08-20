import type { Opportunity } from "@/types";
import type { IngestionRunSummary, NormalizedOpportunity } from "./types";
import { sourceRegistry } from "./sourceRegistry";
import { reviewQueueService } from "./reviewQueueService";
import { ingestionLogger } from "./ingestionLogger";

export interface PipelineResult {
  sourceId: string;
  sourceName: string;
  summary: IngestionRunSummary;
  enqueuedForReview: NormalizedOpportunity[];
}

/**
 * Real Opportunity Ingestion Pipeline
 * Executes safe end-to-end ingestion and automatically deposits validated, non-duplicate
 * records into the Human Review Queue.
 */
export async function runIngestionPipeline(
  sourceId: string,
  existingCatalog: Opportunity[]
): Promise<PipelineResult> {
  const connector = sourceRegistry.getConnector(sourceId);
  if (!connector) {
    throw new Error(`Source connector not found for: ${sourceId}`);
  }

  ingestionLogger.info("pipeline", `Starting Phase 3B Ingestion Pipeline for ${connector.sourceName}...`);

  // Step 1: Run Source Ingestion (Fetch -> Normalize -> Validate -> Deduplicate -> Change Detect)
  const { summary, processedOpportunities } = await sourceRegistry.runSourceIngestion(
    sourceId,
    existingCatalog
  );

  const enqueued: NormalizedOpportunity[] = [];

  // Step 2: Enqueue New Items into Human Review Queue (Never auto-publish!)
  for (const opp of processedOpportunities) {
    reviewQueueService.addToReviewQueue(
      opp,
      `Ingested from official source ${connector.sourceName} - awaiting human verification`
    );
    enqueued.push(opp);
  }

  summary.queuedForReviewCount = enqueued.length;

  ingestionLogger.info(
    "pipeline",
    `Pipeline completed for ${connector.sourceName}: ${enqueued.length} opportunities placed in review queue.`
  );

  return {
    sourceId,
    sourceName: connector.sourceName,
    summary,
    enqueuedForReview: enqueued,
  };
}

/**
 * Runs ingestion pipeline across all active official registered sources
 */
export async function runAllActiveSourcesPipeline(
  existingCatalog: Opportunity[]
): Promise<PipelineResult[]> {
  const sources = sourceRegistry.getAllSources();
  const results: PipelineResult[] = [];

  for (const src of sources) {
    if (src.status === "active") {
      try {
        const result = await runIngestionPipeline(src.id, existingCatalog);
        results.push(result);
      } catch (err: any) {
        ingestionLogger.error(src.id, `Pipeline run error: ${err.message || String(err)}`);
      }
    }
  }

  return results;
}
