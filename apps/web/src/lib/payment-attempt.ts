// Browser-only attempt state. Generate lazily so server rendering never creates
// a payment key; retain the same key until the material details change or succeed.
export function createPaymentAttempt() {
  let current: { details: string; key: string } | null = null;
  return {
    keyFor(details: string): string {
      if (!current || current.details !== details) {
        current = { details, key: crypto.randomUUID() };
      }
      return current.key;
    },
    reset() {
      current = null;
    },
  };
}
