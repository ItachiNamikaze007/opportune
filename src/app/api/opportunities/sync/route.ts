import { NextRequest, NextResponse } from "next/server";
import { opportunitySyncService } from "@/services/opportunitySyncService";

/**
 * POST /api/opportunities/sync
 * Endpoint triggered by Vercel Cron (schedule: "0 2 * * *") or authenticated admin trigger.
 * Vercel automatically sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is configured.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("x-cron-secret") || req.headers.get("x-sync-secret");
    const cronSecret = process.env.CRON_SECRET || process.env.OPPORTUNITY_SYNC_SECRET;

    // Strict Authorization check if secret is configured in environment
    if (cronSecret) {
      const isBearerMatch = authHeader === `Bearer ${cronSecret}`;
      const isDirectMatch = authHeader === cronSecret;

      if (!isBearerMatch && !isDirectMatch) {
        return NextResponse.json(
          {
            success: false,
            error: "Unauthorized: Invalid or missing CRON_SECRET authorization token.",
          },
          { status: 401 }
        );
      }
    } else if (process.env.NODE_ENV === "production") {
      // In production, CRON_SECRET MUST be set to prevent open endpoints
      console.warn("[API Sync Security] Warning: CRON_SECRET is not configured in production environment.");
    }

    let payloadOptions: { skipDiscovery?: boolean; forceRevalidate?: boolean } = {};
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        payloadOptions = await req.json();
      }
    } catch {
      // Body is optional (e.g. empty GET/POST from standard cron)
    }

    const report = await opportunitySyncService.syncOpportunities(payloadOptions);

    return NextResponse.json(
      {
        success: report.status !== "failed",
        message: "Opportunity discovery and revalidation sync completed.",
        report,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[API Sync Error]", error);
    const isConflict = error.message?.includes("already in progress");
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to execute opportunity synchronization pipeline.",
      },
      { status: isConflict ? 409 : 500 }
    );
  }
}

/**
 * GET /api/opportunities/sync
 * Status inspection endpoint for Admin dashboard and liveness monitoring.
 */
export async function GET() {
  const lastReport = opportunitySyncService.getLastReport();
  const lastSuccessfulSync = opportunitySyncService.getLastSuccessfulSync();
  return NextResponse.json(
    {
      status: "idle",
      lastReport,
      lastSuccessfulSync,
    },
    { status: 200 }
  );
}
