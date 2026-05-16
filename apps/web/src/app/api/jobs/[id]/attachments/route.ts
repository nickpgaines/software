import { NextResponse } from "next/server";
import { getDb, type JobAttachment, type JobAttachmentKind } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

const KINDS: JobAttachmentKind[] = ["image", "file", "audio"];
const MAX_BYTES = 5 * 1024 * 1024;

function isDataUrl(s: string): boolean {
  return /^data:[^;,]+(?:;[^,]+)?,/.test(s);
}

function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return dataUrl.length;
  const payload = dataUrl.slice(comma + 1);
  return Math.floor((payload.length * 3) / 4);
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const jobId = Number(params.id);
  const job = await db
    .prepare("SELECT id FROM jobs WHERE id = ? AND company_id = ?")
    .get(jobId, ctx.companyId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const rows = (await db
    .prepare(
      `SELECT id, job_id, kind, filename, mime_type, size_bytes, content,
              created_by, created_at
         FROM job_attachments
        WHERE job_id = ?
        ORDER BY created_at ASC, id ASC`
    )
    .all(jobId)) as JobAttachment[];
  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const jobId = Number(params.id);
  const job = await db
    .prepare("SELECT id FROM jobs WHERE id = ? AND company_id = ?")
    .get(jobId, ctx.companyId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<{
    kind: string;
    filename: string;
    mime_type: string;
    content: string;
  }>;

  const kind = body.kind as JobAttachmentKind | undefined;
  if (!kind || !KINDS.includes(kind)) {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  }
  const filename = body.filename?.toString().trim();
  const mimeType = body.mime_type?.toString().trim();
  const content = body.content?.toString() ?? "";
  if (!filename || !mimeType || !content) {
    return NextResponse.json(
      { error: "filename, mime_type, and content are required" },
      { status: 400 }
    );
  }
  if (!isDataUrl(content)) {
    return NextResponse.json(
      { error: "content must be a data: URL" },
      { status: 400 }
    );
  }
  const size = estimateDataUrlBytes(content);
  if (size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file exceeds ${MAX_BYTES} bytes` },
      { status: 413 }
    );
  }

  const result = await db
    .prepare(
      `INSERT INTO job_attachments
         (job_id, kind, filename, mime_type, size_bytes, content, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(jobId, kind, filename, mimeType, size, content, ctx.identity);
  const row = (await db
    .prepare(
      `SELECT id, job_id, kind, filename, mime_type, size_bytes, content,
              created_by, created_at
         FROM job_attachments WHERE id = ?`
    )
    .get(result.lastInsertRowid)) as JobAttachment;
  return NextResponse.json(row, { status: 201 });
}
