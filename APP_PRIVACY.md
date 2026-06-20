# App Privacy — App Store Connect "nutrition labels"

Draft answers for App Store Connect → App Privacy, derived from a codebase
audit (see CAPACITOR_PLAN.md, Phase 5). Paste these once the Apple Developer
account exists. **Nothing here requires the Team ID** — it's all factual
disclosure of what the shipped app does.

Forge is a **B2B CRM**: the people who log in are company *staff*; most of the
personal data is about the company's *customers/leads*, entered by staff.
Apple still requires you to disclose customer data the app transmits off the
device — it counts as "collected" because it goes to our backend (Turso/libSQL)
and to service providers (Stripe, Twilio, Resend, Anthropic, Mapbox, Meta).

---

## 1. Tracking — **No**

> "Does this app collect data in order to track users?" → **No.**

No analytics, no crash/telemetry SDK, no advertising SDK, no device/advertising
identifiers, no data brokers, no cross-app/cross-site tracking. Confirmed absent:
Google Analytics, Firebase/Crashlytics, Sentry, Amplitude, Mixpanel, Segment,
IDFA/GAID. The third parties below are **service providers** acting on our behalf
for app functionality, not advertising partners — so this is "data shared with
third parties for app functionality," not "tracking."

---

## 2. Data collected

For every type below: **Linked to identity = Yes** (all data ties to a staff
account and/or a customer record) and **Used for tracking = No**. Default
purpose is **App Functionality** unless noted.

| Apple category | Data type | Collected | Notes / source |
|---|---|---|---|
| Contact Info | Name | Yes | Staff + customers/leads (`staff`, `customers`, `leads`, `map_pins`) |
| Contact Info | Email Address | Yes | Staff login + customer/lead email; email blasts via Resend |
| Contact Info | Phone Number | Yes | Customer/lead phone; SMS/voice via Twilio |
| Contact Info | Physical Address | Yes | Customer street address + geocoded `formatted_address` |
| Location | Precise Location | Yes | "Locate me" map control (`@capacitor/geolocation`, high accuracy) + customer lat/lng (`customers`, `map_pins`). Used to center the map and place door-knock pins — **not** for tracking. |
| Financial Info | Payment Info | Yes | Card brand + last-4 + expiry + wallet type via Stripe (`stripe_payment_methods`); payment amounts, invoices, subscription billing. **Full card numbers are never stored** — Stripe holds them. |
| User Content | Photos or Videos | Yes | Job-site photos (`@capacitor/camera`) stored as attachments (`job_attachments`) |
| User Content | Other User Content | Yes | SMS message bodies, email content, job/customer notes, e-signatures on estimates/subscriptions |
| Identifiers | User ID | Yes | Staff ID + customer/lead IDs in the HMAC session cookie and records |
| Usage Data | Product Interaction | Yes* | Internal activity/audit feed records staff actions (job completed, payment recorded, etc.) server-side for the in-app history. Purpose: App Functionality. *Borderline — see flags. |

### Not collected (declare "No" / leave unchecked)
- **Contacts** (device address book) — the app never reads the OS Contacts;
  the customer list is typed in by staff, not imported from the address book.
- **Device ID / Advertising identifiers** — none.
- **Audio Data** — only relevant if voice calling ships; see flags below.
- Health & Fitness, Sensitive Info, Browsing History, Search History,
  Purchases (no IAP), Crash Data, Performance Data — none.

---

## 3. Third parties that receive data (service providers)

Declare these as data shared for **App Functionality**. None are advertising
partners.

| Service | Purpose | Data sent |
|---|---|---|
| **Stripe** | Payments | Customer name/email/phone/address, payment amounts, payment-method tokens |
| **Twilio** | SMS (and voice, if enabled) | Message bodies, to/from phone numbers; A2P business registration (legal name, EIN, address, rep contact); call audio if recording is on |
| **Resend** | Transactional + bulk email | Recipient email + name, full email content |
| **Anthropic (Claude)** | AI SMS draft assistant | Customer display name, last ~12 messages of the SMS thread, company name/address/phone, custom "company voice". **No** payment data; phone numbers are not included in the prompt. |
| **Mapbox** | Map rendering | Map viewport coordinates; uses the public token. No reverse geocoding. |
| **Meta (Facebook)** | Lead-form import (inbound) | Receives lead name/email/phone/address from connected Lead Ad forms |

---

## 4. Flags to resolve before submitting

1. **Voice calling scope.** The data model supports call recordings
   (`calls.recording_url`, `messaging_settings.voice_record_calls`), but Twilio
   voice-in-app was **deferred to Phase 5** and may not ship in v1. If voice
   does **not** ship → leave **Audio Data** unchecked. If it does → add
   **User Content → Audio Data** (App Functionality, linked, no tracking) and
   add `NSMicrophoneUsageDescription` to Info.plist.
2. **Product Interaction (activity feed).** It's an in-app audit trail, not
   analytics, and stays on our own backend. Disclosing it is the conservative,
   honest choice; it's defensible to omit since it's pure app functionality with
   no third party. Recommend: **keep it checked** to avoid under-disclosure.
3. **Data about non-users.** Most PII is the company's customers, not the app
   user. Apple still requires disclosure (done above). Ensure `/privacy` and
   `/data-deletion` describe customer data handling — they're already linked
   from the app and can be the Privacy Policy URL in ASC.
4. **Security (not a label item, but surfaced by the audit):** some
   third-party credentials are stored plaintext at rest (`meta_integration.
   access_token`, `company.twilio_subaccount_auth_token`). Out of scope for the
   labels, but worth hardening before a security review — flagged separately.

---

## 5. Where this goes in App Store Connect

App Store Connect → your app → **App Privacy** → "Get Started". For each data
type checked above: choose **App Functionality** as the purpose, mark
**Linked to the user**, and **Not used for tracking**. Set the **Privacy Policy
URL** to `https://www.forgecrm.app/privacy`.
