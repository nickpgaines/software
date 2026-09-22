const DORMANT_COPY = {
  signup: "Start your free trial. No credit card required.",
  marketing: "Free trial. No credit card. Cancel any time.",
  login: "for a free trial.",
} as const;

export function forgeTrialEndLabel(trialEndsAt: string): string {
  const ends = new Date(trialEndsAt);
  if (!Number.isFinite(ends.getTime())) return "the end of your trial";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(ends);
}

export function forgePublicAccessCopy(enabled: boolean) {
  if (!enabled) return DORMANT_COPY;
  return {
    signup: "Start your company's 14-day free trial. No credit card required.",
    marketing: "14-day free trial for new companies. No credit card required.",
    login: "for a 14-day company trial.",
  };
}
