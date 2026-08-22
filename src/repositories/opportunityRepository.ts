import type { Opportunity, RevalidationAuditRecord } from "@/types";
import { realVerifiedOpportunities } from "@/data/realOpportunities";

export interface IOpportunityRepository {
  getAllActive(): Promise<Opportunity[]>;
  getAll(): Promise<Opportunity[]>;
  getById(id: string): Promise<Opportunity | null>;
  upsert(opportunity: Opportunity): Promise<Opportunity>;
  update(id: string, updates: Partial<Opportunity>): Promise<Opportunity>;
  archive(id: string): Promise<void>;
  findByCanonicalUrl(url: string): Promise<Opportunity | null>;
  findByTitle(title: string): Promise<Opportunity | null>;
  getAuditHistory(opportunityId?: string): Promise<RevalidationAuditRecord[]>;
  addAuditRecord(record: RevalidationAuditRecord): Promise<void>;
}

export class OpportunityRepository implements IOpportunityRepository {
  private dbPath: string = "";
  private auditDbPath: string = "";
  private isServer: boolean;

  constructor() {
    this.isServer = typeof window === "undefined";

    if (this.isServer) {
      try {
        const req = eval("require");
        const path = req("path");
        const fs = req("fs");
        const dataDir = path.join(process.cwd(), "src", "data");
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        this.dbPath = path.join(dataDir, "persistentOpportunities.json");
        this.auditDbPath = path.join(dataDir, "persistentAuditLogs.json");
      } catch (err) {
        console.warn("[OpportunityRepository] Server path resolve note:", err);
      }
    }

    this.ensureDatabaseSeeded();
  }

  /**
   * Initializes persistent database with seed data if file/storage does not exist.
   */
  private ensureDatabaseSeeded(): void {
    if (this.isServer && this.dbPath) {
      try {
        const req = eval("require");
        const fs = req("fs");
        if (!fs.existsSync(this.dbPath)) {
          const initialMap: Record<string, Opportunity> = {};
          const nowIso = new Date().toISOString();

          for (const opp of realVerifiedOpportunities) {
            initialMap[opp.id] = {
              ...opp,
              createdAt: opp.createdAt || nowIso,
              updatedAt: opp.updatedAt || nowIso,
            };
          }
          this.saveStoreToDisk(initialMap);
        }

        if (!fs.existsSync(this.auditDbPath)) {
          fs.writeFileSync(this.auditDbPath, JSON.stringify([], null, 2), "utf-8");
        }
      } catch (err) {
        console.warn("[OpportunityRepository] Server seed error:", err);
      }
    } else if (!this.isServer) {
      try {
        if (!localStorage.getItem("opportune_persistent_db")) {
          const initialMap: Record<string, Opportunity> = {};
          for (const opp of realVerifiedOpportunities) {
            initialMap[opp.id] = { ...opp };
          }
          localStorage.setItem("opportune_persistent_db", JSON.stringify(initialMap));
        }
      } catch {
        // Browser storage fallback
      }
    }
  }

  private readStoreFromDisk(): Record<string, Opportunity> {
    if (this.isServer && this.dbPath) {
      try {
        const fs = eval("require")("fs");
        if (fs.existsSync(this.dbPath)) {
          const raw = fs.readFileSync(this.dbPath, "utf-8");
          return JSON.parse(raw) || {};
        }
      } catch (err) {
        console.error("[OpportunityRepository] Server DB read error:", err);
      }
    } else if (!this.isServer) {
      try {
        const raw = localStorage.getItem("opportune_persistent_db");
        if (raw) return JSON.parse(raw);
      } catch {
        // Browser fallback
      }
    }

    // Default seed map fallback if unreadable
    const fallback: Record<string, Opportunity> = {};
    for (const opp of realVerifiedOpportunities) {
      fallback[opp.id] = { ...opp };
    }
    return fallback;
  }

  private saveStoreToDisk(store: Record<string, Opportunity>): void {
    if (this.isServer && this.dbPath) {
      try {
        const fs = eval("require")("fs");
        const tempPath = `${this.dbPath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), "utf-8");
        fs.renameSync(tempPath, this.dbPath); // Atomic file write
      } catch (err) {
        console.error("[OpportunityRepository] Server DB write error:", err);
      }
    } else if (!this.isServer) {
      try {
        localStorage.setItem("opportune_persistent_db", JSON.stringify(store));
      } catch {
        // Browser fallback
      }
    }
  }

  private readAuditFromDisk(): RevalidationAuditRecord[] {
    if (this.isServer && this.auditDbPath) {
      try {
        const fs = eval("require")("fs");
        if (fs.existsSync(this.auditDbPath)) {
          const raw = fs.readFileSync(this.auditDbPath, "utf-8");
          return JSON.parse(raw) || [];
        }
      } catch {
        // Ignore read error
      }
    }
    return [];
  }

  private saveAuditToDisk(records: RevalidationAuditRecord[]): void {
    if (this.isServer && this.auditDbPath) {
      try {
        const fs = eval("require")("fs");
        const tempPath = `${this.auditDbPath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(records, null, 2), "utf-8");
        fs.renameSync(tempPath, this.auditDbPath);
      } catch (err) {
        console.error("[OpportunityRepository] Audit write error:", err);
      }
    }
  }

