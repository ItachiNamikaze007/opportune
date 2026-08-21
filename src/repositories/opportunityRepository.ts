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
  private store: Map<string, Opportunity> = new Map();
  private auditHistory: RevalidationAuditRecord[] = [];
  private initialized = false;

  constructor() {
    this.initializeFromSeed();
  }

  private initializeFromSeed(): void {
    if (this.initialized) return;
    for (const opp of realVerifiedOpportunities) {
      this.store.set(opp.id, { ...opp });
    }
    this.initialized = true;
  }

  /**
   * Returns all active, published, and unexpired opportunities.
   */
  async getAllActive(): Promise<Opportunity[]> {
    this.initializeFromSeed();
    const todayIso = new Date().toISOString().split("T")[0];
    return Array.from(this.store.values()).filter((opp) => {
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
   * Returns all stored opportunities regardless of status.
   */
  async getAll(): Promise<Opportunity[]> {
    this.initializeFromSeed();
    return Array.from(this.store.values());
  }

  /**
   * Finds an opportunity by ID.
   */
  async getById(id: string): Promise<Opportunity | null> {
    this.initializeFromSeed();
    const found = this.store.get(id);
    return found ? { ...found } : null;
  }

  /**
   * Inserts or updates an opportunity.
   */
  async upsert(opportunity: Opportunity): Promise<Opportunity> {
    this.initializeFromSeed();
    const cloned = { ...opportunity };
    this.store.set(opportunity.id, cloned);
    return { ...cloned };
  }

  /**
   * Updates specific fields of an opportunity.
   */
  async update(id: string, updates: Partial<Opportunity>): Promise<Opportunity> {
    this.initializeFromSeed();
    const existing = this.store.get(id);
    if (!existing) {
      throw new Error(`Opportunity with ID "${id}" not found in repository.`);
    }
    const updated: Opportunity = {
      ...existing,
      ...updates,
      id: existing.id, // ID is immutable
    };
    this.store.set(id, updated);
    return { ...updated };
  }

  /**
   * Archives an opportunity by setting its lifecycleStatus to 'rejected' or 'expired'.
   */
  async archive(id: string): Promise<void> {
    this.initializeFromSeed();
    const existing = this.store.get(id);
    if (existing) {
      this.store.set(id, {
        ...existing,
        lifecycleStatus: "rejected",
        verificationStatus: "failed",
      });
    }
  }

  /**
   * Finds an opportunity by exact canonical official URL or source URL.
   */
  async findByCanonicalUrl(url: string): Promise<Opportunity | null> {
    this.initializeFromSeed();
    const cleanUrl = url.trim().toLowerCase().replace(/\/$/, "");
    for (const opp of this.store.values()) {
      const oppOfficial = (opp.officialUrl || "").trim().toLowerCase().replace(/\/$/, "");
      const oppSource = (opp.sourceUrl || "").trim().toLowerCase().replace(/\/$/, "");
      if (oppOfficial === cleanUrl || oppSource === cleanUrl) {
        return { ...opp };
      }
    }
    return null;
  }

  /**
   * Finds an opportunity by exact or normalized title.
   */
  async findByTitle(title: string): Promise<Opportunity | null> {
    this.initializeFromSeed();
    const norm = title.trim().toLowerCase();
    for (const opp of this.store.values()) {
      if (opp.title.trim().toLowerCase() === norm) {
        return { ...opp };
      }
    }
    return null;
  }

  /**
   * Returns audit history, optionally filtered by opportunity ID.
   */
  async getAuditHistory(opportunityId?: string): Promise<RevalidationAuditRecord[]> {
    if (!opportunityId) {
      return [...this.auditHistory];
    }
    return this.auditHistory.filter((rec) => rec.opportunityId === opportunityId);
  }

  /**
   * Appends an audit record.
   */
  async addAuditRecord(record: RevalidationAuditRecord): Promise<void> {
    this.auditHistory.push(record);
  }

  /**
   * Resets repository to the base seed (useful for isolated unit testing).
   */
  resetToSeed(): void {
    this.store.clear();
    this.auditHistory = [];
    this.initialized = false;
    this.initializeFromSeed();
  }
}

export const opportunityRepository = new OpportunityRepository();
