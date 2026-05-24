/**
 * Forge brand mark — the F icon. Used wherever the wordmark would
 * otherwise read "Forge" (marketing header, footer, etc).
 *
 * The path is the canonical F mark introduced alongside the Sidebar
 * brand mark (see `apps/web/src/components/pulse/Sidebar.tsx`). Both
 * surfaces draw from the same path so any future tweaks to the mark
 * stay aligned.
 */
export function ForgeMark({
  size = "default",
  className = "",
}: {
  size?: "default" | "lg";
  className?: string;
}) {
  const sizeClass =
    size === "lg"
      ? "w-12 h-12 md:w-14 md:h-14"
      : "w-9 h-9";
  return (
    <svg
      viewBox="0 0 128 128"
      className={`${sizeClass} flex-shrink-0 ${className}`}
      fill="currentColor"
      aria-label="Forge"
    >
      <path d="M32 16 L92 16 L112 36 L52 36 L52 54 L88 54 L70 72 L52 72 L52 92 L32 112 Z" />
    </svg>
  );
}
