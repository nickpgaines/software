"use client";

import { createContext, useContext, useState } from "react";

type ThemeCtx = { dark: boolean; setDark: (d: boolean) => void };

const Context = createContext<ThemeCtx>({ dark: false, setDark: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  return <Context.Provider value={{ dark, setDark }}>{children}</Context.Provider>;
}

export const useTheme = () => useContext(Context);

export const ACCENT = "#379CFB";

export type Tokens = {
  isDark: boolean;
  card: string;
  cardShadow: string;
  text: string;
  muted: string;
  subtle: string;
  divider: string;
  hoverBg: string;
  pillBg: string;
  pillText: string;
  iconChip: string;
  inputBg: string;
  inputBorder: string;
  placeholder: string;
};

export function useTokens(): Tokens {
  const { dark } = useTheme();
  return {
    isDark: dark,
    card: dark ? "bg-zinc-900 border border-zinc-800" : "bg-white border border-zinc-200",
    cardShadow: dark ? "shadow-[0_1px_2px_rgba(0,0,0,0.4)]" : "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
    text: dark ? "text-white" : "text-zinc-950",
    muted: dark ? "text-zinc-400" : "text-zinc-500",
    subtle: dark ? "text-zinc-500" : "text-zinc-400",
    divider: dark ? "border-zinc-800" : "border-zinc-200",
    hoverBg: dark ? "hover:bg-zinc-800/60" : "hover:bg-zinc-50",
    pillBg: dark ? "bg-zinc-800" : "bg-zinc-100",
    pillText: dark ? "text-zinc-300" : "text-zinc-600",
    iconChip: dark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-500",
    inputBg: dark ? "bg-zinc-800" : "bg-white",
    inputBorder: dark ? "border-zinc-700" : "border-zinc-200",
    placeholder: dark ? "placeholder-zinc-500" : "placeholder-zinc-400",
  };
}
