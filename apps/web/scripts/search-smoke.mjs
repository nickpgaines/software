// Smoke test for GET /api/search against the local dev server with the seeded
// local.db. Logs in as the seeded staff user, then asserts endpoint behavior.
// Prereq: `npm run dev` running on localhost:3000. Run: node scripts/search-smoke.mjs
const BASE = process.env.BASE_URL || "http://localhost:3000";
const USER = process.env.SMOKE_USER || "smoke@test.local";
const PASS = process.env.SMOKE_PASS || "test1234";
const NEEDLE = process.env.SMOKE_QUERY || "te";

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("ok:", msg); }
  else { console.error("FAIL:", msg); failures += 1; }
}

async function login() {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("no session cookie returned");
  return cookie.split(";")[0]; // keep only the crm_session pair
}

async function search(cookie, q) {
  return fetch(`${BASE}/api/search?q=${encodeURIComponent(q)}`, { headers: { cookie } });
}

const cookie = await login();

// 1. Unauthenticated → 401
{
  const res = await fetch(`${BASE}/api/search?q=test`);
  assert(res.status === 401, "no session → 401");
}

// 2. Short query → empty groups
{
  const res = await search(cookie, "a");
  const data = await res.json();
  assert(res.status === 200 && Array.isArray(data.groups) && data.groups.length === 0,
    "q < 2 chars → 200 + empty groups");
}

// 3. Valid query → grouped, well-formed, ≤ 5 per group
{
  const res = await search(cookie, NEEDLE);
  const data = await res.json();
  assert(res.status === 200 && Array.isArray(data.groups), "valid query → 200 + groups[]");
  for (const g of data.groups ?? []) {
    assert(["customer", "job", "invoice", "lead"].includes(g.type), `group type valid: ${g.type}`);
    assert(Array.isArray(g.items) && g.items.length <= 5, `group ${g.type} ≤ 5 items`);
    for (const it of g.items) {
      assert(typeof it.title === "string" && typeof it.href === "string" && Number.isFinite(it.id),
        `item well-formed in ${g.type}`);
    }
  }
  console.log("groups:", (data.groups ?? []).map((g) => `${g.type}:${g.items.length}`).join(", ") || "(none)");
}

process.exit(failures ? 1 : 0);
