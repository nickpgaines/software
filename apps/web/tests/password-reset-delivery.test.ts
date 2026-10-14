import assert from "node:assert/strict";
import test from "node:test";
import { fixture, loadResetRoute } from "./helpers/password-reset-harness.mjs";

const { POST } = await loadResetRoute();
const request = (email = "member@example.invalid") => new Request(
  "https://forge.example/api/auth/password-reset/request",
  { method: "POST", body: JSON.stringify({ email }) }
);

function setup(t: test.TestContext) {
  const db = fixture();
  const previous = { ...process.env };
  Object.assign(process.env, { NODE_ENV: "production" });
  process.env.RESEND_API_KEY = "test-only-key";
  process.env.AUTH_EMAIL_FROM = "Forge CRM <noreply@example.invalid>";
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => logs.push(args));
  t.after(() => { process.env = previous; });
  return { db, logs };
}

for (const missing of ["AUTH_EMAIL_FROM", "RESEND_API_KEY"]) {
  test(`missing ${missing} is logged without leaking the account or token`, async t => {
    const { db, logs } = setup(t);
    delete process.env[missing];
    t.mock.method(globalThis, "fetch", async () => { throw new Error("must not send without configuration"); });
    const response = await POST(request());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.devResetUrl, undefined);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM password_reset_tokens").all()[0]?.n, 1);
    assert.deepEqual(logs, [["[password-reset] Email delivery failed", { code: "platform_email_not_configured" }]]);
    const unknown = await POST(request("absent@example.invalid"));
    assert.deepEqual(await unknown.json(), body);
    assert.equal(logs.length, 1);
  });
}

for (const failure of ["provider", "network"]) {
  test(`${failure} failure is logged without raw provider data or reset links`, async t => {
    const { logs } = setup(t);
    t.mock.method(globalThis, "fetch", async () => {
      const privateMessage = "member@example.invalid test-only-key /reset-password?token=private";
      if (failure === "network") throw new Error(privateMessage);
      return Response.json({ message: privateMessage }, { status: 403 });
    });
    const response = await POST(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).devResetUrl, undefined);
    assert.deepEqual(logs, [["[password-reset] Email delivery failed", { code: "email_send_failed" }]]);
  });
}

test("successful delivery uses the configured sender and leaves the password unchanged", async t => {
  const { db, logs } = setup(t);
  const sent: Array<{ from: string; to: string[]; text: string }> = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "https://api.resend.com/emails");
    sent.push(JSON.parse(init.body as string));
    return Response.json({ id: "test-email-id" });
  });
  const response = await POST(request(" MEMBER@example.invalid "));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).devResetUrl, undefined);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].from, "Forge CRM <noreply@example.invalid>");
  assert.deepEqual(sent[0].to, ["member@example.invalid"]);
  assert.match(sent[0].text, /\/reset-password\?token=[a-f0-9]{64}/);
  assert.deepEqual(logs, []);
  assert.equal(db.prepare("SELECT password_hash FROM staff WHERE id = 1").all()[0]?.password_hash, "existing-password-hash");
});
