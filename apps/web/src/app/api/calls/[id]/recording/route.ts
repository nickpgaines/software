import { NextResponse } from "next/server";
import { getDb, type Call } from "@/lib/db";
import { fetchTwilioRecording, getVoiceSettings } from "@/lib/voice";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  const id = Number(ctx.params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const db = await getDb();
  const call = (await db
    .prepare("SELECT * FROM calls WHERE id = ?")
    .get(id)) as Call | undefined;
  if (!call || !call.recording_sid) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }
  const settings = await getVoiceSettings();
  const result = await fetchTwilioRecording({
    settings,
    recordingSid: call.recording_sid,
    format: "mp3",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return new NextResponse(result.body, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}
