import { StudentProfile, OpportunityCategory } from "@/types";
import { defaultStudentProfile } from "@/data/mockStudent";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { DbStudentProfile } from "@/types/database";

const LOCAL_STORAGE_KEY = "student_opportunity_profile";

/**
 * Maps database student_profiles row to the frontend StudentProfile model
 */
function mapDbToStudentProfile(
  dbProfile: DbStudentProfile,
  skills: string[] = [],
  interests: OpportunityCategory[] = []
): StudentProfile {
  return {
    name: dbProfile.full_name,
    email: dbProfile.email,
    phone: dbProfile.phone || undefined,
    avatarUrl: dbProfile.avatar_url || undefined,
    degree: dbProfile.degree,
    institution: dbProfile.institution,
    branch: dbProfile.branch,
    currentYear: dbProfile.study_year,
    graduationYear: dbProfile.graduation_year,
    cgpa: Number(dbProfile.cgpa),
    age: dbProfile.age || 20,
    country: dbProfile.country,
    state: dbProfile.state,
    city: dbProfile.city,
    gender: (dbProfile.gender as any) || "all",
    categoryQuota: dbProfile.category_quota || "General",
    skills: skills.length > 0 ? skills : defaultStudentProfile.skills,
    interests: interests.length > 0 ? interests : defaultStudentProfile.interests,
    completedOnboarding: dbProfile.completed_onboarding,
  };
}

export const studentService = {
  /**
   * Fetches student profile from Supabase or localStorage fallback
   */
  async getStudentProfile(userId?: string): Promise<StudentProfile> {
    const supabase = getSupabaseClient();

    if (supabase && userId) {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from("student_profiles")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (profileData && !profileError) {
          // Fetch skills and interests
          const [skillsRes, interestsRes] = await Promise.all([
            supabase
              .from("student_skills")
              .select("skill_name")
              .eq("student_id", profileData.id),
            supabase
              .from("student_interests")
              .select("category")
              .eq("student_id", profileData.id),
          ]);

          const skills = (skillsRes.data || []).map((s) => s.skill_name);
          const interests = (interestsRes.data || []).map((i) => i.category as OpportunityCategory);

          return mapDbToStudentProfile(profileData, skills, interests);
        }
      } catch (err) {
        console.warn("Supabase fetch failed, using local profile fallback:", err);
      }
    }

    // LocalStorage Fallback
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        console.error("Failed to read local profile:", e);
      }
    }

    return defaultStudentProfile;
  },

  /**
   * Updates student profile in Supabase and/or localStorage
   */
  async updateStudentProfile(
    updates: Partial<StudentProfile>,
    userId?: string
  ): Promise<StudentProfile> {
    const supabase = getSupabaseClient();

    // Local Storage update first for instant responsiveness
    let currentProfile = defaultStudentProfile;
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          currentProfile = JSON.parse(saved);
        }
      } catch (e) {
        console.error("Local profile read error:", e);
      }
    }

    const updatedProfile: StudentProfile = {
      ...currentProfile,
      ...updates,
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedProfile));
    }

    // If Supabase is connected and user is authenticated, sync to PostgreSQL
    if (supabase && userId) {
      try {
        const { data: profileRow } = await supabase
          .from("student_profiles")
          .upsert({
            user_id: userId,
            full_name: updatedProfile.name,
            email: updatedProfile.email,
            phone: updatedProfile.phone || null,
            avatar_url: updatedProfile.avatarUrl || null,
            degree: updatedProfile.degree,
            institution: updatedProfile.institution,
            branch: updatedProfile.branch,
            study_year: updatedProfile.currentYear,
            graduation_year: updatedProfile.graduationYear,
            cgpa: updatedProfile.cgpa,
            age: updatedProfile.age,
            country: updatedProfile.country,
            state: updatedProfile.state,
            city: updatedProfile.city,
            gender: updatedProfile.gender,
            category_quota: updatedProfile.categoryQuota || "General",
            completed_onboarding: updatedProfile.completedOnboarding,
          })
          .select()
          .single();

        if (profileRow && updates.skills) {
          // Sync skills
          await supabase.from("student_skills").delete().eq("student_id", profileRow.id);
          const skillInserts = updates.skills.map((s) => ({
            student_id: profileRow.id,
            skill_name: s,
          }));
          if (skillInserts.length > 0) {
            await supabase.from("student_skills").insert(skillInserts);
          }
        }

        if (profileRow && updates.interests) {
          // Sync interests
          await supabase.from("student_interests").delete().eq("student_id", profileRow.id);
          const interestInserts = updates.interests.map((i) => ({
            student_id: profileRow.id,
            category: i,
          }));
          if (interestInserts.length > 0) {
            await supabase.from("student_interests").insert(interestInserts);
          }
        }
      } catch (err) {
        console.warn("Supabase profile sync failed (local state preserved):", err);
      }
    }

    return updatedProfile;
  },
};
