"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Call as TwilioCall, Device as TwilioDevice } from "@twilio/voice-sdk";
import { PulseIcon } from "@/components/pulse/Icon";
import { PULSE } from "@/components/pulse/theme";

type CallTarget = {
  customerId: number | null;
  customerName: string | null;
  toPhone: string;
};

type CallState =
  | { kind: "idle" }
  | { kind: "ringing"; target: CallTarget; startedAt: number }
  | { kind: "in_call"; target: CallTarget; startedAt: number }
  | { kind: "ending"; target: CallTarget; startedAt: number };

type PhoneContextValue = {
  ready: boolean;
  configured: boolean;
  configError: string | null;
  state: CallState;
  muted: boolean;
  startCall: (target: CallTarget) => Promise<void>;
  hangUp: () => void;
  toggleMute: () => void;
};

const PhoneContext = createContext<PhoneContextValue | null>(null);

export function usePhone(): PhoneContextValue {
  const ctx = useContext(PhoneContext);
  if (!ctx) {
    return {
      ready: false,
      configured: false,
      configError: null,
      state: { kind: "idle" },
      muted: false,
      startCall: async () => {
        throw new Error("PhoneClient not mounted");
      },
      hangUp: () => {},
      toggleMute: () => {},
    };
  }
  return ctx;
}

export default function PhoneClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [state, setState] = useState<CallState>({ kind: "idle" });
  const [muted, setMuted] = useState(false);

  const deviceRef = useRef<TwilioDevice | null>(null);
  const activeCallRef = useRef<TwilioCall | null>(null);

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      try {
        deviceRef.current?.destroy();
      } catch {
        // ignore
      }
      deviceRef.current = null;
    };
  }, []);

  const ensureDevice = useCallback(async () => {
    if (deviceRef.current) return deviceRef.current;
    setConfigError(null);
    const tokenRes = await fetch("/api/voice/token", { cache: "no-store" });
    if (!tokenRes.ok) {
      const data = (await tokenRes.json().catch(() => ({}))) as {
        error?: string;
      };
      setConfigured(false);
      setConfigError(data.error || `Could not get voice token (${tokenRes.status})`);
      throw new Error(data.error || "voice not configured");
    }
    const { token } = (await tokenRes.json()) as { token: string };

    const { Device } = await import("@twilio/voice-sdk");
    const device = new Device(token, {
      logLevel: 1,
      codecPreferences: ["opus" as never, "pcmu" as never],
    });

    device.on("registered", () => setReady(true));
    device.on("error", (err: { message?: string }) => {
      setConfigError(err?.message || "Voice device error");
    });
    device.on("tokenWillExpire", async () => {
      try {
        const r = await fetch("/api/voice/token", { cache: "no-store" });
        if (r.ok) {
          const data = (await r.json()) as { token: string };
          device.updateToken(data.token);
        }
      } catch {
        // ignore
      }
    });

    await device.register();
    deviceRef.current = device;
    setConfigured(true);
    return device;
  }, []);

  // Probe configuration on mount so the UI knows whether to show "Call" buttons.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/settings/voice", { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as { configured: boolean };
        if (!cancelled) setConfigured(!!data.configured);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startCall = useCallback(
    async (target: CallTarget) => {
      if (state.kind !== "idle") return;
      try {
        const device = await ensureDevice();
        const call = await device.connect({
          params: {
            To: target.toPhone,
            customer_id: target.customerId ? String(target.customerId) : "",
          },
        });
        activeCallRef.current = call;
        setMuted(false);
        setState({ kind: "ringing", target, startedAt: Date.now() });

        call.on("accept", () => {
          setState((prev) =>
            prev.kind === "ringing"
              ? { kind: "in_call", target: prev.target, startedAt: Date.now() }
              : prev
          );
        });
        call.on("disconnect", () => {
          activeCallRef.current = null;
          setState({ kind: "idle" });
          setMuted(false);
        });
        call.on("cancel", () => {
          activeCallRef.current = null;
          setState({ kind: "idle" });
        });
        call.on("error", () => {
          activeCallRef.current = null;
          setState({ kind: "idle" });
        });
      } catch (e) {
        setState({ kind: "idle" });
        throw e;
      }
    },
    [state.kind, ensureDevice]
  );

  const hangUp = useCallback(() => {
    const call = activeCallRef.current;
    if (call) {
      try {
        call.disconnect();
      } catch {
        // ignore
      }
    }
    setState((prev) =>
      prev.kind === "idle"
        ? prev
        : { kind: "ending", target: prev.target, startedAt: prev.startedAt }
    );
  }, []);

  const toggleMute = useCallback(() => {
    const call = activeCallRef.current;
    if (!call) return;
    const next = !muted;
    try {
      call.mute(next);
      setMuted(next);
    } catch {
      // ignore
    }
  }, [muted]);

  const value = useMemo<PhoneContextValue>(
    () => ({
      ready,
      configured,
      configError,
      state,
      muted,
      startCall,
      hangUp,
      toggleMute,
    }),
    [ready, configured, configError, state, muted, startCall, hangUp, toggleMute]
  );

  return (
    <PhoneContext.Provider value={value}>
      {children}
      <CallWidget />
    </PhoneContext.Provider>
  );
}

function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function CallWidget() {
  const { state, muted, hangUp, toggleMute } = usePhone();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (state.kind === "idle") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [state.kind]);

  if (state.kind === "idle") return null;

  const elapsed = now - state.startedAt;
  const status =
    state.kind === "ringing"
      ? "Ringing…"
      : state.kind === "ending"
      ? "Ending…"
      : formatDuration(elapsed);

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 bg-card text-fg rounded-2xl shadow-menu p-4">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: `${PULSE.green}1F`, color: PULSE.green }}
        >
          <PulseIcon name="phone" className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">
            {state.target.customerName || state.target.toPhone}
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-extrabold text-fg-subtle truncate">
            {state.target.customerName ? state.target.toPhone : status}
          </div>
        </div>
        <div className="text-[11px] uppercase tracking-[0.18em] font-extrabold text-fg-subtle tabular-nums">{status}</div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={toggleMute}
          disabled={state.kind !== "in_call"}
          className={
            "flex-1 text-xs rounded-full px-3 py-2 font-bold transition " +
            (muted
              ? "bg-amber-500 text-white hover:bg-amber-400"
              : "bg-line-strong hover:bg-line-strong/80 disabled:opacity-50")
          }
        >
          {muted ? "Unmute" : "Mute"}
        </button>
        <button
          type="button"
          onClick={hangUp}
          className="flex-1 text-xs rounded-full px-3 py-2 font-bold bg-red hover:bg-red/90 transition"
        >
          Hang up
        </button>
      </div>
    </div>
  );
}
