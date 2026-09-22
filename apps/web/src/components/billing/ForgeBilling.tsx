"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AccountDeletionSection from "@/components/account/AccountDeletionSection";
import { BillingIntervalToggle, PricingCard, pricingActionClass } from "@/components/billing/PricingCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BILLING_PLANS,
  type BillingInterval,
  type BillingPlan,
} from "@/lib/forge-billing/catalog-public";
import { forgeTrialEndLabel } from "@/lib/forge-billing/copy";
import { isNativeApp } from "@/lib/native";
import {
  LOGOUT_FAILURE_MESSAGE,
  logoutForgeSession,
} from "@/lib/native-widget";

type EnabledBillingStatus = {
  enabled: true;
  allowed: boolean;
  reason: "trial" | "paid" | "subscription_required";
  trialEndsAt: string | null;
  plan: BillingPlan | null;
  interval: BillingInterval | null;
  seatLimit: number | null;
  staffCount: number;
  paidThrough: string | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  canManage: boolean;
  native: boolean;
  websiteBillingUrl?: string | null;
};

export type ForgeBillingStatus =
  | { enabled: false }
  | EnabledBillingStatus;

export type ForgeBillingState =
  | { kind: "loading" }
  | { kind: "error"; status: number; message: string }
  | { kind: "ready"; status: ForgeBillingStatus };

export type ForgeBillingPending = "checkout" | "portal" | "refresh" | null;

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class ForgeBillingRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function billingJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new ForgeBillingRequestError(
      data.error || "Billing request failed. Please try again.",
      response.status,
    );
  }
  return data;
}

function isBillingStatus(value: unknown): value is ForgeBillingStatus {
  if (!value || typeof value !== "object") return false;
  const status = value as Partial<ForgeBillingStatus>;
  if (status.enabled === false) return true;
  if (status.enabled !== true) return false;
  const enabled = value as Partial<EnabledBillingStatus>;
  return (
    typeof enabled.allowed === "boolean" &&
    typeof enabled.reason === "string" &&
    (typeof enabled.trialEndsAt === "string" || enabled.trialEndsAt === null) &&
    typeof enabled.staffCount === "number" &&
    typeof enabled.canManage === "boolean" &&
    typeof enabled.native === "boolean"
  );
}

async function statusRequest(
  request: Fetcher,
  input: string,
  init?: RequestInit,
): Promise<ForgeBillingStatus> {
  const status = await billingJson<unknown>(await request(input, init));
  if (!isBillingStatus(status)) {
    throw new ForgeBillingRequestError(
      "Billing returned an invalid response. Please try again.",
      503,
    );
  }
  return status;
}

export function loadForgeBillingStatus(request: Fetcher = fetch) {
  return statusRequest(request, "/api/forge-billing/status", {
    cache: "no-store",
  });
}

