"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type LineItem = {
  key: string;
  id?: number;
  title: string;
  description: string;
  quantity: number;
  price_cents: number;
  taxable: boolean;
};

export function uid() {
  return Math.random().toString(36).slice(2);
}

export function emptyLineItem(title = ""): LineItem {
  return {
    key: uid(),
    title,
    description: "",
    quantity: 1,
    price_cents: 0,
    taxable: false,
  };
}

export function lineTotalCents(it: { quantity: number; price_cents: number }) {
  return Math.max(0, Math.round(it.quantity * it.price_cents));
}

export function lineItemsSubtotal(items: LineItem[]) {
  return items.reduce((sum, it) => sum + lineTotalCents(it), 0);
}

export function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export type LineItemsSectionProps = {
  items: LineItem[];
  presets: string[];
  onAdd: () => void;
  onChange: (key: string, patch: Partial<LineItem>) => void;
  onRemove: (key: string) => void;
  required?: boolean;
  extraRow?: (item: LineItem) => React.ReactNode;
};

export function LineItemsSection({
  items,
  presets,
  onAdd,
  onChange,
  onRemove,
  required = false,
  extraRow,
}: LineItemsSectionProps) {
  const subtotal = lineItemsSubtotal(items);
  return (
    <section className="bg-card border border-line rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-extrabold text-white tracking-tight">
          <span className="flex items-center gap-1">
            Line Items
            {required && <span className="text-rose-500">*</span>}
          </span>
        </h2>
        <Button
          type="button"
          onClick={onAdd}
          variant="ghost"
          className="text-sm border border-line bg-card hover:bg-black rounded-full px-3 py-1.5 h-auto"
        >
          + Add Item
        </Button>
      </div>
      <div className="space-y-3">
        {items.map((li) => (
          <LineItemCard
            key={li.key}
            item={li}
            presets={presets}
            onChange={(patch) => onChange(li.key, patch)}
            onRemove={() => onRemove(li.key)}
            extraRow={extraRow ? extraRow(li) : null}
          />
        ))}
      </div>
      <div className="border-t border-line mt-4 pt-4 grid grid-cols-2 gap-3 text-sm">
        <Total label="Subtotal" value={formatMoney(subtotal)} />
        <Total label="Total" value={formatMoney(subtotal)} bold />
      </div>
    </section>
  );
}

function Total({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-bold text-zinc-500">{label}</div>
      <div
        className={
          (bold ? "font-bold text-lg " : "font-semibold ") +
          "tabular-nums text-white"
        }
      >
        {value}
      </div>
    </div>
  );
}

function LineItemCard({
  item,
  presets,
  onChange,
  onRemove,
  extraRow,
}: {
  item: LineItem;
  presets: string[];
  onChange: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
  extraRow?: React.ReactNode;
}) {
  const [titleOpen, setTitleOpen] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!titleRef.current?.contains(e.target as Node)) setTitleOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const lineTotal = lineTotalCents(item);

  return (
    <div className="border border-line rounded-2xl p-4 space-y-3 bg-card">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-3">
          <div ref={titleRef} className="relative">
            <Input
              type="text"
              value={item.title}
              onChange={(e) => {
                onChange({ title: e.target.value });
                setTitleOpen(true);
              }}
              onFocus={() => setTitleOpen(true)}
              placeholder="Service title"
              className="w-full border-line rounded-full px-4 py-2 text-sm h-auto"
            />
            {titleOpen && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-card border border-line rounded-2xl shadow-lg overflow-hidden">
                {presets
                  .filter(
                    (p) =>
                      !item.title ||
                      p.toLowerCase().includes(item.title.toLowerCase())
                  )
                  .map((p) => (
                    <Button
                      key={p}
                      type="button"
                      onClick={() => {
                        onChange({ title: p });
                        setTitleOpen(false);
                      }}
                      variant="ghost"
                      className="w-full text-left px-4 py-2 hover:bg-black text-sm h-auto block rounded-none"
                    >
                      {p}
                    </Button>
                  ))}
              </div>
            )}
          </div>
          <div className="relative">
            <Textarea
              value={item.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={2}
              placeholder="Description (optional)"
              className="w-full border-line rounded-2xl px-4 py-2 text-sm h-auto"
            />
            <Button
              type="button"
              title="AI write — coming soon"
              variant="ghost"
              className="absolute top-2 right-2 inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-full px-2.5 py-1 h-auto"
            >
              <span>✦</span> AI Write
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="block text-xs font-bold text-zinc-500 mb-2">
                Quantity
              </Label>
              <Input
                type="number"
                min={0}
                step="1"
                value={item.quantity}
                onChange={(e) =>
                  onChange({ quantity: Number(e.target.value) || 0 })
                }
                className="w-full border-line rounded-full px-4 py-2 text-sm h-auto"
              />
            </div>
            <div>
              <Label className="block text-xs font-bold text-zinc-500 mb-2">
                Price ($)
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={(item.price_cents / 100).toString()}
                onChange={(e) =>
                  onChange({
                    price_cents: Math.round(Number(e.target.value) * 100) || 0,
                  })
                }
                className="w-full border-line rounded-full px-4 py-2 text-sm h-auto"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Label className="inline-flex items-center gap-2 font-normal">
              <Checkbox
                checked={item.taxable}
                onCheckedChange={(c) => onChange({ taxable: c === true })}
                className="rounded border-line-strong text-white focus:ring-zinc-500"
              />
              Taxable
            </Label>
            {extraRow}
          </div>
        </div>
        <Button
          type="button"
          onClick={onRemove}
          variant="ghost"
          className="text-zinc-500 hover:text-rose-500 p-1 h-auto"
          aria-label="Remove item"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </Button>
      </div>
      <div className="flex justify-end text-sm text-zinc-400 font-bold">
        Item total:{" "}
        <span className="font-extrabold text-white tracking-tight ml-1">
          {formatMoney(lineTotal)}
        </span>
      </div>
    </div>
  );
}
