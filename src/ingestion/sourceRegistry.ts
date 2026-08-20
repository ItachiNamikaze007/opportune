import type { Opportunity } from "@/types";
import type { DbOpportunitySource, SourceStatus } from "@/types/database";
import type {
  OpportunitySourceConnector,
  IngestionRunSummary,
  NormalizedOpportunity,
} from "./types";
import { GovPortalConnector } from "./connectors/GovPortalConnector";
import { ISROGovConnector } from "./connectors/ISROGovConnector";
import { MeitYGovConnector } from "./connectors/MeitYGovConnector";
import { DRDOGovConnector } from "./connectors/DRDOGovConnector";
import { UPSCExamConnector } from "./connectors/UPSCExamConnector";
import { deduplicateOpportunity } from "./deduplicateOpportunity";
import { detectOpportunityChanges } from "./changeDetection";
import { ingestionLogger } from "./ingestionLogger";

class SourceRegistry {
  private connectors: Map<string, OpportunitySourceConnector> = new Map();
  private sourceMetadata: Map<
    string,
    {
      status: SourceStatus;
      lastCheckedAt: string | null;
      lastSuccessAt: string | null;
      lastError: string | null;
      checkFrequency: string;
    }
  > = new Map();

  constructor() {
    // Register official high-value government & research connectors
    this.registerConnector(new GovPortalConnector());
    this.registerConnector(new ISROGovConnector());
    this.registerConnector(new MeitYGovConnector());
    this.registerConnector(new DRDOGovConnector());
    this.registerConnector(new UPSCExamConnector());
  }

  /**
   * Registers a connector into the ingestion engine
   */
  registerConnector(connector: OpportunitySourceConnector) {
    this.connectors.set(connector.sourceId, connector);
    if (!this.sourceMetadata.has(connector.sourceId)) {
      this.sourceMetadata.set(connector.sourceId, {
        status: connector.status || "active",
        lastCheckedAt: null,
        lastSuccessAt: null,
        lastError: null,
        checkFrequency: connector.fetchFrequency || "daily",
      });
    }
    ingestionLogger.info("system", `Registered connector: ${connector.sourceName} (${connector.sourceId})`);
  }

  getConnector(sourceId: string): OpportunitySourceConnector | undefined {
    return this.connectors.get(sourceId);
  }

  /**
   * Updates a source's operational status (active, paused, error, disabled, manual_review_required)
   */
  updateSourceStatus(sourceId: string, status: SourceStatus, errorDetails?: string) {
    const meta = this.sourceMetadata.get(sourceId);
    if (meta) {
      meta.status = status;
      if (errorDetails) {
        meta.lastError = errorDetails;
      }
      this.sourceMetadata.set(sourceId, meta);
      ingestionLogger.info(sourceId, `Source status changed to ${status}`);
    }
  }

  /**
   * Returns list of all registered source metadata
   */
  getAllSources(): DbOpportunitySource[] {
    const list: DbOpportunitySource[] = [];
    const now = new Date().toISOString();

    for (const [id, connector] of this.connectors.entries()) {
      const meta = this.sourceMetadata.get(id);
      list.push({
        id,
        source_name: connector.sourceName,
        source_url: connector.sourceUrl,
        source_type: connector.sourceType,
        is_official: connector.isOfficial,
        is_active: meta?.status === "active",
        status: meta?.status || "active",
        check_frequency: meta?.checkFrequency || "daily",
        last_checked_at: meta?.lastCheckedAt || null,
        last_success_at: meta?.lastSuccessAt || null,
        last_error: meta?.lastError || null,
        created_at: now,
        updated_at: now,
      });
    }

    return list;
  }

