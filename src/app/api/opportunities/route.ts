import { NextResponse } from "next/server";
import { opportunityRepository } from "@/repositories/opportunityRepository";
import { semanticSearchService } from "@/services/semanticSearchService";
import { toCanonicalCategory } from "@/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get("category") || "all";
    const queryParam = searchParams.get("q") || searchParams.get("query") || "";
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const limitParam = parseInt(searchParams.get("limit") || "20", 10);

    const allActive = await opportunityRepository.getAllActive();
    const itemsWithEligibility = allActive.map((o) => ({
      opportunity: o,
      eligibility: {
        score: 100,
        status: "eligible" as const,
        breakdown: [],
        summaryNotes: ["Eligible"],
      },
    }));

    const filtered = semanticSearchService.filterCatalog(
      itemsWithEligibility,
      queryParam,
      {
        category: categoryParam,
      }
    );

    // Apply exact server-side canonical category filter if categoryParam is specified
    const canonicalCategory = categoryParam !== "all" ? toCanonicalCategory(categoryParam) : "all";
    let categoryFiltered = filtered;

    if (canonicalCategory !== "all") {
      categoryFiltered = filtered.filter(({ opportunity }) => {
        const oppCanonical = toCanonicalCategory(opportunity.primaryCategory || opportunity.category);
        return oppCanonical === canonicalCategory;
      });
    }

    const startIndex = (pageParam - 1) * limitParam;
    const paginatedResults = categoryFiltered.slice(startIndex, startIndex + limitParam);

    return NextResponse.json({
      category: canonicalCategory,
      totalBeforeFilter: allActive.length,
      totalAfterFilter: categoryFiltered.length,
      page: pageParam,
      limit: limitParam,
      hasMore: startIndex + limitParam < categoryFiltered.length,
      results: paginatedResults.map((r) => r.opportunity),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch public opportunities" },
      { status: 500 }
    );
  }
}
