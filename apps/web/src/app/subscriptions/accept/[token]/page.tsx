import { notFound } from "next/navigation";
import { getDb, type CustomerSubscription } from "@/lib/db";
import AcceptClient from "./AcceptClient";

export const dynamic = "force-dynamic";

const VISITS_PER_YEAR: Record<string, number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  triannually: 3,
  semiannually: 2,
  yearly: 1,
};

const INTERVAL_LABEL: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  triannually: "Tri-annually",
  semiannually: "Bi-annually",
  yearly: "Yearly",
};

const INTERVAL_PERIOD: Record<string, string> = {
  weekly: "week",
  biweekly: "2 weeks",
  monthly: "month",
  quarterly: "quarter",
  triannually: "4 months",
  semiannually: "6 months",
  yearly: "year",
};

export default async function AcceptSubscriptionPage({
  params,
}: {
  params: { token: string };
}) {
  const db = await getDb();
  const sub = (await db
    .prepare(
      "SELECT * FROM customer_subscriptions WHERE accept_token = ? LIMIT 1"
    )
    .get(params.token)) as CustomerSubscription | undefined;
  if (!sub) notFound();

  const customer = (await db
    .prepare(
      "SELECT id, name, formatted_address, address FROM customers WHERE id = ? AND company_id = ?"
    )
    .get(sub.customer_id, sub.company_id)) as
    | {
        id: number;
        name: string;
        formatted_address: string | null;
        address: string | null;
      }
    | undefined;

  const company = (await db
    .prepare("SELECT name FROM company WHERE id = ?")
    .get(sub.company_id)) as { name: string } | undefined;

  const visitsPerYear = VISITS_PER_YEAR[sub.service_interval] ?? 12;
  const monthlyEquivalentCents =
    sub.price_cents > 0
      ? Math.round((sub.price_cents * visitsPerYear) / 12)
      : 0;

  return (
    <AcceptClient
      subscription={sub}
      customerName={customer?.name || "Customer"}
      serviceAddress={
        customer?.formatted_address || customer?.address || null
      }
      companyName={company?.name || "Your service provider"}
      visitsPerYear={visitsPerYear}
      monthlyEquivalentCents={monthlyEquivalentCents}
      intervalLabel={INTERVAL_LABEL[sub.service_interval] || "Monthly"}
      servicePeriod={INTERVAL_PERIOD[sub.service_interval] || "month"}
      billingPeriod={INTERVAL_PERIOD[sub.interval] || "month"}
    />
  );
}
