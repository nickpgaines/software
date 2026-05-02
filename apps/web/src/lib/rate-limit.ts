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
