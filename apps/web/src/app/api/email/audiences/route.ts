import { NextResponse } from "next/server";
import { fetchAudience } from "@/lib/email";
import type { EmailAudience } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALL_AUDIENCES: EmailAudience[] = [
  "all_customers",
  "active_subscribers",
  "non_subscribers",
  "prospects",
];

const LABELS: Record<EmailAudience, string> = {
  all_customers: "All customers",
  active_subscribers: "Active subscribers",
  non_subscribers: "Non-subscribers",
  prospects: "Prospects (estimated, not yet booked)",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const audienceParam = url.searchParams.get("audience") as
    | EmailAudience
    | null;

  if (audienceParam) {
    if (!ALL_AUDIENCES.includes(audienceParam)) {
      return NextResponse.json(
        { error: "Unknown audience" },
        { status: 400 }
      );
    }
    const recipients = await fetchAudience(audienceParam);
    return NextResponse.json({
      audience: audienceParam,
      label: LABELS[audienceParam],
      count: recipients.length,
      recipients,
    });
  }

  const counts = await Promise.all(
    ALL_AUDIENCES.map(async (a) => ({
      audience: a,
      label: LABELS[a],
      count: (await fetchAudience(a)).length,
    }))
  );
  return NextResponse.json({ audiences: counts });
}
