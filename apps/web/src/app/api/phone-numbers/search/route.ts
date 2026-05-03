import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/auth";
import { searchAvailableNumbers } from "@/lib/phoneNumbers";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
} as const;

export async function GET(req: Request) {
  await requireCompanyId();
  const url = new URL(req.url);
  const country = url.searchParams.get("country") || "US";
  const areaCode = url.searchParams.get("area_code") || undefined;
  const contains = url.searchParams.get("contains") || undefined;
  const region = url.searchParams.get("region") || undefined;
  const limit = Number(url.searchParams.get("limit")) || 20;

  if (areaCode && !/^\d{3}$/.test(areaCode)) {
    return NextResponse.json(
      { error: "area_code must be 3 digits" },
      { status: 400 }
    );
  }
  if (contains && contains.length > 12) {
    return NextResponse.json(
      { error: "contains must be at most 12 characters" },
      { status: 400 }
    );
  }

  try {
    const numbers = await searchAvailableNumbers({
      country,
      areaCode,
      contains,
      region,
      limit,
    });
    return NextResponse.json(numbers, { headers: NO_CACHE_HEADERS });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Search failed" },
      { status: 502 }
    );
  }
}
