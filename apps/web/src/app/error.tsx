"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center max-w-md">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
          Something went wrong
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">
          We hit an unexpected error
        </h1>
        <p className="mt-3 text-gray-600">
          The team has been notified. Try again, or head back home if it keeps
          happening.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-gray-400">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Home
          </a>
        </div>
      </div>
    </main>
  );
}
