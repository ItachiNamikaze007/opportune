import { ApplicationStage, StudentApplication } from "@/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { DbApplication } from "@/types/database";

const LOCAL_STORAGE_APPS = "student_applications_tracker";

const initialDefaultApplications: StudentApplication[] = [
  {
    id: "app-1",
    opportunityId: "opp-01",
    stage: "applied",
    appliedDate: "2026-08-16",
    updatedDate: "2026-08-16",
    notes: "Submitted architecture proposal with team of 3. Team Lead: Aarav.",
  },
  {
    id: "app-2",
    opportunityId: "opp-07",
    stage: "assessment",
    appliedDate: "2026-08-10",
    updatedDate: "2026-08-18",
    notes: "Completed Codility test. Scored 100% on algorithmic section.",
  },
  {
    id: "app-3",
    opportunityId: "opp-08",
    stage: "interview",
    appliedDate: "2026-08-05",
    updatedDate: "2026-08-19",
    notes: "Virtual interview with Dr. Chen at University of Toronto scheduled.",
  },
  {
    id: "app-4",
    opportunityId: "opp-02",
    stage: "applied",
    appliedDate: "2026-08-12",
    updatedDate: "2026-08-12",
    notes: "College NOC submitted and verified.",
  },
  {
    id: "app-5",
    opportunityId: "opp-06",
    stage: "selected",
    appliedDate: "2026-08-01",
    updatedDate: "2026-08-15",
    notes: "College internal round cleared! Team nominated for national finals.",
  },
  {
    id: "app-6",
    opportunityId: "opp-03",
    stage: "saved",
    updatedDate: "2026-08-17",
    notes: "Need to upload income certificate before submitting.",
  },
];

function mapDbToApplication(row: DbApplication): StudentApplication {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    stage: row.stage,
    appliedDate: row.applied_date || undefined,
    updatedDate: row.updated_at ? row.updated_at.split("T")[0] : new Date().toISOString().split("T")[0],
    notes: row.notes || undefined,
    customReminder: row.custom_reminder || undefined,
  };
}

const inMemoryApplications: Map<string, StudentApplication[]> = new Map();

export const applicationService = {
  async getApplications(userId: string = "demo-user"): Promise<StudentApplication[]> {
    if (inMemoryApplications.has(userId)) {
      return inMemoryApplications.get(userId)!;
    }

    const supabase = getSupabaseClient();

    if (supabase && userId !== "demo-user") {
      try {
        const { data, error } = await supabase
          .from("applications")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });

        if (data && data.length > 0 && !error) {
          const list = data.map(mapDbToApplication);
          inMemoryApplications.set(userId, list);
          return list;
        }
      } catch (err) {
        console.warn("Supabase applications fetch failed:", err);
      }
    }

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_APPS);
        if (stored) {
          const list = JSON.parse(stored);
          inMemoryApplications.set(userId, list);
          return list;
        }
      } catch (e) {
        console.error("Local apps read error:", e);
      }
    }

    const defaultList = [...initialDefaultApplications];
    inMemoryApplications.set(userId, defaultList);
    return defaultList;
  },

  async createApplication(
    opportunityId: string,
    stage: ApplicationStage = "applied",
    notes: string = "",
    userId: string = "demo-user"
  ): Promise<StudentApplication> {
    const today = new Date().toISOString().split("T")[0];

    const newApp: StudentApplication = {
      id: "app-" + Math.random().toString(36).substring(2, 8),
      opportunityId,
      stage,
      appliedDate: today,
      updatedDate: today,
      notes,
    };

    const current = await this.getApplications(userId);
    const updated = [newApp, ...current];
    inMemoryApplications.set(userId, updated);

    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_APPS, JSON.stringify(updated));
    }

    const supabase = getSupabaseClient();
    if (supabase && userId !== "demo-user") {
      try {
        const { data } = await supabase
          .from("applications")
          .insert({
            user_id: userId,
            opportunity_id: opportunityId,
            stage,
            notes,
            applied_date: today,
          })
          .select()
          .single();

        if (data) {
          return mapDbToApplication(data);
        }
      } catch (err) {
        console.warn("Supabase application create failed:", err);
      }
    }

    return newApp;
  },

  async updateApplicationStage(
    applicationId: string,
    stage: ApplicationStage,
    userId: string = "demo-user"
  ): Promise<StudentApplication | null> {
    const list = await this.getApplications(userId);
    const app = list.find((a) => a.id === applicationId);
    if (app) {
      app.stage = stage;
      app.updatedDate = new Date().toISOString().split("T")[0];
      inMemoryApplications.set(userId, [...list]);

      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_APPS, JSON.stringify(list));
      }
    }

    const supabase = getSupabaseClient();
    if (supabase && userId !== "demo-user") {
      try {
        await supabase
          .from("applications")
          .update({ stage, updated_at: new Date().toISOString() })
          .eq("id", applicationId);
      } catch (err) {
        console.warn("Supabase stage update failed:", err);
      }
    }

    return app || null;
  },

  async updateApplicationNotes(
    applicationId: string,
    notes: string,
    userId?: string
  ): Promise<void> {
    const supabase = getSupabaseClient();

    if (supabase && userId) {
      try {
        await supabase
          .from("applications")
          .update({ notes, updated_at: new Date().toISOString() })
          .eq("id", applicationId);
      } catch (err) {
        console.warn("Supabase notes update failed:", err);
      }
    }
  },

  async deleteApplication(applicationId: string, userId?: string): Promise<void> {
    const supabase = getSupabaseClient();

    if (supabase && userId) {
      try {
        await supabase.from("applications").delete().eq("id", applicationId);
      } catch (err) {
        console.warn("Supabase application delete failed:", err);
      }
    }
  },
};
