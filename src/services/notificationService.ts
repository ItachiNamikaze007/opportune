import { getSupabaseClient } from "@/lib/supabase/client";
import { DbNotification, NotificationType, UserNotificationPreferences } from "@/types/database";

const DEFAULT_PREFERENCES: UserNotificationPreferences = {
  newMatches: true,
  deadlineReminders: true,
  eligibilityChanges: true,
  weeklyDigest: true,
};

const LOCAL_STORAGE_PREFS = "student_notification_preferences";
const LOCAL_STORAGE_NOTIFS = "student_inapp_notifications";

class NotificationService {
  private inMemoryNotifications: Map<string, DbNotification[]> = new Map(); // key: userId
  private inMemoryPreferences: Map<string, UserNotificationPreferences> = new Map();

  constructor() {
    this.seedInitialNotifications();
  }

  private seedInitialNotifications() {
    const demoNotifs: DbNotification[] = [
      {
        id: "notif-1",
        user_id: "demo-user",
        title: "🎯 3 New Opportunities Match Your Profile",
        message: "New matches found in Computer Science & AI research including Google and ISRO.",
        type: "new_match",
        is_read: false,
        link: "/dashboard",
        match_count: 3,
        created_at: new Date().toISOString(),
      },
      {
        id: "notif-2",
        user_id: "demo-user",
        title: "⏳ Deadline in 3 Days: Google AI Challenge 2026",
        message: "Your saved opportunity deadline is on 28 Aug 2026. Submit your team architecture proposal.",
        type: "deadline_approaching",
        is_read: false,
        link: "/opportunities/opp-01",
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "notif-3",
        user_id: "demo-user",
        title: "✨ 96% Match: Microsoft Summer Internship",
        message: "New SWE Internship opportunity matched with your 3rd year Computer Science profile.",
        type: "new_match",
        is_read: true,
        link: "/opportunities/opp-07",
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ];
    this.inMemoryNotifications.set("demo-user", demoNotifs);
  }

  /**
   * Get user preferences
   */
  getUserPreferences(userId: string = "demo-user"): UserNotificationPreferences {
    if (this.inMemoryPreferences.has(userId)) {
      return this.inMemoryPreferences.get(userId)!;
    }
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`${LOCAL_STORAGE_PREFS}_${userId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          this.inMemoryPreferences.set(userId, parsed);
          return parsed;
        }
      } catch (e) {
        console.error("Failed to read user notification preferences:", e);
      }
    }
    return DEFAULT_PREFERENCES;
  }

  /**
   * Update user preferences
   */
  updateUserPreferences(
    userId: string = "demo-user",
    prefs: Partial<UserNotificationPreferences>
  ): UserNotificationPreferences {
    const current = this.getUserPreferences(userId);
    const updated = { ...current, ...prefs };
    this.inMemoryPreferences.set(userId, updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(`${LOCAL_STORAGE_PREFS}_${userId}`, JSON.stringify(updated));
    }
    return updated;
  }

  /**
   * Fetches user notifications
   */
  async getNotifications(userId: string = "demo-user"): Promise<DbNotification[]> {
    const supabase = getSupabaseClient();
    if (supabase && userId !== "demo-user") {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (data && !error) {
          return data as DbNotification[];
        }
      } catch (err) {
        console.warn("Supabase notification fetch fallback:", err);
      }
    }

    return this.inMemoryNotifications.get(userId) || this.inMemoryNotifications.get("demo-user") || [];
  }

  /**
   * Add a notification
   */
  async addNotification(notif: Omit<DbNotification, "id" | "created_at">): Promise<DbNotification> {
    const newNotif: DbNotification = {
      ...notif,
      id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
    };

    const current = this.inMemoryNotifications.get(notif.user_id) || [];
    this.inMemoryNotifications.set(notif.user_id, [newNotif, ...current]);

    const supabase = getSupabaseClient();
    if (supabase && notif.user_id !== "demo-user") {
      try {
        await supabase.from("notifications").insert(newNotif);
      } catch (err) {
        console.warn("Supabase notification insert fallback:", err);
      }
    }

    return newNotif;
  }

  /**
   * Anti-Spam Grouped Notification:
   * Instead of sending 10 individual notifications, groups matches by day / run.
   */
  async createGroupedMatchNotification(
    userId: string,
    opportunityTitle: string,
    opportunityId: string,
    score: number
  ): Promise<DbNotification | null> {
    const prefs = this.getUserPreferences(userId);
    if (!prefs.newMatches) return null;

    const userNotifs = this.inMemoryNotifications.get(userId) || [];
    const today = new Date().toISOString().split("T")[0];
    const groupKey = `match-group-${today}`;

    const existingGroup = userNotifs.find(
      (n) => n.group_key === groupKey && n.type === "new_match" && !n.is_read
    );

    if (existingGroup) {
      const newCount = (existingGroup.match_count || 1) + 1;
      existingGroup.match_count = newCount;
      existingGroup.title = `🎯 ${newCount} New Opportunities Match Your Profile`;
      existingGroup.message = `Latest match: "${opportunityTitle}" (${score}% Eligibility Match). Open dashboard to see all new matches.`;
      existingGroup.link = "/dashboard";
      existingGroup.created_at = new Date().toISOString();
      return existingGroup;
    }

    return this.addNotification({
      user_id: userId,
      title: `🎯 New Opportunity Match: ${opportunityTitle}`,
      message: `You match this opportunity with a ${score}% Eligibility Match based on your verified credentials.`,
      type: "new_match",
      is_read: false,
      link: `/opportunities/${opportunityId}`,
      group_key: groupKey,
      match_count: 1,
    });
  }

  /**
   * Bulk Match Notification for profile updates
   */
  async createBulkMatchNotification(
    userId: string,
    matchCount: number,
    firstOpportunityId?: string
  ): Promise<DbNotification | null> {
    const prefs = this.getUserPreferences(userId);
    if (!prefs.newMatches || matchCount <= 0) return null;

    return this.addNotification({
      user_id: userId,
      title: `🎯 ${matchCount} New Opportunities Match Your Updated Profile`,
      message: `Your updated degree, skills, and preferences matched ${matchCount} verified opportunities.`,
      type: "new_match",
      is_read: false,
      link: firstOpportunityId ? `/opportunities/${firstOpportunityId}` : "/dashboard",
      match_count: matchCount,
    });
  }

  /**
   * Deadline Reminders with 7d, 3d, 1d thresholds
   */
  async createDeadlineReminder(
    userId: string,
    opportunityTitle: string,
    opportunityId: string,
    daysRemaining: 7 | 3 | 1
  ): Promise<DbNotification | null> {
    const prefs = this.getUserPreferences(userId);
    if (!prefs.deadlineReminders) return null;

    const urgencyEmojis = {
      7: "⏳",
      3: "⚠️",
      1: "🔥",
    };

    return this.addNotification({
      user_id: userId,
      title: `${urgencyEmojis[daysRemaining]} Deadline in ${daysRemaining} Day${daysRemaining > 1 ? "s" : ""}: ${opportunityTitle}`,
      message: `Applications close soon. Make sure to complete your application before the window closes.`,
      type: "deadline_approaching",
      is_read: false,
      link: `/opportunities/${opportunityId}`,
    });
  }

  /**
   * Eligibility change notification
   */
  async createEligibilityChangeNotification(
    userId: string,
    opportunityTitle: string,
    opportunityId: string,
    notes: string
  ): Promise<DbNotification | null> {
    const prefs = this.getUserPreferences(userId);
    if (!prefs.eligibilityChanges) return null;

    return this.addNotification({
      user_id: userId,
      title: `ℹ️ Eligibility Updated: ${opportunityTitle}`,
      message: notes,
      type: "eligibility_changed",
      is_read: false,
      link: `/opportunities/${opportunityId}`,
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string = "demo-user"): Promise<void> {
    const userNotifs = this.inMemoryNotifications.get(userId) || [];
    const notif = userNotifs.find((n) => n.id === notificationId);
    if (notif) {
      notif.is_read = true;
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
      } catch (e) {
        console.warn("Mark notification read fallback:", e);
      }
    }
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string = "demo-user"): Promise<void> {
    const userNotifs = this.inMemoryNotifications.get(userId) || [];
    userNotifs.forEach((n) => (n.is_read = true));

    const supabase = getSupabaseClient();
    if (supabase && userId !== "demo-user") {
      try {
        await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId);
      } catch (e) {
        console.warn("Mark all notifications read fallback:", e);
      }
    }
  }
}

export const notificationService = new NotificationService();
