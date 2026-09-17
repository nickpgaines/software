"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AccountDeletionPreview = {
  scope: "employee" | "organization";
  companyName: string;
  employeeCount: number;
  adminCount: number;
  blockedReason: "last_admin" | null;
};

type StaffChoice = { id: number; name: string };

type AdministratorRecovery = {
  administrators: StaffChoice[];
  eligibleStaff: StaffChoice[];
};

export function accountDeletionScopeMessage(preview: AccountDeletionPreview) {
  if (preview.scope === "organization") {
    return `You are the last employee at ${preview.companyName}. This permanently deletes the organization, its employees, customers, jobs, messages, invoices, settings, and other CRM data. If the organization has a Forge company subscription, deletion cancels it before data is removed. This action does not promise a refund or proration.`;
  }
  return `Other employees will remain at ${preview.companyName}. This deletes only your login, profile, and personal connections; organization records remain available to your team.`;
}

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

class DeletionRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new DeletionRequestError(data.error || fallback, response.status);
  }
  return data;
}

export async function promoteDeletionAdministrator(
  staffId: number,
  request: Fetcher = fetch,
) {
  return responseJson<{ ok: true; administrator: StaffChoice }>(
    await request("/api/forge-billing/administrators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId }),
    }),
    "Could not promote that employee.",
  );
}

async function loadDeletionPreview(request: Fetcher): Promise<AccountDeletionPreview> {
  return responseJson<AccountDeletionPreview>(
    await request("/api/account/deletion", { cache: "no-store" }),
    "Could not load deletion details.",
  );
}

async function loadAdministratorRecovery(
  request: Fetcher,
): Promise<AdministratorRecovery> {
  return responseJson<AdministratorRecovery>(
    await request("/api/forge-billing/administrators", { cache: "no-store" }),
    "Could not load eligible employees.",
  );
}

