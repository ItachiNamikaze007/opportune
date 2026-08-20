import { getSupabaseClient } from "@/lib/supabase/client";

const LOCAL_STORAGE_SAVED = "student_saved_opportunities";
const inMemorySaved: Map<string, Set<string>> = new Map(); // key: userId

export const savedService = {
  async getSavedOpportunities(userId: string = "demo-user"): Promise<string[]> {
    if (inMemorySaved.has(userId)) {
      return Array.from(inMemorySaved.get(userId)!);
    }

    const supabase = getSupabaseClient();

    if (supabase && userId !== "demo-user") {
      try {
        const { data, error } = await supabase
          .from("saved_opportunities")
          .select("opportunity_id")
          .eq("user_id", userId);

        if (data && !error) {
          const list = data.map((d) => d.opportunity_id);
          inMemorySaved.set(userId, new Set(list));
          return list;
        }
      } catch (err) {
        console.warn("Supabase saved fetch failed:", err);
      }
    }

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_SAVED);
        if (saved) {
          const list = JSON.parse(saved);
          inMemorySaved.set(userId, new Set(list));
          return list;
        }
      } catch (e) {
        console.error("Local saved read error:", e);
      }
    }

    const defaultList = ["opp-01", "opp-02", "opp-07", "opp-08"];
    inMemorySaved.set(userId, new Set(defaultList));
    return defaultList;
  },

  async saveOpportunity(opportunityId: string, userId: string = "demo-user"): Promise<void> {
    if (!inMemorySaved.has(userId)) {
      inMemorySaved.set(userId, new Set());
    }
    inMemorySaved.get(userId)!.add(opportunityId);

    const supabase = getSupabaseClient();
    if (supabase && userId !== "demo-user") {
      try {
        await supabase
          .from("saved_opportunities")
          .insert({ user_id: userId, opportunity_id: opportunityId });
      } catch (err) {
        console.warn("Supabase save failed:", err);
      }
    }
  },

  async unsaveOpportunity(opportunityId: string, userId: string = "demo-user"): Promise<void> {
    if (inMemorySaved.has(userId)) {
      inMemorySaved.get(userId)!.delete(opportunityId);
    }

    const supabase = getSupabaseClient();
    if (supabase && userId !== "demo-user") {
      try {
        await supabase
          .from("saved_opportunities")
          .delete()
          .eq("user_id", userId)
          .eq("opportunity_id", opportunityId);
      } catch (err) {
        console.warn("Supabase unsave failed:", err);
      }
    }
  },

  async toggleSave(opportunityId: string, userId: string = "demo-user"): Promise<{ saved: boolean }> {
    const list = await this.getSavedOpportunities(userId);
    if (list.includes(opportunityId)) {
      await this.unsaveOpportunity(opportunityId, userId);
      return { saved: false };
    } else {
      await this.saveOpportunity(opportunityId, userId);
      return { saved: true };
    }
  },
};
