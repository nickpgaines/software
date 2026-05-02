import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<{
    companyName: string;
    name: string;
    email: string;
    password: string;
  }>;

  const companyName = (body.companyName || "").trim();
  const fullName = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!companyName) {
    return NextResponse.json(
      { error: "Company name is required." },
      { status: 400 }
    );
  }
  if (!fullName) {
    return NextResponse.json(
      { error: "Your name is required." },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }
  if (password.length < MIN_PASSWORD_LEN) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` },
      { status: 400 }
    );
  }

  const db = await getDb();

  const existing = await db
    .prepare("SELECT id FROM staff WHERE LOWER(email) = ? LIMIT 1")
    .get<{ id: number }>(email);
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }

  const [first, ...rest] = fullName.split(/\s+/);
  const firstName = first || fullName;
  const lastName = rest.join(" ");
  const passwordHash = hashPassword(password);

  const companyId = await db.transaction(async (tx) => {
    const insertCompany = await tx
      .prepare("INSERT INTO company (name) VALUES (?)")
      .run(companyName);
    const newCompanyId = insertCompany.lastInsertRowid;

    await tx
      .prepare(
        `INSERT INTO staff
           (company_id, name, first_name, last_name, email, password_hash, permission_level)
         VALUES (?, ?, ?, ?, ?, ?, 'admin')`
      )
      .run(
        newCompanyId,
        fullName,
        firstName,
        lastName || null,
        email,
        passwordHash
      );

    // Seed empty per-tenant settings rows so this company has its own
    // messaging / email / AI / Meta integration records once query
    // scoping lands.
    await tx
      .prepare("INSERT INTO messaging_settings (company_id) VALUES (?)")
      .run(newCompanyId);
    await tx
      .prepare("INSERT INTO email_settings (company_id) VALUES (?)")
      .run(newCompanyId);
    await tx
      .prepare("INSERT INTO ai_settings (company_id) VALUES (?)")
      .run(newCompanyId);
    await tx
      .prepare("INSERT INTO meta_integration (company_id) VALUES (?)")
      .run(newCompanyId);

    return newCompanyId;
  });

  const token = createSessionToken(email);
  const res = NextResponse.json({ ok: true, companyId });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
