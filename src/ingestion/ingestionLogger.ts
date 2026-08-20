import type { IngestionRunSummary } from "./types.ts";

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  sourceId: string;
  message: string;
  details?: Record<string, any>;
}

class IngestionLogger {
  private logs: LogEntry[] = [];
  private runSummaries: IngestionRunSummary[] = [];

  log(level: LogEntry["level"], sourceId: string, message: string, details?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      sourceId,
      message,
      details,
    };
    this.logs.push(entry);

    // Keep log memory bounded
    if (this.logs.length > 500) {
      this.logs.shift();
    }

    if (level === "error") {
      console.error(`[Ingestion ERROR][${sourceId}] ${message}`, details || "");
    } else if (level === "warn") {
      console.warn(`[Ingestion WARN][${sourceId}] ${message}`, details || "");
    } else {
      console.log(`[Ingestion INFO][${sourceId}] ${message}`);
    }
  }

  info(sourceId: string, message: string, details?: Record<string, any>) {
    this.log("info", sourceId, message, details);
  }

  warn(sourceId: string, message: string, details?: Record<string, any>) {
    this.log("warn", sourceId, message, details);
  }

  error(sourceId: string, message: string, details?: Record<string, any>) {
    this.log("error", sourceId, message, details);
  }

  recordRunSummary(summary: IngestionRunSummary) {
    this.runSummaries.unshift(summary);
    if (this.runSummaries.length > 50) {
      this.runSummaries.pop();
    }
  }

  getLogs(sourceId?: string, limit: number = 50): LogEntry[] {
    if (sourceId) {
      return this.logs.filter((l) => l.sourceId === sourceId).slice(-limit);
    }
    return this.logs.slice(-limit);
  }

  getRecentRuns(limit: number = 10): IngestionRunSummary[] {
    return this.runSummaries.slice(0, limit);
  }
}

export const ingestionLogger = new IngestionLogger();
