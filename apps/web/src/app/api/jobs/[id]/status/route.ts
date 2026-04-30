import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getJobDetail, setStatusStep } from "@/lib/jobs";

export const dynamic = "force-dynamic";

const STEPS = ["en_route", "arrived", "started", "completed"] as const;
type Step = (typeof STEPS)[number];

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const db = await getDb();
  const id = Number(params.id);
  const { step, clear } = (await req.json().catch(() => ({}))) as {
    step?: Step;
    clear?: boolean;
  };
  if (!step || !STEPS.includes(step)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }
  await setStatusStep(db, id, step, !!clear);
  return NextResponse.json(await getJobDetail(db, id));
}
