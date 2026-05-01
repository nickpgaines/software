import { NextResponse } from "next/server";
import { getDb, type EmailBlast, type EmailRecipient } from "@/lib/db";

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
  const blast = (await db
    .prepare("SELECT * FROM email_blasts WHERE id = ?")
    .get(id)) as EmailBlast | undefined;
  if (!blast) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const recipients = (await db
    .prepare(
      `SELECT * FROM email_recipients
        WHERE blast_id = ?
        ORDER BY status DESC, id ASC`
    )
    .all(id)) as EmailRecipient[];
  return NextResponse.json({ blast, recipients });
}