export function AccountDeletionRecovery({
  companyName,
  eligibleStaff,
  pendingStaffId,
  error,
  onPromote,
  onRetry,
}: {
  companyName: string;
  eligibleStaff: StaffChoice[];
  pendingStaffId: number | null;
  error: string | null;
  onPromote(staffId: number): void;
  onRetry(): void;
}) {
  return (
    <div className="space-y-3 text-sm font-bold text-zinc-300">
      <p>
        You are the only administrator for {companyName}. Promote another
        existing employee before deleting your account.
      </p>
      {error && (
        <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300">
          <p>{error}</p>
          <Button variant="outline" type="button" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
      {!error && eligibleStaff.length === 0 && (
        <p className="rounded-xl border border-line bg-black p-3 text-zinc-400">
          There is no existing employee eligible for promotion. Contact support,
          or return after company access is restored; staff cannot be added from
          this locked screen.
        </p>
      )}
      {!error && eligibleStaff.length > 0 && (
        <div className="space-y-2">
          {eligibleStaff.map((staff) => (
            <div
              key={staff.id}
              className="flex flex-col gap-3 rounded-xl border border-line bg-black p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>{staff.name}</span>
              <Button
                variant="outline"
                type="button"
                disabled={pendingStaffId !== null}
                onClick={() => onPromote(staff.id)}
              >
                {pendingStaffId === staff.id
                  ? "Promoting…"
                  : "Promote and continue"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AccountDeletionSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<AccountDeletionPreview | null>(null);
  const [eligibleStaff, setEligibleStaff] = useState<StaffChoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingStaffId, setPendingStaffId] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  async function loadRecovery() {
    setRecoveryError(null);
    try {
      const recovery = await loadAdministratorRecovery(fetch);
      setEligibleStaff(recovery.eligibleStaff);
    } catch (requestError) {
      setEligibleStaff([]);
      setRecoveryError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load eligible employees.",
      );
    }
  }

  async function loadPreview() {
    setLoading(true);
    setError(null);
    setRecoveryError(null);
    try {
      const nextPreview = await loadDeletionPreview(fetch);
      setPreview(nextPreview);
      if (nextPreview.blockedReason === "last_admin") {
        await loadRecovery();
      } else {
        setEligibleStaff([]);
      }
    } catch (requestError) {
      setPreview(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load deletion details.",
      );
    } finally {
      setLoading(false);
    }
  }

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setPreview(null);
      setEligibleStaff([]);
      setPassword("");
      setConfirmation("");
      setError(null);
      setRecoveryError(null);
      return;
    }
    void loadPreview();
  }

  async function promote(staffId: number) {
    if (pendingStaffId !== null) return;
    setPendingStaffId(staffId);
    setRecoveryError(null);
    try {
      await promoteDeletionAdministrator(staffId);
      await loadPreview();
    } catch (requestError) {
      setRecoveryError(
        requestError instanceof Error
          ? requestError.message
          : "Could not promote that employee.",
      );
    } finally {
      setPendingStaffId(null);
    }
  }

  async function submit() {
    if (!preview || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/account/deletion", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          confirmation,
          expected_scope: preview.scope,
        }),
      });
      await responseJson<{ ok?: boolean }>(
        response,
        "Could not delete your account.",
      );
      router.replace("/login?deleted=1");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not delete your account.",
      );
      if (
        requestError instanceof DeletionRequestError &&
        requestError.status === 409
      ) {
        void loadPreview();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const organizationDeletion = preview?.scope === "organization";
  const blocked = preview?.blockedReason === "last_admin";
  const canSubmit =
    !!preview &&
    !blocked &&
    !!password &&
    (!organizationDeletion || confirmation === "DELETE");

  return (
    <div className="pt-6 border-t border-line">
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-[15px] font-extrabold tracking-tight text-white">
              Delete account
            </h3>
            <p className="mt-1 text-xs font-bold text-zinc-400">
              Permanently remove your account and its associated data.
            </p>
          </div>
          <Dialog open={open} onOpenChange={changeOpen}>
            <Button
              variant="destructive"
              type="button"
              onClick={() => changeOpen(true)}
            >
              Delete account
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {organizationDeletion ? "Delete organization" : "Delete account"}
                </DialogTitle>
                <DialogDescription>This action cannot be undone.</DialogDescription>
              </DialogHeader>

              {loading && (
                <p className="text-sm font-bold text-zinc-400">
                  Loading deletion details…
                </p>
              )}

              {!loading && error && (
                <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-300">
                  <p>{error}</p>
                  {!preview && (
                    <Button variant="outline" type="button" onClick={loadPreview}>
                      Retry
                    </Button>
                  )}
                </div>
              )}

              {!loading && preview && blocked && (
                <AccountDeletionRecovery
                  companyName={preview.companyName}
                  eligibleStaff={eligibleStaff}
                  pendingStaffId={pendingStaffId}
                  error={recoveryError}
                  onPromote={(staffId) => void promote(staffId)}
                  onRetry={() => void loadRecovery()}
                />
              )}

              {!loading && preview && !blocked && (
                <div className="space-y-4">
                  <p className="text-sm font-bold text-zinc-300">
                    {accountDeletionScopeMessage(preview)}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="delete-account-password">
                      Current password
                    </Label>
                    <Input
                      id="delete-account-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  {organizationDeletion && (
                    <div className="space-y-2">
                      <Label htmlFor="delete-organization-confirmation">
                        Type DELETE to confirm
                      </Label>
                      <Input
                        id="delete-organization-confirmation"
                        value={confirmation}
                        onChange={(event) => setConfirmation(event.target.value)}
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => changeOpen(false)}
                >
                  Cancel
                </Button>
                {!blocked && preview && (
                  <Button
                    variant="destructive"
                    type="button"
                    disabled={!canSubmit || submitting}
                    onClick={submit}
                  >
                    {submitting
                      ? "Deleting…"
                      : organizationDeletion
                        ? "Delete organization"
                        : "Delete account"}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
