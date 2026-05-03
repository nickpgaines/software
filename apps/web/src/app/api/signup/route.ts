import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import {
  getPlatformConfig,
  isPlatformSmsEnabled,
  provisionTwilioForCompany,
} from "@/lib/twilio-platform";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;
const AREA_CODE_RE = /^\d{3}$/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<{
    companyName: string;
    name: string;
    email: string;
    password: string;
    areaCode: string;
  }>;

  const companyName = (body.companyName || "").trim();
  const fullName = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const areaCode = (body.areaCode || "").trim();

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
  if (!AREA_CODE_RE.test(areaCode)) {
    return NextResponse.json(
      { error: "Enter a 3-digit area code for your business phone number." },
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
    // messaging / email / AI / Meta integration / payroll records.
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
    await tx
      .prepare("INSERT INTO payroll_settings (company_id) VALUES (?)")
      .run(newCompanyId);

    // Seed the default email automations (welcome + 4 seasonal blasts) so the
    // /email/automations page isn't empty for new tenants. Mirrors the legacy
    // tenant's seed in init().
    const automationSeeds: Array<
      [
        string,
        "welcome" | "seasonal",
        string | null,
        string,
        string,
        string,
        string,
        number | null,
        number | null
      ]
    > = [
      [
        "welcome",
        "welcome",
        null,
        "Welcome email",
        "Sent automatically the first time a customer with an email is added.",
        "Welcome — thanks for choosing us",
        "<p>Hi there,</p><p>Thanks for choosing us. We're glad to have you, and we'll be in touch soon to confirm your service.</p><p>If you have any questions, just reply to this email.</p>",
        null,
        null,
      ],
      [
        "spring_blast",
        "seasonal",
        "spring",
        "Spring blast",
        "Goes out once each spring — a seasonal reminder, service kickoff, or discount.",
        "Spring is here — book your seasonal service",
        "<p>Spring is here!</p><p>Now's the perfect time to schedule your seasonal service. Reply to this email or give us a call to get on the schedule.</p>",
        3,
        21,
      ],
      [
        "summer_blast",
        "seasonal",
        "summer",
        "Summer blast",
        "Goes out once each summer.",
        "Summer special — book now",
        "<p>Summer's in full swing.</p><p>We're running a seasonal special this month — reach out to take advantage before it ends.</p>",
        6,
        21,
      ],
      [
        "fall_blast",
        "seasonal",
        "fall",
        "Fall blast",
        "Goes out once each fall.",
        "Fall reminder — get ready for the season",
        "<p>Fall is here.</p><p>Time to wrap up the year's service and get ready for what's next. Reply to schedule.</p>",
        9,
        21,
      ],
      [
        "winter_blast",
        "seasonal",
        "winter",
        "Winter blast",
        "Goes out once each winter.",
        "Winter check-in",
        "<p>Hi,</p><p>Just checking in for the winter season. Let us know if there's anything we can help with.</p>",
        12,
        21,
      ],
    ];
    for (const seed of automationSeeds) {
      await tx
        .prepare(
          `INSERT INTO email_automations
             (company_id, key, kind, season, name, description, audience,
              subject, body_html, send_month, send_day)
           VALUES (?, ?, ?, ?, ?, ?, 'all_customers', ?, ?, ?, ?)`
        )
        .run(newCompanyId, ...seed);
    }

    // Seed the default lead workflows so the workflows page isn't empty.
    const workflowSeeds: Array<[string]> = [
      ["Missed Call Text-Back"],
      ["CRACKED lead follow-up sequence"],
      ["Contact fresh leads"],
    ];
    for (const [name] of workflowSeeds) {
      await tx
        .prepare(
          `INSERT INTO lead_workflows (company_id, name, trigger, max_per_day, enabled, steps)
           VALUES (?, ?, 'lead_created', 3, 0, '[]')`
        )
        .run(newCompanyId, name);
    }

    return newCompanyId;
  });

  // Auto-provision a Twilio subaccount + phone number for this company. Best-
  // effort: a Twilio failure must not block account creation. The user can
  // retry from the Messaging settings page if this fails.
  if (isPlatformSmsEnabled() && getPlatformConfig()) {
    try {
      const result = await provisionTwilioForCompany({
        companyId: companyId as number,
        companyName,
        areaCode,
      });
      if (!result.ok) {
        console.error(
          `[signup] Twilio provision failed for company ${companyId}: ${result.error}`
        );
      }
    } catch (e) {
      console.error(
        `[signup] Twilio provision threw for company ${companyId}:`,
        e
      );
    }
  }

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