export function refreshForgeBillingStatus(request: Fetcher = fetch) {
  return statusRequest(request, "/api/forge-billing/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

async function billingUrl(
  request: Fetcher,
  input: string,
  body?: unknown,
): Promise<string> {
  const data = await billingJson<{ url?: unknown }>(
    await request(input, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  if (typeof data.url !== "string" || !data.url.startsWith("https://")) {
    throw new ForgeBillingRequestError(
      "Billing did not return a secure destination. Please try again.",
      503,
    );
  }
  return data.url;
}

export function createForgeCheckout(
  request: Fetcher,
  plan: BillingPlan,
  interval: BillingInterval,
) {
  return billingUrl(request, "/api/forge-billing/checkout", {
    plan,
    interval,
  });
}

export function createForgePortal(request: Fetcher = fetch) {
  return billingUrl(request, "/api/forge-billing/portal");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDollars(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function planLabel(plan: BillingPlan | null) {
  return plan ? BILLING_PLANS[plan].name : "No subscription";
}

function nonterminalSubscription(status: EnabledBillingStatus) {
  return (
    status.subscriptionStatus !== null &&
    !["canceled", "incomplete_expired"].includes(status.subscriptionStatus)
  );
}

function statusLabel(status: EnabledBillingStatus) {
  if (status.reason === "paid") return "Paid";
  if (status.reason === "trial") return "Free Trial";
  return "Subscription Required";
}

function ErrorState({
  status,
  message,
  onRetry,
}: {
  status: number;
  message: string;
  onRetry(): void;
}) {
  if (status === 401) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your session has expired</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm font-bold text-zinc-400">
            Sign in again to view your company account status.
          </p>
          <Button asChild>
            <a href="/login?next=%2Fbilling">Sign in</a>
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account status is temporarily unavailable</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-bold text-zinc-400">{message}</p>
        <Button variant="outline" type="button" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function ActionError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-300">
      {message}
    </div>
  );
}

function CurrentStatus({
  status,
  showPurchaseExplanation,
}: {
  status: EnabledBillingStatus;
  showPurchaseExplanation: boolean;
}) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-bold text-zinc-500">Current plan</div>
          <Badge variant={status.allowed ? "default" : "destructive"}>
            {statusLabel(status)}
          </Badge>
        </div>
        <CardTitle className="text-2xl leading-tight tabular-nums sm:text-[28px]">
          {planLabel(status.plan)}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm font-bold text-zinc-400 sm:grid-cols-2">
        <div>
          <div className="text-xs font-bold text-zinc-500">Employees</div>
          <div className="mt-1 tabular-nums text-white">
            {status.staffCount}
            {status.seatLimit !== null ? ` of ${status.seatLimit}` : ""}
          </div>
        </div>
        {status.interval && (
          <div>
            <div className="text-xs font-bold text-zinc-500">
              Billing Frequency
            </div>
            <div className="mt-1 text-white">
              {status.interval === "year" ? "Annual" : "Monthly"}
            </div>
          </div>
        )}
        {status.paidThrough && (
          <div>
            <div className="text-xs font-bold text-zinc-500">Paid through</div>
            <div className="mt-1 text-white">
              {formatDate(status.paidThrough)}
            </div>
          </div>
        )}
        {status.cancelAtPeriodEnd && (
          <p className="sm:col-span-2">
            Your cancellation is scheduled. Access continues through the paid
            period shown above.
          </p>
        )}
        {status.reason === "trial" && status.trialEndsAt && (
          <p className="sm:col-span-2">
            Your company’s 14-day trial ends {forgeTrialEndLabel(status.trialEndsAt)}.
            {showPurchaseExplanation && (
              <>
                {" "}Starting a subscription now begins paid billing now; it
                does not defer the first charge until your trial ends.
              </>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function PlanCards({
  status,
  interval,
  pending,
  onCheckout,
}: {
  status: EnabledBillingStatus;
  interval: BillingInterval | null;
  pending: ForgeBillingPending;
  onCheckout(plan: BillingPlan): void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {(Object.keys(BILLING_PLANS) as BillingPlan[]).map((plan) => {
        const details = BILLING_PLANS[plan];
        const incompatible = status.staffCount > details.seats;
        return (
          <PricingCard
            key={plan}
            name={details.name}
            description={`${details.seats} ${details.seats === 1 ? "employee" : "employees"}`}
            highlight={plan === "team"}
            price={formatDollars(interval === "year" ? details.year : details.month)}
            period={interval === "year" ? "/ year" : "/ month"}
            note={interval === "year" ? "Billed annually · 2 months free" : `${formatDollars(details.year)} / year with annual billing`}
          >
            <Button
              type="button"
              className={pricingActionClass(plan === "team")}
              disabled={interval === null || incompatible || pending !== null}
              onClick={() => onCheckout(plan)}
            >
              {incompatible
                ? `${details.name}: Requires ${details.seats} ${details.seats === 1 ? "employee" : "employees"}`
                : pending === "checkout"
                  ? "Opening secure checkout…"
                  : `Subscribe to ${details.name}`}
            </Button>
          </PricingCard>
        );
      })}
    </div>
  );
}

export function ForgeBillingView({
  state,
  interval,
  pending,
  localNative,
  standalone,
  actionError = null,
  onSelectInterval,
  onCheckout,
  onPortal,
  onRefresh,
  onRetry,
}: {
  state: ForgeBillingState;
  interval: BillingInterval | null;
  pending: ForgeBillingPending;
  localNative: boolean;
  standalone: boolean;
  actionError?: string | null;
  onSelectInterval(interval: BillingInterval): void;
  onCheckout(plan: BillingPlan): void;
  onPortal(): void;
  onRefresh(): void;
  onRetry(): void;
}) {
  if (state.kind === "loading") {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-sm font-bold text-zinc-400">
            Checking account status…
          </CardContent>
        </Card>
        <ActionError message={actionError} />
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="space-y-4">
        <ErrorState
          status={state.status}
          message={state.message}
          onRetry={onRetry}
        />
        <ActionError message={actionError} />
      </div>
    );
  }
  if (!state.status.enabled) {
    return (
      <div className="space-y-2 py-12 text-center">
        <h2 className="text-lg font-extrabold tracking-tight text-white">
          Billing
        </h2>
        <p className="text-sm font-bold text-zinc-400">Coming soon.</p>
      </div>
    );
  }

  const status = state.status;
  const native = localNative || status.native;
  const hasSubscription = nonterminalSubscription(status);
  const showPlans = status.canManage && !native && !hasSubscription;
  const trialExpired = status.reason === "subscription_required" && !hasSubscription && status.plan === null && status.trialEndsAt !== null;
  const websiteBillingUrl = native && status.canManage ? status.websiteBillingUrl : null;

  return (
    <div className="space-y-6">
      {standalone && (
        <div>
          <h1 className="text-page-title text-white">{trialExpired ? "Your free trial has ended" : "Company Billing"}</h1>
          <p className="mt-3 text-sm font-bold text-zinc-400">
            {trialExpired
              ? "Your company’s 14-day trial is over. Account support and recovery options remain available below."
              : "View account access and company subscription status."}
          </p>
        </div>
      )}

      {native && (
        <Card>
          <CardHeader>
            <CardTitle className={websiteBillingUrl ? "text-xl leading-tight" : undefined}>
              {websiteBillingUrl
                ? hasSubscription ? "Manage your Forge subscription" : "Keep your business moving with Forge"
                : status.canManage ? "Account status" : "Contact an administrator"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm font-bold text-zinc-400">
            <p>{websiteBillingUrl
              ? hasSubscription
                ? "Manage your company’s plan and payment details on the Forge website."
                : trialExpired
                  ? "Your free trial has ended. Choose a plan on the Forge website to continue managing your jobs, customers, and team."
                  : "Choose a plan on the Forge website to keep managing your jobs, customers, and team."
              : status.canManage
                ? "Contact support for help with your company subscription."
                : "Contact an administrator for help with your company subscription."}</p>
            {websiteBillingUrl && (
              <div className="space-y-3">
                <Button asChild className="w-full sm:w-auto">
                  <a href={websiteBillingUrl} target="_blank" rel="noopener noreferrer">
                    {hasSubscription ? "Manage subscription" : "Choose your plan"}
                  </a>
                </Button>
                <p className="text-xs">Opens in your browser. You may need to sign in again.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <CurrentStatus
        status={status}
        showPurchaseExplanation={!native && status.canManage}
      />

      <ActionError message={actionError} />

      {!native && !status.canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Contact an administrator</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-bold text-zinc-400">
            A company billing administrator can select or manage the company
            subscription. You can refresh this status after they make a change.
          </CardContent>
        </Card>
      )}

      {!native && status.canManage && hasSubscription && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription Management</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              disabled={pending !== null}
              onClick={onPortal}
            >
              {pending === "portal" ? "Opening billing portal…" : "Manage subscription"}
            </Button>
          </CardContent>
        </Card>
      )}

      {showPlans && (
        <section className="space-y-4" aria-labelledby="billing-plans-heading">
          <div>
            <h2
              id="billing-plans-heading"
              className="text-[22px] font-extrabold tracking-tight text-white"
            >
              Choose a Company Plan
            </h2>
            <p className="mt-2 text-sm font-bold text-zinc-400">
              Choose monthly or annual billing before selecting a plan. Checkout
              starts billing immediately and does not unlock access until the
              payment is verified.
            </p>
          </div>
          <BillingIntervalToggle value={interval} onChange={onSelectInterval} disabled={pending !== null} />
          <PlanCards
            status={status}
            interval={interval}
            pending={pending}
            onCheckout={onCheckout}
          />
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {standalone && status.allowed && (
          <Button asChild>
            <a href="/dashboard">Continue to Forge</a>
          </Button>
        )}
        <Button
          variant="outline"
          type="button"
          disabled={pending !== null}
          onClick={onRefresh}
        >
          {pending === "refresh" ? "Refreshing…" : "Refresh payment status"}
        </Button>
        {status.canManage && (
          <Button variant="outline" asChild>
            <a href="/api/forge-billing/export">Download company data</a>
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ForgeBilling({
  standalone = false,
}: {
  standalone?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<ForgeBillingState>({ kind: "loading" });
  const [interval, setInterval] = useState<BillingInterval | null>(null);
  const [pending, setPending] = useState<ForgeBillingPending>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [localNative, setLocalNative] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const pendingRef = useRef<ForgeBillingPending>(null);

  async function loadStatus() {
    setState({ kind: "loading" });
    setActionError(null);
    try {
      setState({ kind: "ready", status: await loadForgeBillingStatus() });
    } catch (error) {
      setState({
        kind: "error",
        status: error instanceof ForgeBillingRequestError ? error.status : 503,
        message:
          error instanceof Error
            ? error.message
            : "Billing is temporarily unavailable.",
      });
    }
  }

  useEffect(() => {
    setLocalNative(isNativeApp());
    void loadStatus();
    // This is intentionally a one-shot canonical status load. User actions use
    // explicit refresh; success query strings never grant access.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runAction(
    action: Exclude<ForgeBillingPending, null>,
    work: () => Promise<void>,
  ) {
    if (pendingRef.current !== null) return;
    pendingRef.current = action;
    setPending(action);
    setActionError(null);
    try {
      await work();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Billing request failed. Please try again.",
      );
    } finally {
      pendingRef.current = null;
      setPending(null);
    }
  }

  function checkout(plan: BillingPlan) {
    if (!interval) return;
    void runAction("checkout", async () => {
      const destination = await createForgeCheckout(fetch, plan, interval);
      window.location.assign(destination);
    });
  }

  function portal() {
    void runAction("portal", async () => {
      const destination = await createForgePortal();
      window.location.assign(destination);
    });
  }

  function refresh() {
    void runAction("refresh", async () => {
      const status = await refreshForgeBillingStatus();
      setState({ kind: "ready", status });
    });
  }

  async function logout() {
    if (logoutPending) return;
    setLogoutPending(true);
    setActionError(null);
    try {
      await logoutForgeSession();
      router.push("/login");
      router.refresh();
    } catch {
      setActionError(LOGOUT_FAILURE_MESSAGE);
      setLogoutPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <ForgeBillingView
        state={state}
        interval={interval}
        pending={pending}
        localNative={localNative}
        standalone={standalone}
        actionError={actionError}
        onSelectInterval={setInterval}
        onCheckout={checkout}
        onPortal={portal}
        onRefresh={refresh}
        onRetry={() => void loadStatus()}
      />

      {standalone && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Recovery</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <a href="/support">Contact support</a>
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={logoutPending}
                onClick={() => void logout()}
              >
                {logoutPending ? "Signing out…" : "Sign out"}
              </Button>
            </CardContent>
          </Card>
          <AccountDeletionSection billingEnabled />
        </div>
      )}
    </div>
  );
}
