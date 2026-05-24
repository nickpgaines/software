"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-page-title text-white">Something went wrong</h1>
          <p className="text-sm text-zinc-400 mt-3 font-bold">
            An unexpected error stopped this page from loading.
          </p>
        </div>
        <div className="bg-card border border-line rounded-2xl p-6 space-y-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => reset()}
            className="w-full h-auto bg-white hover:bg-zinc-200 text-black rounded-lg py-2.5 text-sm font-extrabold tracking-tight"
          >
            Try again
          </Button>
          <Button
            asChild
            variant="ghost"
            className="w-full h-auto bg-card border border-line hover:bg-black text-white rounded-lg py-2.5 text-sm font-extrabold tracking-tight"
          >
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
