"use client";

import { useTokens } from "../_theme";
import { Card, CardTitle, EmptyState, PageHeader } from "../_ui";
import type { CustomerRow } from "../_data";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function CustomersView({ customers }: { customers: CustomerRow[] }) {
  const t = useTokens();

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={
          customers.length === 0
            ? "No customers yet"
            : `${customers.length} most recent`
        }
      />

      {customers.length === 0 ? (
        <Card>
          <EmptyState
            title="No customers yet"
            subtitle="Customers added through the CRM or imported via CSV will show up here."
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            }
          />
        </Card>
      ) : (
        <Card>
          <CardTitle title="Customer list" subtitle={`${customers.length} customer${customers.length === 1 ? "" : "s"}`} />
          <div className="px-3 pb-3">
            {customers.map((c) => (
              <div key={c.id} className={`flex items-center gap-4 p-3 rounded-xl ${t.hoverBg} cursor-pointer`}>
                <div className={`w-9 h-9 rounded-full ${t.iconChip} text-[12px] font-bold flex items-center justify-center flex-shrink-0`}>
                  {initials(c.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[14px] font-bold truncate ${t.text}`}>{c.name}</div>
                  {c.address && (
                    <div className={`text-[12px] ${t.muted} truncate font-semibold`}>{c.address}</div>
                  )}
                </div>
                <div className={`text-[12px] ${t.muted} font-semibold w-44 truncate text-right hidden sm:block`}>
                  {c.email || ""}
                </div>
                <div className={`text-[12px] ${t.muted} font-semibold tabular-nums w-32 text-right hidden md:block`}>
                  {c.phone || ""}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
