import { getSupabaseClient } from "@/lib/supabase/client";

export type AuditAction =
  | "opportunity_approved"
  | "opportunity_rejected"
  | "opportunity_edited"
  | "verification_changed"
  | "source_disabled"
  | "source_enabled"
  | "source_ingestion_run"
  | "matching_run_completed";

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: AuditAction;
  target: string;
  timestamp: string;
  notes?: string;
  metadata?: Record<string, any>;
}

class AuditLogService {
  private inMemoryLogs: AuditLogEntry[] = [];

  constructor() {
    this.inMemoryLogs.push({
      id: "audit-init-01",
      actor: "System Administrator",
      action: "source_enabled",
      target: "src-gov-isro",
      timestamp: new Date("2026-08-20T10:00:00Z").toISOString(),
      notes: "ISRO ICRB official connector activated for real opportunity ingestion.",
    });
  }

  async logAction(
    actor: string,
    action: AuditAction,
    target: string,
    notes?: string,
    metadata?: Record<string, any>
  ): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      actor,
      action,
      target,
      timestamp: new Date().toISOString(),
      notes,
      metadata,
    };

    this.inMemoryLogs.unshift(entry);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from("opportunity_change_events").insert({
          opportunity_id: target,
          change_type: action,
          old_data: { actor, notes },
          new_data: metadata || {},
        });
      } catch (e) {
        console.warn("Supabase audit log fallback:", e);
      }
    }

    return entry;
  }

  getRecentLogs(limit: number = 20): AuditLogEntry[] {
    return this.inMemoryLogs.slice(0, limit);
  }
}

export const auditLogService = new AuditLogService();
