"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  DEFAULT_CUSTOMIZATIONS,
  type CustomizationConfig,
  type MessageBlock,
  type ReminderInterval,
  type PriceBookItem,
  type ChecklistTemplate,
} from "@/lib/customizations";

type Section =
  | "messages"
  | "job_reminders"
  | "estimates"
  | "invoices"
  | "terms"
  | "service_subscriptions"
  | "price_book"
  | "checklist";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "messages", label: "Messages" },
  { key: "job_reminders", label: "Job Reminders" },
  { key: "estimates", label: "Estimates" },
  { key: "invoices", label: "Invoices" },
  { key: "terms", label: "Terms" },
  { key: "service_subscriptions", label: "Service Subscriptions" },
  { key: "price_book", label: "Price Book" },
  { key: "checklist", label: "Checklist" },
];

type CompanyInfo = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  logo_url: string | null;
};

const DEFAULT_COMPANY: CompanyInfo = {
  name: "Your Company",
  email: null,
  phone: null,
  address: null,
  website: null,
  logo_url: null,
};

export default function CustomizationsPanel() {
  const [config, setConfig] = useState<CustomizationConfig | null>(null);
  const [section, setSection] = useState<Section>("messages");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [company, setCompany] = useState<CompanyInfo>(DEFAULT_COMPANY);

  useEffect(() => {
    fetch("/api/settings/customizations")
      .then((r) => (r.ok ? r.json() : null))
      .then((c: CustomizationConfig | null) => {
        setConfig(c ?? DEFAULT_CUSTOMIZATIONS);
      })
      .finally(() => setLoading(false));
    fetch("/api/settings/company")
      .then((r) => (r.ok ? r.json() : null))
      .then((c: Partial<CompanyInfo> | null) => {
        if (!c) return;
        setCompany({
          name: c.name && c.name.trim() ? c.name : DEFAULT_COMPANY.name,
          email: c.email ?? null,
          phone: c.phone ?? null,
          address: c.address ?? null,
          website: c.website ?? null,
          logo_url: c.logo_url ?? null,
        });
      })
      .catch(() => {});
  }, []);

  function update<K extends keyof CustomizationConfig>(
    key: K,
    value: CustomizationConfig[K]
  ) {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
    setSavedAt(null);
  }

  async function save() {
    if (!config) return;
    setError(null);
    setSaving(true);
    const res = await fetch("/api/settings/customizations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save");
      return;
    }
    const next = (await res.json()) as CustomizationConfig;
    setConfig(next);
    setDirty(false);
    setSavedAt(Date.now());
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">
            Customizations
          </h2>
          <p className="text-sm text-zinc-400 mt-3 font-bold">
            Customize the messages, reminders, and document templates your
            customers and team see.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {error && <span className="text-sm text-rose-600">{error}</span>}
          {savedAt && !saving && !dirty && (
            <span className="text-xs text-emerald-600 font-bold">Saved</span>
          )}
          <Button
            variant="ghost"
            type="button"
            onClick={save}
            disabled={saving || loading || !dirty || !config}
            className="h-auto text-sm bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-full px-5 py-2 font-bold"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
        <nav className="flex md:flex-col gap-1 overflow-x-auto">
          {SECTIONS.map((s) => {
            const active = section === s.key;
            return (
              <Button
                key={s.key}
                variant="ghost"
                type="button"
                onClick={() => setSection(s.key)}
                className={
                  "h-auto justify-start whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold " +
                  (active
                    ? "bg-card border border-line text-white"
                    : "text-zinc-400 hover:text-zinc-300 hover:bg-card/50")
                }
              >
                {s.label}
              </Button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {loading || !config ? (
            <div className="text-sm text-zinc-400">Loading…</div>
          ) : (
            <>
              {section === "messages" && (
                <MessagesSection
                  config={config.messages}
                  onChange={(v) => update("messages", v)}
                />
              )}
              {section === "job_reminders" && (
                <JobRemindersSection
                  config={config.job_reminders}
                  onChange={(v) => update("job_reminders", v)}
                />
              )}
              {section === "estimates" && (
                <EstimatesSection
                  config={config.estimates}
                  onChange={(v) => update("estimates", v)}
                  company={company}
                />
              )}
              {section === "invoices" && (
                <InvoicesSection
                  config={config.invoices}
                  onChange={(v) => update("invoices", v)}
                  company={company}
                />
              )}
              {section === "terms" && (
                <TermsSection
                  config={config.terms}
                  onChange={(v) => update("terms", v)}
                />
              )}
              {section === "service_subscriptions" && (
                <ServiceSubscriptionsSection
                  config={config.service_subscriptions}
                  onChange={(v) => update("service_subscriptions", v)}
                />
              )}
              {section === "price_book" && (
                <PriceBookSection
                  config={config.price_book}
                  onChange={(v) => update("price_book", v)}
                />
              )}
              {section === "checklist" && (
                <ChecklistSection
                  config={config.checklist}
                  onChange={(v) => update("checklist", v)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <h3 className="text-base font-extrabold text-white tracking-tight">
        {title}
      </h3>
      <p className="text-sm text-zinc-400 mt-2 font-bold">{description}</p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="block text-xs font-bold text-zinc-500 mb-1.5 font-normal">
      {children}
    </Label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <span>{label}</span>
    </label>
  );
}

function MessageBlockEditor({
  title,
  block,
  onChange,
  showHeader = true,
  showDriverImage = false,
  showEnabled = false,
}: {
  title: string;
  block: MessageBlock;
  onChange: (b: MessageBlock) => void;
  showHeader?: boolean;
  showDriverImage?: boolean;
  showEnabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-white">{title}</div>
        {showEnabled && (
          <ToggleRow
            label="Enabled"
            checked={block.enabled}
            onChange={(v) => onChange({ ...block, enabled: v })}
          />
        )}
      </div>
      {showHeader && (
        <ToggleRow
          label="Include personalized header"
          checked={block.include_personalized_header}
          onChange={(v) =>
            onChange({ ...block, include_personalized_header: v })
          }
        />
      )}
      <Textarea
        value={block.template}
        onChange={(e) => onChange({ ...block, template: e.target.value })}
        className="w-full border-line rounded-xl px-3 py-2 text-sm bg-card min-h-[80px]"
        placeholder="Message template…"
      />
      {showDriverImage && (
        <ToggleRow
          label="Include driver name and image (if available) in the notification"
          checked={block.include_driver_name_image}
          onChange={(v) =>
            onChange({ ...block, include_driver_name_image: v })
          }
        />
      )}
    </div>
  );
}

function MessagesSection({
  config,
  onChange,
}: {
  config: CustomizationConfig["messages"];
  onChange: (v: CustomizationConfig["messages"]) => void;
}) {
  function set<K extends keyof CustomizationConfig["messages"]>(
    key: K,
    value: CustomizationConfig["messages"][K]
  ) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Notification Messages"
        description="Customize the status, estimate, invoice, and service subscription messages that are sent to customers."
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-white">Job Creation</div>
          <ToggleRow
            label="Enabled"
            checked={config.job_creation.enabled}
            onChange={(v) =>
              set("job_creation", { ...config.job_creation, enabled: v })
            }
          />
        </div>
        <Textarea
          value={config.job_creation.template}
          onChange={(e) =>
            set("job_creation", {
              ...config.job_creation,
              template: e.target.value,
            })
          }
          className="w-full border-line rounded-xl px-3 py-2 text-sm bg-card min-h-[80px]"
          placeholder="You have been scheduled for…"
        />
      </div>

      <Separator className="bg-line" />

      <MessageBlockEditor
        title="Drive Start"
        block={config.drive_start}
        onChange={(b) => set("drive_start", b)}
        showDriverImage
      />

      <Separator className="bg-line" />

      <MessageBlockEditor
        title="Drive End"
        block={config.drive_end}
        onChange={(b) => set("drive_end", b)}
      />

      <Separator className="bg-line" />

      <MessageBlockEditor
        title="Job Finish"
        block={config.job_finish}
        onChange={(b) => set("job_finish", b)}
        showHeader={false}
      />

      <Separator className="bg-line" />

      <MessageBlockEditor
        title="Invoice Message"
        block={config.invoice_message}
        onChange={(b) => set("invoice_message", b)}
        showHeader={false}
      />

      <div className="space-y-1.5">
        <FieldLabel>Invoice Subject Header</FieldLabel>
        <Input
          type="text"
          value={config.invoice_subject}
          onChange={(e) => set("invoice_subject", e.target.value)}
          className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
        />
      </div>

      <Separator className="bg-line" />

      <MessageBlockEditor
        title="Receipt"
        block={config.receipt_message}
        onChange={(b) => set("receipt_message", b)}
        showHeader={false}
      />

      <Separator className="bg-line" />

      <MessageBlockEditor
        title="Review Request"
        block={config.review_request}
        onChange={(b) => set("review_request", b)}
        showHeader={false}
        showEnabled
      />
    </div>
  );
}

function JobRemindersSection({
  config,
  onChange,
}: {
  config: CustomizationConfig["job_reminders"];
  onChange: (v: CustomizationConfig["job_reminders"]) => void;
}) {
  function setInterval(idx: number, next: ReminderInterval) {
    const intervals = config.intervals.slice();
    intervals[idx] = next;
    onChange({ ...config, intervals });
  }

  const charCount = config.message_template.length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Job Reminders"
        description="Customize the job reminders that are sent to customers and employees."
      />

      <div className="rounded-xl border border-line bg-card p-4">
        <div className="grid grid-cols-[1fr_140px_60px] items-center gap-3 text-xs font-bold text-zinc-500 mb-3">
          <div>Time before job</div>
          <div>Time to send</div>
          <div></div>
        </div>
        <div className="space-y-3">
          {config.intervals.map((iv, idx) => (
            <div key={iv.key} className="space-y-2">
              <div className="grid grid-cols-[1fr_140px_60px] items-center gap-3">
                <div className="text-sm font-bold text-white">{iv.label}</div>
                <Input
                  type="time"
                  value={iv.send_time}
                  onChange={(e) =>
                    setInterval(idx, { ...iv, send_time: e.target.value })
                  }
                  className="h-auto w-full border-line rounded-lg px-3 py-1.5 text-sm bg-black"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setInterval(idx, { ...iv, enabled: !iv.enabled })
                    }
                    className={
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors " +
                      (iv.enabled ? "bg-emerald-500" : "bg-zinc-700")
                    }
                    aria-label={`Toggle ${iv.label} reminder`}
                  >
                    <span
                      className={
                        "inline-block h-5 w-5 transform rounded-full bg-white transition-transform " +
                        (iv.enabled ? "translate-x-5" : "translate-x-0.5")
                      }
                    />
                  </button>
                </div>
              </div>
              {iv.enabled && (
                <div className="ml-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <ToggleRow
                    label="Notify Customer"
                    checked={iv.notify_customer}
                    onChange={(v) =>
                      setInterval(idx, { ...iv, notify_customer: v })
                    }
                  />
                  <ToggleRow
                    label="Notify Business Owner"
                    checked={iv.notify_owner}
                    onChange={(v) =>
                      setInterval(idx, { ...iv, notify_owner: v })
                    }
                  />
                  <ToggleRow
                    label="Notify Dispatched Employees"
                    checked={iv.notify_dispatched}
                    onChange={(v) =>
                      setInterval(idx, { ...iv, notify_dispatched: v })
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-card p-4 space-y-4">
        <div className="text-sm font-bold text-white">Notification Methods</div>
        <div className="space-y-3">
          <div>
            <div className="text-xs font-bold text-zinc-500 mb-1.5">
              Customer
            </div>
            <div className="flex gap-4">
              <ToggleRow
                label="SMS"
                checked={config.customer_methods.sms}
                onChange={(v) =>
                  onChange({
                    ...config,
                    customer_methods: { ...config.customer_methods, sms: v },
                  })
                }
              />
              <ToggleRow
                label="Email"
                checked={config.customer_methods.email}
                onChange={(v) =>
                  onChange({
                    ...config,
                    customer_methods: { ...config.customer_methods, email: v },
                  })
                }
              />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-500 mb-1.5">
              Business Owner
            </div>
            <div className="flex gap-4">
              <ToggleRow
                label="Push Notification"
                checked={config.owner_methods.push}
                onChange={(v) =>
                  onChange({
                    ...config,
                    owner_methods: { ...config.owner_methods, push: v },
                  })
                }
              />
              <ToggleRow
                label="Email"
                checked={config.owner_methods.email}
                onChange={(v) =>
                  onChange({
                    ...config,
                    owner_methods: { ...config.owner_methods, email: v },
                  })
                }
              />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-500 mb-1.5">
              Dispatched Employees
            </div>
            <div className="flex gap-4">
              <ToggleRow
                label="Push Notification"
                checked={config.dispatched_methods.push}
                onChange={(v) =>
                  onChange({
                    ...config,
                    dispatched_methods: {
                      ...config.dispatched_methods,
                      push: v,
                    },
                  })
                }
              />
              <ToggleRow
                label="Email"
                checked={config.dispatched_methods.email}
                onChange={(v) =>
                  onChange({
                    ...config,
                    dispatched_methods: {
                      ...config.dispatched_methods,
                      email: v,
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-white">
            Reminder Message Template
          </div>
          <div className="text-xs text-zinc-500">{charCount}/200</div>
        </div>
        <Textarea
          value={config.message_template}
          maxLength={200}
          onChange={(e) =>
            onChange({ ...config, message_template: e.target.value })
          }
          className="w-full border-line rounded-xl px-3 py-2 text-sm bg-black min-h-[100px]"
          placeholder="Hey {customer_first_name}, your job is scheduled for {job_start}…"
        />
        <div className="text-xs text-zinc-500">
          Variables: <code className="text-zinc-300">{"{customer_first_name}"}</code>{" "}
          <code className="text-zinc-300">{"{job_start}"}</code>{" "}
          <code className="text-zinc-300">{"{company_name}"}</code>
        </div>
      </div>
    </div>
  );
}

function DocumentSectionsEditor<
  T extends CustomizationConfig["estimates"] | CustomizationConfig["invoices"]
>({
  config,
  onChange,
}: {
  config: T;
  onChange: (v: T) => void;
}) {
  function set<K extends keyof T>(key: K, value: T[K]) {
    onChange({ ...config, [key]: value });
  }
  return (
    <div className="space-y-3">
      <ToggleRow
        label="Show logo"
        checked={config.show_logo}
        onChange={(v) => set("show_logo" as keyof T, v as T[keyof T])}
      />
      <ToggleRow
        label="Show document details"
        checked={config.show_details}
        onChange={(v) => set("show_details" as keyof T, v as T[keyof T])}
      />
      <ToggleRow
        label="Show customer details"
        checked={config.show_customer_details}
        onChange={(v) =>
          set("show_customer_details" as keyof T, v as T[keyof T])
        }
      />
      <ToggleRow
        label="Show business details"
        checked={config.show_business_details}
        onChange={(v) =>
          set("show_business_details" as keyof T, v as T[keyof T])
        }
      />
      <ToggleRow
        label="Show line items"
        checked={config.show_line_items}
        onChange={(v) => set("show_line_items" as keyof T, v as T[keyof T])}
      />
      <ToggleRow
        label="Show total"
        checked={config.show_total}
        onChange={(v) => set("show_total" as keyof T, v as T[keyof T])}
      />
      <ToggleRow
        label="Show footer"
        checked={config.show_footer}
        onChange={(v) => set("show_footer" as keyof T, v as T[keyof T])}
      />
    </div>
  );
}

function EstimatesSection({
  config,
  onChange,
  company,
}: {
  config: CustomizationConfig["estimates"];
  onChange: (v: CustomizationConfig["estimates"]) => void;
  company: CompanyInfo;
}) {
  function set<K extends keyof CustomizationConfig["estimates"]>(
    key: K,
    value: CustomizationConfig["estimates"][K]
  ) {
    onChange({ ...config, [key]: value });
  }
  const dripText = config.reminder_drip_days.join(", ");

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Estimate Settings"
        description="Choose what appears on estimates and configure follow-up reminders."
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <DocumentPreview
          kind="estimate"
          company={company}
          sections={config}
        />
        <div className="rounded-xl border border-line bg-card p-4 space-y-4">
          <div className="text-sm font-bold text-white">Sections</div>
          <DocumentSectionsEditor config={config} onChange={onChange} />
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Footer text</FieldLabel>
        <Input
          type="text"
          value={config.footer_text}
          onChange={(e) => set("footer_text", e.target.value)}
          className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
          placeholder="Thanks for considering us!"
        />
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Default note</FieldLabel>
        <Textarea
          value={config.note}
          onChange={(e) => set("note", e.target.value)}
          className="w-full border-line rounded-xl px-3 py-2 text-sm bg-card min-h-[80px]"
          placeholder="Optional note shown on every estimate…"
        />
      </div>

      <div className="rounded-xl border border-line bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-white">Estimate Reminders</div>
            <div className="text-xs text-zinc-400 mt-1">
              Automatically follow up with customers while an estimate is still
              pending.
            </div>
          </div>
          <button
            type="button"
            onClick={() => set("reminders_enabled", !config.reminders_enabled)}
            className={
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors " +
              (config.reminders_enabled ? "bg-emerald-500" : "bg-zinc-700")
            }
            aria-label="Toggle estimate reminders"
          >
            <span
              className={
                "inline-block h-5 w-5 transform rounded-full bg-white transition-transform " +
                (config.reminders_enabled ? "translate-x-5" : "translate-x-0.5")
              }
            />
          </button>
        </div>

        {config.reminders_enabled && (
          <>
            <div>
              <FieldLabel>Notification methods</FieldLabel>
              <div className="flex gap-4">
                <ToggleRow
                  label="SMS"
                  checked={config.reminder_methods.sms}
                  onChange={(v) =>
                    set("reminder_methods", {
                      ...config.reminder_methods,
                      sms: v,
                    })
                  }
                />
                <ToggleRow
                  label="Email"
                  checked={config.reminder_methods.email}
                  onChange={(v) =>
                    set("reminder_methods", {
                      ...config.reminder_methods,
                      email: v,
                    })
                  }
                />
              </div>
            </div>
            <div>
              <FieldLabel>Drip schedule (days between reminders)</FieldLabel>
              <Input
                type="text"
                value={dripText}
                onChange={(e) =>
                  set(
                    "reminder_drip_days",
                    e.target.value
                      .split(",")
                      .map((s) => Number(s.trim()))
                      .filter((n) => Number.isFinite(n) && n > 0)
                  )
                }
                className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
                placeholder="3, 5, 7"
              />
              <div className="text-xs text-zinc-500 mt-1">
                Comma-separated. Reminder 1 is sent after the estimate is sent;
                each later reminder waits the listed number of days.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InvoicesSection({
  config,
  onChange,
  company,
}: {
  config: CustomizationConfig["invoices"];
  onChange: (v: CustomizationConfig["invoices"]) => void;
  company: CompanyInfo;
}) {
  function set<K extends keyof CustomizationConfig["invoices"]>(
    key: K,
    value: CustomizationConfig["invoices"][K]
  ) {
    onChange({ ...config, [key]: value });
  }
  const tipsText = config.default_tip_options.join(", ");

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Invoice Settings"
        description="Choose what appears on invoices and configure the customer payment page."
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <DocumentPreview
          kind="invoice"
          company={company}
          sections={config}
        />
        <div className="rounded-xl border border-line bg-card p-4 space-y-4">
          <div className="text-sm font-bold text-white">Sections</div>
          <DocumentSectionsEditor config={config} onChange={onChange} />
          <ToggleRow
            label="Show payment section"
            checked={config.show_payment_section}
            onChange={(v) => set("show_payment_section", v)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Footer text</FieldLabel>
        <Input
          type="text"
          value={config.footer_text}
          onChange={(e) => set("footer_text", e.target.value)}
          className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
          placeholder="Thanks for your business!"
        />
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Default note</FieldLabel>
        <Textarea
          value={config.note}
          onChange={(e) => set("note", e.target.value)}
          className="w-full border-line rounded-xl px-3 py-2 text-sm bg-card min-h-[80px]"
          placeholder="Optional note shown on every invoice…"
        />
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Payment button label</FieldLabel>
        <Input
          type="text"
          value={config.payment_button_label}
          onChange={(e) => set("payment_button_label", e.target.value)}
          className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
          placeholder="Pay"
        />
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Default tip percentages</FieldLabel>
        <Input
          type="text"
          value={tipsText}
          onChange={(e) =>
            set(
              "default_tip_options",
              e.target.value
                .split(",")
                .map((s) => Number(s.trim()))
                .filter((n) => Number.isFinite(n) && n >= 0)
            )
          }
          className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-card"
          placeholder="10, 15, 20"
        />
        <div className="text-xs text-zinc-500 mt-1">
          Comma-separated percentages. Customers can also enter a custom tip.
        </div>
      </div>
    </div>
  );
}

function TermsSection({
  config,
  onChange,
}: {
  config: CustomizationConfig["terms"];
  onChange: (v: CustomizationConfig["terms"]) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Default Terms"
        description="The default terms attached to estimates, invoices, and subscriptions when no other terms are selected."
      />
      <Textarea
        value={config.default_terms}
        onChange={(e) => onChange({ default_terms: e.target.value })}
        className="w-full border-line rounded-xl px-3 py-2 text-sm bg-card min-h-[200px]"
        placeholder="Payment is due upon receipt…"
      />
    </div>
  );
}

function ServiceSubscriptionsSection({
  config,
  onChange,
}: {
  config: CustomizationConfig["service_subscriptions"];
  onChange: (v: CustomizationConfig["service_subscriptions"]) => void;
}) {
  function set<K extends keyof CustomizationConfig["service_subscriptions"]>(
    key: K,
    value: CustomizationConfig["service_subscriptions"][K]
  ) {
    onChange({ ...config, [key]: value });
  }
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Service Subscriptions"
        description="Customize the messages sent to customers about their service subscriptions."
      />
      <div className="space-y-1.5">
        <FieldLabel>Welcome / intro message</FieldLabel>
        <Textarea
          value={config.default_intro_message}
          onChange={(e) => set("default_intro_message", e.target.value)}
          className="w-full border-line rounded-xl px-3 py-2 text-sm bg-card min-h-[80px]"
        />
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Renewal reminder</FieldLabel>
        <Textarea
          value={config.default_renewal_reminder}
          onChange={(e) => set("default_renewal_reminder", e.target.value)}
          className="w-full border-line rounded-xl px-3 py-2 text-sm bg-card min-h-[80px]"
        />
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Cancellation message</FieldLabel>
        <Textarea
          value={config.cancellation_message}
          onChange={(e) => set("cancellation_message", e.target.value)}
          className="w-full border-line rounded-xl px-3 py-2 text-sm bg-card min-h-[80px]"
        />
      </div>
    </div>
  );
}

function newId() {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function PriceBookSection({
  config,
  onChange,
}: {
  config: CustomizationConfig["price_book"];
  onChange: (v: CustomizationConfig["price_book"]) => void;
}) {
  function setItem(idx: number, next: PriceBookItem) {
    const items = config.items.slice();
    items[idx] = next;
    onChange({ items });
  }
  function addItem() {
    onChange({
      items: [
        ...config.items,
        {
          id: newId(),
          name: "",
          description: "",
          price_cents: 0,
          category: "",
        },
      ],
    });
  }
  function removeItem(idx: number) {
    const items = config.items.slice();
    items.splice(idx, 1);
    onChange({ items });
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Price Book"
        description="Reusable services and prices you can drop into estimates and invoices."
      />

      <div className="space-y-3">
        {config.items.map((item, idx) => (
          <div
            key={item.id}
            className="rounded-xl border border-line bg-card p-4 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_140px] gap-3">
              <div>
                <FieldLabel>Name</FieldLabel>
                <Input
                  type="text"
                  value={item.name}
                  onChange={(e) =>
                    setItem(idx, { ...item, name: e.target.value })
                  }
                  className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-black"
                  placeholder="Window Cleaning"
                />
              </div>
              <div>
                <FieldLabel>Category</FieldLabel>
                <Input
                  type="text"
                  value={item.category}
                  onChange={(e) =>
                    setItem(idx, { ...item, category: e.target.value })
                  }
                  className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-black"
                  placeholder="Cleaning"
                />
              </div>
              <div>
                <FieldLabel>Price (USD)</FieldLabel>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={(item.price_cents / 100).toFixed(2)}
                  onChange={(e) =>
                    setItem(idx, {
                      ...item,
                      price_cents: Math.round(
                        Number(e.target.value || 0) * 100
                      ),
                    })
                  }
                  className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-black"
                />
              </div>
            </div>
            <div>
              <FieldLabel>Description</FieldLabel>
              <Textarea
                value={item.description}
                onChange={(e) =>
                  setItem(idx, { ...item, description: e.target.value })
                }
                className="w-full border-line rounded-xl px-3 py-2 text-sm bg-black min-h-[60px]"
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="ghost"
                type="button"
                onClick={() => removeItem(idx)}
                className="h-auto text-xs text-rose-400 hover:text-rose-300 hover:bg-transparent font-bold px-2"
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
        {config.items.length === 0 && (
          <div className="text-sm text-zinc-400">
            No price book items yet.
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        type="button"
        onClick={addItem}
        className="h-auto text-sm bg-card border border-line hover:bg-black rounded-full px-4 py-2 font-bold"
      >
        Add item
      </Button>
    </div>
  );
}

function ChecklistSection({
  config,
  onChange,
}: {
  config: CustomizationConfig["checklist"];
  onChange: (v: CustomizationConfig["checklist"]) => void;
}) {
  function setTemplate(idx: number, next: ChecklistTemplate) {
    const templates = config.templates.slice();
    templates[idx] = next;
    onChange({ templates });
  }
  function addTemplate() {
    onChange({
      templates: [
        ...config.templates,
        { id: newId(), name: "", items: [] },
      ],
    });
  }
  function removeTemplate(idx: number) {
    const templates = config.templates.slice();
    templates.splice(idx, 1);
    onChange({ templates });
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Checklist Templates"
        description="Reusable checklists you can attach to a job type so technicians know exactly what to complete."
      />

      <div className="space-y-3">
        {config.templates.map((tpl, idx) => (
          <ChecklistTemplateEditor
            key={tpl.id}
            template={tpl}
            onChange={(next) => setTemplate(idx, next)}
            onRemove={() => removeTemplate(idx)}
          />
        ))}
        {config.templates.length === 0 && (
          <div className="text-sm text-zinc-400">
            No checklist templates yet.
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        type="button"
        onClick={addTemplate}
        className="h-auto text-sm bg-card border border-line hover:bg-black rounded-full px-4 py-2 font-bold"
      >
        Add template
      </Button>
    </div>
  );
}

function ChecklistTemplateEditor({
  template,
  onChange,
  onRemove,
}: {
  template: ChecklistTemplate;
  onChange: (t: ChecklistTemplate) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState("");
  const items = useMemo(() => template.items, [template.items]);

  function addItem() {
    const v = draft.trim();
    if (!v) return;
    onChange({ ...template, items: [...items, v] });
    setDraft("");
  }
  function removeItem(i: number) {
    const next = items.slice();
    next.splice(i, 1);
    onChange({ ...template, items: next });
  }

  return (
    <div className="rounded-xl border border-line bg-card p-4 space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <FieldLabel>Template name</FieldLabel>
          <Input
            type="text"
            value={template.name}
            onChange={(e) => onChange({ ...template, name: e.target.value })}
            className="h-auto w-full border-line rounded-full px-4 py-2 text-sm bg-black"
            placeholder="Standard window clean"
          />
        </div>
        <Button
          variant="ghost"
          type="button"
          onClick={onRemove}
          className="h-auto text-xs text-rose-400 hover:text-rose-300 hover:bg-transparent font-bold px-2"
        >
          Remove
        </Button>
      </div>

      <div>
        <FieldLabel>Items</FieldLabel>
        <ul className="space-y-1.5 mb-3">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-zinc-300">• {it}</span>
              <Button
                variant="ghost"
                type="button"
                onClick={() => removeItem(i)}
                className="h-auto text-xs text-zinc-500 hover:text-rose-400 hover:bg-transparent px-1"
              >
                ×
              </Button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-xs text-zinc-500">No items yet.</li>
          )}
        </ul>
        <div className="flex gap-2">
          <Input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            className="h-auto flex-1 border-line rounded-full px-4 py-2 text-sm bg-black"
            placeholder="Add an item and press Enter"
          />
          <Button
            variant="ghost"
            type="button"
            onClick={addItem}
            className="h-auto text-sm bg-black border border-line hover:bg-card rounded-full px-4 py-2 font-bold"
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

type PreviewSections = {
  show_logo: boolean;
  show_details: boolean;
  show_customer_details: boolean;
  show_business_details: boolean;
  show_line_items: boolean;
  show_total: boolean;
  show_footer: boolean;
  footer_text: string;
  note: string;
};

function DocumentPreview({
  kind,
  company,
  sections,
}: {
  kind: "estimate" | "invoice";
  company: CompanyInfo;
  sections: PreviewSections;
}) {
  const isInvoice = kind === "invoice";
  const title = isInvoice ? "Invoice" : "Estimate";
  const sampleNumber = isInvoice ? "54d4a3b8" : "1234";
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });

  const subtotal = 899;
  const tip = 0;
  const tax = 89.9;
  const total = subtotal + tax + tip;

  const fmt = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const businessEmail = company.email?.trim() || null;
  const businessPhone = company.phone?.trim() || null;
  const businessAddress = company.address?.trim() || null;
  const businessWebsite = company.website?.trim() || null;

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="text-xs font-bold text-zinc-500 mb-2 px-1">
        Preview
      </div>
      <div className="rounded-lg bg-white text-zinc-900 p-5 sm:p-6 shadow-sm overflow-hidden">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-200">
          <div className="min-w-0 flex-1">
            {sections.show_logo &&
              (company.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logo_url}
                  alt={`${company.name} logo`}
                  className="h-10 w-10 rounded-md object-contain bg-white mb-2"
                />
              ) : (
                <div className="h-10 w-10 rounded-md bg-sky-500 mb-2" />
              ))}
            {(sections.show_logo || sections.show_business_details) && (
              <div className="text-base font-bold text-zinc-900 truncate">
                {company.name}
              </div>
            )}
            {sections.show_business_details && (
              <div className="mt-1 space-y-0.5">
                {businessPhone && (
                  <div className="text-xs text-zinc-600">{businessPhone}</div>
                )}
                {businessEmail && (
                  <div className="text-xs text-zinc-600 truncate">
                    {businessEmail}
                  </div>
                )}
                {businessAddress && (
                  <div className="text-xs text-zinc-600">{businessAddress}</div>
                )}
                {businessWebsite && (
                  <div className="text-xs text-zinc-600 truncate">
                    {businessWebsite}
                  </div>
                )}
                {!businessAddress &&
                  !businessEmail &&
                  !businessPhone &&
                  !businessWebsite && (
                    <div className="text-xs text-zinc-400 italic">
                      Add company contact info in Settings → Company
                    </div>
                  )}
              </div>
            )}
          </div>
          {sections.show_details && (
            <div className="text-right shrink-0">
              <div className="text-xs font-bold text-zinc-500">
                {title}
              </div>
              <div className="text-base font-extrabold text-zinc-900 tabular-nums">
                {sampleNumber}
              </div>
              <div className="text-xs text-zinc-500 mt-1">Date: {dateStr}</div>
              {isInvoice && (
                <div className="text-xs text-zinc-500">
                  Due: Upon Receipt
                </div>
              )}
            </div>
          )}
        </div>

        {sections.show_customer_details && (
          <div className="py-4 border-b border-zinc-200">
            <div className="text-xs font-bold text-zinc-500 mb-1">
              Bill to
            </div>
            <div className="text-sm font-bold text-zinc-900">
              Sample Customer
            </div>
            <div className="text-xs text-zinc-600">
              123 Main St, Springfield, IL
            </div>
            <div className="text-xs text-zinc-600">customer@example.com</div>
            <div className="text-xs text-zinc-600">(555) 555-5555</div>
          </div>
        )}

        {sections.show_line_items && (
          <div className="py-4">
            <div className="grid grid-cols-[1fr_50px_90px_90px] text-xs font-bold text-zinc-500 pb-2 border-b border-zinc-200">
              <div>Description</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Unit Price</div>
              <div className="text-right">Amount</div>
            </div>
            <div className="grid grid-cols-[1fr_50px_90px_90px] text-sm py-2 border-b border-zinc-100">
              <div>
                <div className="font-bold text-zinc-900">
                  Cleaning Exterior Gutters
                </div>
                <div className="text-xs text-zinc-500">
                  Cleaning the outside gutter wall to add shine.
                </div>
              </div>
              <div className="text-right tabular-nums">1</div>
              <div className="text-right tabular-nums">$100.00</div>
              <div className="text-right tabular-nums">$100.00</div>
            </div>
            <div className="grid grid-cols-[1fr_50px_90px_90px] text-sm py-2">
              <div>
                <div className="font-bold text-zinc-900">Softwash</div>
                <div className="text-xs text-zinc-500">
                  Softwashing the entire house.
                </div>
              </div>
              <div className="text-right tabular-nums">1</div>
              <div className="text-right tabular-nums">$799.00</div>
              <div className="text-right tabular-nums">$799.00</div>
            </div>
          </div>
        )}

        {sections.show_total && (
          <div className="py-3 border-t border-zinc-200">
            <div className="ml-auto w-full max-w-[220px] space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Subtotal</span>
                <span className="tabular-nums">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Tax</span>
                <span className="tabular-nums">{fmt(tax)}</span>
              </div>
              <div className="flex justify-between font-extrabold pt-1 border-t border-zinc-200">
                <span>{isInvoice ? "Amount Due" : "Total"}</span>
                <span className="tabular-nums">{fmt(total)}</span>
              </div>
            </div>
          </div>
        )}

        {sections.note && (
          <div className="pt-3 text-xs text-zinc-600 whitespace-pre-wrap">
            {sections.note}
          </div>
        )}

        {sections.show_footer && (
          <div className="pt-4 mt-4 border-t border-zinc-200 text-xs text-zinc-500">
            {sections.footer_text || company.name}
          </div>
        )}
      </div>
    </div>
  );
}
