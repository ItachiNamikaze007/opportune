export type SourceHealthStatus = "Healthy" | "Warning" | "Error" | "Manual Review";

export interface SourceHealthMetrics {
  sourceId: string;
  sourceName: string;
  healthStatus: SourceHealthStatus;
  successCount: number;
  failureCount: number;
  lastSuccessfulFetch: string | null;
  lastFailure: string | null;
  lastError: string | null;
  recordsDiscovered: number;
  recordsAccepted: number;
  recordsRejected: number;
  consecutiveFailures: number;
}

class SourceHealthService {
  private metrics: Map<string, SourceHealthMetrics> = new Map();

  constructor() {
    this.seedDefaultMetrics();
  }

  private seedDefaultMetrics() {
    const defaults: SourceHealthMetrics[] = [
      {
        sourceId: "src-gov-isro",
        sourceName: "ISRO Centralised Recruitment Board (ICRB)",
        healthStatus: "Healthy",
        successCount: 12,
        failureCount: 0,
        lastSuccessfulFetch: new Date().toISOString(),
        lastFailure: null,
        lastError: null,
        recordsDiscovered: 18,
        recordsAccepted: 17,
        recordsRejected: 1,
        consecutiveFailures: 0,
      },
      {
        sourceId: "src-gov-meity",
        sourceName: "Ministry of Electronics & IT (MeitY)",
        healthStatus: "Healthy",
        successCount: 9,
        failureCount: 0,
        lastSuccessfulFetch: new Date().toISOString(),
        lastFailure: null,
        lastError: null,
        recordsDiscovered: 12,
        recordsAccepted: 12,
        recordsRejected: 0,
        consecutiveFailures: 0,
      },
      {
        sourceId: "src-gov-drdo",
        sourceName: "DRDO Recruitment & Assessment Centre (RAC)",
        healthStatus: "Healthy",
        successCount: 8,
        failureCount: 0,
        lastSuccessfulFetch: new Date().toISOString(),
        lastFailure: null,
        lastError: null,
        recordsDiscovered: 10,
        recordsAccepted: 10,
        recordsRejected: 0,
        consecutiveFailures: 0,
      },
      {
        sourceId: "src-gov-niti",
        sourceName: "NITI Aayog Official Scheme Portal",
        healthStatus: "Healthy",
        successCount: 14,
        failureCount: 0,
        lastSuccessfulFetch: new Date().toISOString(),
        lastFailure: null,
        lastError: null,
        recordsDiscovered: 24,
        recordsAccepted: 23,
        recordsRejected: 1,
        consecutiveFailures: 0,
      },
      {
        sourceId: "src-gov-upsc",
        sourceName: "Union Public Service Commission (UPSC)",
        healthStatus: "Manual Review",
        successCount: 0,
        failureCount: 0,
        lastSuccessfulFetch: null,
        lastFailure: null,
        lastError: "Source requires manual reviewer inspection for gazette notification PDFs",
        recordsDiscovered: 0,
        recordsAccepted: 0,
        recordsRejected: 0,
        consecutiveFailures: 0,
      },
    ];

    defaults.forEach((m) => this.metrics.set(m.sourceId, m));
  }

  getMetrics(sourceId: string): SourceHealthMetrics {
    if (!this.metrics.has(sourceId)) {
      const init: SourceHealthMetrics = {
        sourceId,
        sourceName: sourceId,
        healthStatus: "Healthy",
        successCount: 0,
        failureCount: 0,
        lastSuccessfulFetch: null,
        lastFailure: null,
        lastError: null,
        recordsDiscovered: 0,
        recordsAccepted: 0,
        recordsRejected: 0,
        consecutiveFailures: 0,
      };
      this.metrics.set(sourceId, init);
    }
    return this.metrics.get(sourceId)!;
  }

  getAllMetrics(): SourceHealthMetrics[] {
    return Array.from(this.metrics.values());
  }

  recordSuccess(sourceId: string, discovered: number, accepted: number, rejected: number) {
    const metric = this.getMetrics(sourceId);
    metric.successCount += 1;
    metric.consecutiveFailures = 0;
    metric.lastSuccessfulFetch = new Date().toISOString();
    metric.recordsDiscovered += discovered;
    metric.recordsAccepted += accepted;
    metric.recordsRejected += rejected;

    if (metric.healthStatus !== "Manual Review") {
      metric.healthStatus = "Healthy";
    }
  }

  recordFailure(sourceId: string, errorMessage: string) {
    const metric = this.getMetrics(sourceId);
    metric.failureCount += 1;
    metric.consecutiveFailures += 1;
    metric.lastFailure = new Date().toISOString();
    metric.lastError = errorMessage;

    if (metric.healthStatus !== "Manual Review") {
      if (metric.consecutiveFailures >= 3) {
        metric.healthStatus = "Error";
      } else {
        metric.healthStatus = "Warning";
      }
    }
  }
}

export const sourceHealthService = new SourceHealthService();
