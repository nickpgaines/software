import { NextResponse } from "next/server";
import { WORKFLOW_TEMPLATES } from "@/lib/lead-workflows";
import { requireCompanyId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireCompanyId();
  return NextResponse.json(WORKFLOW_TEMPLATES);
}
