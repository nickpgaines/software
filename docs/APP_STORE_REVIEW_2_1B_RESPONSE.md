# App Review — Guideline 2.1(b) Information Needed: business model responses

Reply drafted for App Store Connect (Forge, `app.forgecrm`). Facts below are
taken from the shipping code, not from marketing copy:

- Plans and prices: `apps/web/src/components/marketing/PricingSection.tsx`
- Account creation (no payment collected): `apps/web/src/app/api/signup/route.ts`
- In-app billing surface is an empty "Coming soon" panel:
  `apps/web/src/components/SettingsTabs.tsx` (`BillingPanel`)
- Customer payments run on each company's own Stripe Connect account:
  `apps/web/src/lib/stripe.ts`, `apps/web/src/lib/stripe-subscriptions.ts`
- Area code → business phone number provisioning:
  `apps/web/src/app/signup/page.tsx`, `apps/web/src/lib/twilio-platform.ts`,
  `apps/web/src/lib/sms-registration.ts`

---

## Response to Apple

Thank you for the questions. Some context first, because it explains all six
answers: Forge is a business-to-business field-service CRM. Our customers are
home-service companies — window cleaning, pressure washing, and similar trades.
The people who sign in are the business owner and the employees that owner
adds. The app sells no digital content of any kind, contains no in-app
purchases, and has no purchase screen, paywall, price, or "upgrade" path
anywhere in it. Detailed answers follow.

**1. Who are the users that will use the paid subscriptions in the app?**

Employees of the business that holds the Forge account. Forge is sold as a
business SaaS subscription to a company, not to an individual consumer: the
account is created with a company name and an EIN-holding business behind it,
and the owner/admin then adds their staff (technicians, sales reps, office
staff) as users under that company. Employees never purchase anything —
their employer provides their login.

There is a second, unrelated meaning of "subscription" in our product that we
want to be explicit about: our business users can set up recurring *service*
plans for their own residential customers (for example, exterior window
cleaning every quarter at a given address). Those homeowners are not users of
the app. They receive a link by text or email, accept and enter their card on a
web page, and a technician performs the work at their home.

**2. Where can users purchase the subscriptions that can be accessed in the
app?**

On our website, https://www.forgecrm.app, in a web browser. Plans are Solo
($99/month), Team ($229/month), and Business ($379/month), with discounted
annual pricing. The subscription is contracted and paid for there, outside the
app.

It is not possible to buy anything inside the app. The app contains no pricing,
no plan selection, no checkout, and no link out to a purchase page. Settings →
Billing in the app is an empty panel that reads "Coming soon". A business can
create a free trial account in the app, but no payment method is requested and
no payment is taken at any point in that flow; whether an account is active is
set by us server-side.

**3. What specific types of previously purchased subscriptions can a user
access in the app?**

Only the company's own Forge business plan, purchased on the web by that
company. Signing in gives that company's staff access to that company's own
operational records: their customer list, job schedule and calendar, territory
map, estimates and invoices, messaging history, and business reports.

There is no digital content, media, credits, consumables, or downloadable goods
of any kind, and no locked feature that a user can unlock by paying. The plan
tiers differ only in how many employee seats a company may create and which
back-office tools that company's admin can use.

**4. What paid content, subscriptions, or features are unlocked within the app
that do not use In-App Purchase?**

None. No purchase made anywhere unlocks content or features for the person
using the app.

Two payment-related flows do appear in the app, and neither is a purchase by
the app user:

- **The business charging its own customers for physical services.** A
  technician or office user can invoice a homeowner, take a card payment for a
  completed job, or start a recurring service plan. This is payment for
  real-world services performed at the customer's physical address — window
  cleaning, pressure washing — and we understand it to fall under Guideline
  3.1.5(a) (goods and services outside of the app). Each company connects its
  own Stripe account through Stripe Connect and the money settles into that
  company's account; Forge never sells anything to the person paying. The payer
  is the business's residential customer, not an app user: they pay through a
  hosted web payment link we send them, or in person by card at the job site.
- **Texting and calling the business's own customers**, which uses telephone
  numbers we provision for that business (see question 6). It is part of the
  business plan and is not sold separately, in the app or anywhere else.

**5. Are the enterprise services in your app sold to single users, consumers,
or for family use?**

They are sold to businesses only. The contracting party is the company, the
account is created with a company name, and the plans are seat-based: 1 user,
up to 8 users, and up to 30 users. The one-seat "Solo" plan is for a
sole-proprietor service business — still a business account with a company,
business phone number, and business Stripe account behind it. We offer no
consumer plan, no family plan, and no family sharing, and the app has no
consumer use case: without a service business's job, customer, and employee
records, there is nothing to do in it.

**6. How do users obtain a business area code? Do users pay to obtain a
business area code?**

To be clear on terminology: an "area code" here is the ordinary 3-digit North
American telephone area code (for example 801 or 212). It is not a product, it
is not sold, and it cannot be purchased or owned by anyone.

When a business owner creates a Forge account, one of the sign-up fields asks
which area code they want their business phone line to be in, so their
customers see a local number. Forge then provisions a phone number in that area
code through our own Twilio account and attaches it to that company. Accounts
in trial send from a shared Forge number; once a company is on a paid plan and
its A2P 10DLC business registration is approved by the carriers, it is moved to
a dedicated local number in the area code it requested.

Users do not pay to obtain an area code, and no payment of any kind is taken in
the app for it. The phone number is included in the business plan the company
already pays for on our website.

---

We would be glad to provide a demo account with sample data if that would help
the review. Please let us know if any of the above needs more detail.