  /**
   * Returns all active, published, and unexpired opportunities from database.
   */
  async getAllActive(): Promise<Opportunity[]> {
    const store = this.readStoreFromDisk();
    const todayIso = new Date().toISOString().split("T")[0];

    return Object.values(store).filter((opp) => {
      const isPublished = opp.lifecycleStatus === "published" || !opp.lifecycleStatus;
      const isVerified =
        opp.verificationStatus === "verified" ||
        opp.verificationStatus === "partner_verified" ||
        opp.verificationStatus === "verified_partner" ||
        opp.verificationStatus === "verified_gov";
      const notExpired = opp.deadline >= todayIso && opp.lifecycleStatus !== "expired";
      return isPublished && isVerified && notExpired;
    });
  }

  /**
   * Returns all stored opportunities from database regardless of status.
   */
  async getAll(): Promise<Opportunity[]> {
    const store = this.readStoreFromDisk();
    return Object.values(store);
  }

  /**
   * Finds an opportunity by ID in persistent database.
   */
  async getById(id: string): Promise<Opportunity | null> {
    const store = this.readStoreFromDisk();
    const found = store[id];
    return found ? { ...found } : null;
  }

  /**
   * Upserts opportunity with Unique Constraints:
   * 1. Unique Canonical URL (officialUrl)
   * 2. Unique Title + Organization
   */
  async upsert(opportunity: Opportunity): Promise<Opportunity> {
    const store = this.readStoreFromDisk();
    const nowIso = new Date().toISOString();

    // Check Unique Constraint on Canonical URL
    if (opportunity.officialUrl) {
      const normCanonical = opportunity.officialUrl.toLowerCase().trim().replace(/\/$/, "");
      for (const existing of Object.values(store)) {
        if (existing.id !== opportunity.id && existing.officialUrl) {
          const existingNorm = existing.officialUrl.toLowerCase().trim().replace(/\/$/, "");
          if (existingNorm === normCanonical) {
            const updated = {
              ...existing,
              ...opportunity,
              id: existing.id, // Preserve original PK ID
              updatedAt: nowIso,
            };
            store[existing.id] = updated;
            this.saveStoreToDisk(store);
            return updated;
          }
        }
      }
    }

    // Check Unique Constraint on Title + Organization
    const normTitleOrg = `${opportunity.title.toLowerCase().trim()}|${opportunity.organization.toLowerCase().trim()}`;
    for (const existing of Object.values(store)) {
      if (existing.id !== opportunity.id) {
        const existingNorm = `${existing.title.toLowerCase().trim()}|${existing.organization.toLowerCase().trim()}`;
        if (existingNorm === normTitleOrg) {
          const updated = {
            ...existing,
            ...opportunity,
            id: existing.id,
            updatedAt: nowIso,
          };
          store[existing.id] = updated;
          this.saveStoreToDisk(store);
          return updated;
        }
      }
    }

    // New or updated record insertion
    const isNew = !store[opportunity.id];
    const record: Opportunity = {
      ...opportunity,
      createdAt: isNew ? nowIso : (store[opportunity.id].createdAt || nowIso),
      updatedAt: nowIso,
    };

    store[record.id] = record;
    this.saveStoreToDisk(store);
    return record;
  }

  async update(id: string, updates: Partial<Opportunity>): Promise<Opportunity> {
    const store = this.readStoreFromDisk();
    const existing = store[id];
    if (!existing) {
      throw new Error(`Opportunity with ID "${id}" not found in persistent database.`);
    }

    const updated: Opportunity = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    store[id] = updated;
    this.saveStoreToDisk(store);
    return updated;
  }

  async archive(id: string): Promise<void> {
    const store = this.readStoreFromDisk();
    if (store[id]) {
      store[id].lifecycleStatus = "expired";
      store[id].updatedAt = new Date().toISOString();
      this.saveStoreToDisk(store);
    }
  }

  async findByCanonicalUrl(url: string): Promise<Opportunity | null> {
    if (!url) return null;
    const store = this.readStoreFromDisk();
    const target = url.toLowerCase().trim().replace(/\/$/, "");

    for (const opp of Object.values(store)) {
      if (opp.officialUrl && opp.officialUrl.toLowerCase().trim().replace(/\/$/, "") === target) {
        return { ...opp };
      }
      if (opp.sourceUrl && opp.sourceUrl.toLowerCase().trim().replace(/\/$/, "") === target) {
        return { ...opp };
      }
    }
    return null;
  }

  async findByTitle(title: string): Promise<Opportunity | null> {
    if (!title) return null;
    const store = this.readStoreFromDisk();
    const target = title.toLowerCase().trim();

    for (const opp of Object.values(store)) {
      if (opp.title.toLowerCase().trim() === target) {
        return { ...opp };
      }
    }
    return null;
  }

  async getAuditHistory(opportunityId?: string): Promise<RevalidationAuditRecord[]> {
    const records = this.readAuditFromDisk();
    if (!opportunityId) return records;
    return records.filter((r) => r.opportunityId === opportunityId);
  }

  async addAuditRecord(record: RevalidationAuditRecord): Promise<void> {
    const records = this.readAuditFromDisk();
    records.push(record);
    this.saveAuditToDisk(records);
  }
}

export const opportunityRepository = new OpportunityRepository();
