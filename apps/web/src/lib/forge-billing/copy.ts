const DORMANT_COPY = {
  signup: "Start your free trial. No credit card required.",
  marketing: "Free trial. No credit card. Cancel any time.",
  login: "for a free trial.",
} as const;

export function forgeCutoffLabel(cutoffAt: string): string {
  const cutoff = new Date(cutoffAt);
  if (!Number.isFinite(cutoff.getTime())) return "the shared access cutoff";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(cutoff);
}

export function forgePublicAccessCopy(enabled: boolean, cutoffAt: string) {
  if (!enabled) return DORMANT_COPY;
  const cutoff = forgeCutoffLabel(cutoffAt);
  return {
    signup: `Create your company with shared access until ${cutoff}. No credit card is required today.`,
    marketing: `Shared access is available until ${cutoff}. A company subscription is required at the cutoff.`,
    login: `with shared access until ${cutoff}.`,
  };
}
