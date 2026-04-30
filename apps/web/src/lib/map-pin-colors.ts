import { DollarSign, Home, Ban, FileText, RotateCcw, Skull } from "lucide-react";

export const PIN_STATUS = {
  sale:           { label: "Sale",            color: "#22c55e", textColor: "#ffffff", icon: DollarSign },
  not_home:       { label: "Not home",        color: "#facc15", textColor: "#0f172a", icon: Home },
  not_interested: { label: "Not interested",  color: "#ef4444", textColor: "#ffffff", icon: Ban },
  come_back:      { label: "Come back later", color: "#3b82f6", textColor: "#ffffff", icon: RotateCcw },
  quote_sent:     { label: "Quote sent",      color: "#f97316", textColor: "#ffffff", icon: FileText },
  do_not_return:  { label: "Do not return",   color: "#0f172a", textColor: "#ffffff", icon: Skull },
} as const;

export type PinStatus = keyof typeof PIN_STATUS;

export function isPinStatus(s: string): s is PinStatus {
  return s in PIN_STATUS;
}
