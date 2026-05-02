import { getDb } from "@/lib/db";

const WINDOW_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 10;

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export type LoginRateCheck =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

// Sliding window: count failed attempts from this IP in the last N minutes.
// Successful logins are recorded too but don't count toward the limit.
export async function checkLoginRate(ip: string): Promise<LoginRateCheck> {
  const db = await getDb();
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS n
         FROM login_attempts
        WHERE ip = ?
          AND success = 0
          AND attempted_at >= datetime('now', ?)`
    )
    .get(ip, `-${WINDOW_MINUTES} minutes`)) as { n: number } | undefined;
  const n = Number(row?.n ?? 0);
  if (n < MAX_FAILED_ATTEMPTS) return { allowed: true };
  return { allowed: false, retryAfterSeconds: WINDOW_MINUTES * 60 };
}

export async function recordLoginAttempt(
  ip: string,
  success: boolean
): Promise<void> {
  const db = await getDb();
  try {
    await db
      .prepare(
        "INSERT INTO login_attempts (ip, success) VALUES (?, ?)"
      )
      .run(ip, success ? 1 : 0);
  } catch {
    // Logging the attempt is best-effort; never block login over it.
  }
  // Best-effort cleanup: prune rows older than the window so the table
  // doesn't grow unbounded. Only fires occasionally to avoid contention.
  if (Math.random() < 0.05) {
    try {
      await db
        .prepare(
          `DELETE FROM login_attempts
            WHERE attempted_at < datetime('now', ?)`
        )
        .run(`-${WINDOW_MINUTES * 4} minutes`);
    } catch {
      // ignore
    }
  }
}

// Password-reset rate limits. Two windows enforced together:
//  - Per IP: 10 requests / hour. Stops generic abuse.
//  - Per email: 5 requests / hour. Stops a single victim's inbox from being
//    flooded by an attacker who's discovered their address.
const RESET_WINDOW_MINUTES = 60;
const RESET_MAX_PER_IP = 10;
const RESET_MAX_PER_EMAIL = 5;

export type ResetRateCheck =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export async function checkPasswordResetRate(
  ip: string,
  email: string | null
): Promise<ResetRateCheck> {
  const db = await getDb();
  const ipRow = (await db
    .prepare(
      `SELECT COUNT(*) AS n
         FROM password_reset_attempts
        WHERE ip = ?
          AND attempted_at >= datetime('now', ?)`
    )
    .get(ip, `-${RESET_WINDOW_MINUTES} minutes`)) as { n: number } | undefined;
  if (Number(ipRow?.n ?? 0) >= RESET_MAX_PER_IP) {
    return { allowed: false, retryAfterSeconds: RESET_WINDOW_MINUTES * 60 };
  }
  if (email) {
    const emailRow = (await db
      .prepare(
        `SELECT COUNT(*) AS n
           FROM password_reset_attempts
          WHERE email = ?
            AND attempted_at >= datetime('now', ?)`
      )
      .get(email, `-${RESET_WINDOW_MINUTES} minutes`)) as
      | { n: number }
      | undefined;
    if (Number(emailRow?.n ?? 0) >= RESET_MAX_PER_EMAIL) {
      return { allowed: false, retryAfterSeconds: RESET_WINDOW_MINUTES * 60 };
    }
  }
  return { allowed: true };
}

export async function recordPasswordResetAttempt(
  ip: string,
  email: string | null
): Promise<void> {
  const db = await getDb();
  try {
    await db
      .prepare(
        "INSERT INTO password_reset_attempts (ip, email) VALUES (?, ?)"
      )
      .run(ip, email);
  } catch {
    // best-effort; never block the request
  }
  if (Math.random() < 0.05) {
    try {
      await db
        .prepare(
          `DELETE FROM password_reset_attempts
            WHERE attempted_at < datetime('now', ?)`
        )
        .run(`-${RESET_WINDOW_MINUTES * 4} minutes`);
    } catch {
      // ignore
    }
  }
}