  /**
   * Executes a complete safe ingestion run for a single source
   */
  async runSourceIngestion(
    sourceId: string,
    existingCatalog: Opportunity[]
  ): Promise<{
    summary: IngestionRunSummary;
    processedOpportunities: NormalizedOpportunity[];
  }> {
    const connector = this.connectors.get(sourceId);
    const startedAt = new Date().toISOString();

    if (!connector) {
      throw new Error(`Connector not found for source ID: ${sourceId}`);
    }

    const meta = this.sourceMetadata.get(sourceId);
    if (meta?.status === "paused" || meta?.status === "disabled" || meta?.status === "manual_review_required") {
      ingestionLogger.warn(sourceId, `Skipping automated ingestion for [${meta.status}] source.`);
      const summary: IngestionRunSummary = {
        sourceId,
        sourceName: connector.sourceName,
        startedAt,
        completedAt: new Date().toISOString(),
        fetchedCount: 0,
        validCount: 0,
        invalidCount: 0,
        newCount: 0,
        updatedCount: 0,
        duplicateCount: 0,
        queuedForReviewCount: 0,
        errors: [`Source is marked as ${meta.status}. Manual review or unpause required.`],
        status: meta.status === "manual_review_required" ? "partial" : "failed",
      };
      return { summary, processedOpportunities: [] };
    }

    const errors: string[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let newCount = 0;
    let updatedCount = 0;
    let duplicateCount = 0;
    let queuedForReviewCount = 0;
    const processedOpportunities: NormalizedOpportunity[] = [];

    try {
      if (meta) {
        meta.lastCheckedAt = startedAt;
      }

      // Step 1: Safe Fetch
      const rawRecords = await connector.fetch();
      ingestionLogger.info(sourceId, `Fetched ${rawRecords.length} raw records from ${connector.sourceName}`);

      // Step 2: Normalize, Validate, Deduplicate, Confidence Score
      for (const raw of rawRecords) {
        try {
          const normalized = connector.normalize(raw);
          const validation = connector.validate(normalized);

          if (!validation.valid) {
            invalidCount++;
            errors.push(`Validation failed for "${normalized.title}": ${validation.errors.join(", ")}`);
            ingestionLogger.warn(sourceId, `Invalid item skipped: ${normalized.title}`, { validation });
            continue;
          }

          validCount++;

          // Step 3: Deduplication check
          const dedup = deduplicateOpportunity(normalized, existingCatalog);
          if (dedup.isDuplicate) {
            duplicateCount++;
            const existingMatch = existingCatalog.find((o) => o.id === dedup.duplicateOf);
            const changes = detectOpportunityChanges(existingMatch, normalized);

            if (changes.hasChanges) {
              updatedCount++;
              ingestionLogger.info(
                sourceId,
                `Change detected for duplicate [${dedup.duplicateOf}] (${changes.changeType})`,
                changes.diffs
              );
            }
          } else {
            newCount++;
            queuedForReviewCount++;
            // Generate deterministic ID
            normalized.id = `real-${sourceId}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
            processedOpportunities.push(normalized);
          }
        } catch (itemErr: any) {
          invalidCount++;
          errors.push(`Normalization error: ${itemErr.message || String(itemErr)}`);
        }
      }

      // Record success
      if (meta) {
        meta.lastSuccessAt = new Date().toISOString();
        meta.lastError = null;
        meta.status = "active";
      }

      const summary: IngestionRunSummary = {
        sourceId,
        sourceName: connector.sourceName,
        startedAt,
        completedAt: new Date().toISOString(),
        fetchedCount: rawRecords.length,
        validCount,
        invalidCount,
        newCount,
        updatedCount,
        duplicateCount,
        queuedForReviewCount,
        errors,
        status: errors.length > 0 && validCount === 0 ? "failed" : errors.length > 0 ? "partial" : "success",
      };

      ingestionLogger.recordRunSummary(summary);
      return { summary, processedOpportunities };
    } catch (fetchErr: any) {
      const errMsg = fetchErr.message || String(fetchErr);
      if (meta) {
        meta.status = "error";
        meta.lastError = errMsg;
      }
      errors.push(errMsg);
      ingestionLogger.error(sourceId, `Fetch failed for source: ${errMsg}`);

      const summary: IngestionRunSummary = {
        sourceId,
        sourceName: connector.sourceName,
        startedAt,
        completedAt: new Date().toISOString(),
        fetchedCount: 0,
        validCount: 0,
        invalidCount: 0,
        newCount: 0,
        updatedCount: 0,
        duplicateCount: 0,
        queuedForReviewCount: 0,
        errors,
        status: "failed",
      };

      ingestionLogger.recordRunSummary(summary);
      return { summary, processedOpportunities: [] };
    }
  }
}

export const sourceRegistry = new SourceRegistry();
