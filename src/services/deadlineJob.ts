import { Opportunity } from "@/types";
import { notificationService } from "./notificationService";
import { getOpportunityStatus } from "./opportunityStatusResolver";

export interface DeadlineJobResult {
  evaluatedCount: number;
  remindersCreated: number;
  idempotentSkips: number;
}

class DeadlineJobService {
  private sentRemindersKeySet: Set<string> = new Set(); // Idempotency key: userId:oppId:daysRemaining:deadline

  /**
   * Generates a deterministic idempotency key for deadline reminders
   */
  private makeIdempotencyKey(
    userId: string,
    oppId: string,
    daysRemaining: number,
    deadline: string
  ): string {
    return `${userId}:${oppId}:${daysRemaining}:${deadline}`;
  }

  /**
   * Evaluates opportunities and dispatches idempotent deadline reminders for saved/matching opportunities.
   * STRICT SAFETY RULE: Never dispatch reminders for expired opportunities.
   */
  async runDeadlineCheck(
    userId: string,
    opportunities: Opportunity[],
    savedOpportunityIds: string[] = [],
    referenceDate: Date = new Date("2026-08-20")
  ): Promise<DeadlineJobResult> {
    let remindersCreated = 0;
    let idempotentSkips = 0;

    for (const opp of opportunities) {
      // 1. Evaluate centralized status
      const statusResult = getOpportunityStatus(opp, referenceDate);
      if (statusResult.isExpired || statusResult.status === "EXPIRED" || statusResult.status === "UNKNOWN") {
        continue;
      }

      // Only process saved opportunities or featured/high-match opportunities
      const isSaved = savedOpportunityIds.includes(opp.id);
      if (!isSaved && !opp.featured) {
        continue;
      }

      const daysRemaining = statusResult.daysRemaining;
      let targetThreshold: (7 | 3 | 1) | null = null;
      if (daysRemaining === 7) targetThreshold = 7;
      else if (daysRemaining === 3) targetThreshold = 3;
      else if (daysRemaining === 1) targetThreshold = 1;

      if (targetThreshold) {
        const key = this.makeIdempotencyKey(userId, opp.id, targetThreshold, opp.deadline);

        if (this.sentRemindersKeySet.has(key)) {
          idempotentSkips++;
          continue;
        }

        const notif = await notificationService.createDeadlineReminder(
          userId,
          opp.title,
          opp.id,
          targetThreshold
        );

        if (notif) {
          this.sentRemindersKeySet.add(key);
          remindersCreated++;
        }
      }
    }

    return {
      evaluatedCount: opportunities.length,
      remindersCreated,
      idempotentSkips,
    };
  }

  clearReminderHistory() {
    this.sentRemindersKeySet.clear();
  }
}

export const deadlineJobService = new DeadlineJobService();
