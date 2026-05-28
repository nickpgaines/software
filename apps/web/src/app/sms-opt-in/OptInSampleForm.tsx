"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OptInSampleForm({
  consentText,
}: {
  consentText: string;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setErr("Please enter your name and phone number.");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="text-center">
        <div className="mb-2 text-2xl text-emerald-500">✓</div>
        <h2 className="text-xl font-extrabold tracking-tight text-white">
          Sample submitted
        </h2>
        <p className="mt-3 text-sm font-bold text-zinc-400">
          Thanks, {firstName.trim()}. This is a demonstration page — no
          information was stored and no messages will be sent.
          {consent
            ? " You checked the SMS consent box."
            : " You did not check the SMS consent box, and the form still submitted — consent is never required."}
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setFirstName("");
            setLastName("");
            setPhone("");
            setEmail("");
            setConsent(false);
            setSubmitted(false);
          }}
          className="mt-5 h-auto rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          Reset sample
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="first-name" className="text-sm font-bold text-white">
            First name
          </Label>
          <Input
            id="first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            autoComplete="given-name"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="last-name" className="text-sm font-bold text-white">
            Last name
          </Label>
          <Input
            id="last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            autoComplete="family-name"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="phone" className="text-sm font-bold text-white">
            Phone number
          </Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
            autoComplete="tel"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="email" className="text-sm font-bold text-white">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="sms-consent"
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="sms-consent"
            className="cursor-pointer text-xs font-bold leading-relaxed text-zinc-300"
          >
            {consentText}
          </Label>
        </div>
      </div>

      <p className="mt-3 text-xs font-bold text-zinc-500">
        Checking this box is optional. You can submit this form without it,
        and consent is never a condition of purchase.
      </p>

      {err && <p className="mt-4 text-sm font-bold text-rose-400">{err}</p>}

      <Button
        type="submit"
        variant="ghost"
        className="mt-5 h-auto w-full rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
      >
        Continue
      </Button>
    </form>
  );
}
