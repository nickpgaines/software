"use client";

import type { EstimateConfig } from "@/lib/customizations";

export type PreviewCompany = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  logo_url: string | null;
};

export type PreviewCustomer = {
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
};

export type PreviewItem = {
  id: number;
  title: string;
  description: string | null;
  quantity: number;
  price_cents: number;
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Read-only rendering of the customer-facing estimate document. Mirrors the
// white-paper preview used in Settings → Estimates (CustomizationsPanel's
// DocumentPreview) but renders the real estimate's data. Section visibility,
// footer text, and the default note all come from the company's global
// estimate customizations — editing those lives in Settings, not here.
export default function EstimateDocumentPreview({
  estimateNumber,
  dateStr,
  company,
  sections,
  customer,
  items,
  totalCents,
  terms,
}: {
  estimateNumber: number;
  dateStr: string;
  company: PreviewCompany;
  sections: EstimateConfig;
  customer: PreviewCustomer;
  items: PreviewItem[];
  totalCents: number;
  terms: string | null;
}) {
  const businessEmail = company.email?.trim() || null;
  const businessPhone = company.phone?.trim() || null;
  const businessAddress = company.address?.trim() || null;
  const businessWebsite = company.website?.trim() || null;
  const hasTerms = !!(terms && terms.trim());

  return (
    <div className="paper-surface rounded-lg bg-white text-zinc-900 p-5 sm:p-6 shadow-sm overflow-hidden">
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
            </div>
          )}
        </div>
        {sections.show_details && (
          <div className="text-right shrink-0">
            <div className="text-xs font-bold text-zinc-500">Estimate</div>
            <div className="text-base font-extrabold text-zinc-900 tabular-nums">
              {estimateNumber}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Date: {dateStr}</div>
          </div>
        )}
      </div>

      {sections.show_customer_details && (
        <div className="py-4 border-b border-zinc-200">
          <div className="text-xs font-bold text-zinc-500 mb-1">Estimate for</div>
          <div className="text-sm font-bold text-zinc-900">{customer.name}</div>
          {customer.address && (
            <div className="text-xs text-zinc-600">{customer.address}</div>
          )}
          {customer.email && (
            <div className="text-xs text-zinc-600">{customer.email}</div>
          )}
          {customer.phone && (
            <div className="text-xs text-zinc-600">{customer.phone}</div>
          )}
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
          {items.map((it) => (
            <div
              key={it.id}
              className="grid grid-cols-[1fr_50px_90px_90px] text-sm py-2 border-b border-zinc-100"
            >
              <div>
                <div className="font-bold text-zinc-900">{it.title}</div>
                {it.description && (
                  <div className="text-xs text-zinc-500">{it.description}</div>
                )}
              </div>
              <div className="text-right tabular-nums">{it.quantity}</div>
              <div className="text-right tabular-nums">
                {money(it.price_cents)}
              </div>
              <div className="text-right tabular-nums">
                {money(Math.round(it.quantity * it.price_cents))}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="py-3 text-xs text-zinc-400 italic">
              No line items yet.
            </div>
          )}
        </div>
      )}

      {sections.show_total && (
        <div className="py-3 border-t border-zinc-200">
          <div className="ml-auto w-full max-w-[220px] space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Subtotal</span>
              <span className="tabular-nums">{money(totalCents)}</span>
            </div>
            <div className="flex justify-between font-extrabold pt-1 border-t border-zinc-200">
              <span>Total</span>
              <span className="tabular-nums">{money(totalCents)}</span>
            </div>
          </div>
        </div>
      )}

      {sections.note && (
        <div className="pt-3 text-xs text-zinc-600 whitespace-pre-wrap">
          {sections.note}
        </div>
      )}

      {hasTerms && (
        <div className="pt-4 mt-4 border-t border-zinc-200">
          <div className="text-xs font-bold text-zinc-700 mb-1">
            Terms and Conditions
          </div>
          <div className="text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed">
            {terms}
          </div>
        </div>
      )}

      {sections.show_footer && (
        <div className="pt-4 mt-4 border-t border-zinc-200 text-xs text-zinc-500">
          {sections.footer_text || company.name}
        </div>
      )}
    </div>
  );
}
