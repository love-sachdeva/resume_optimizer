"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 rounded-full bg-red-50 p-4 text-red-600">
        <AlertCircle className="h-10 w-10" />
      </div>
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-ink">Something went wrong</h1>
      <p className="mb-8 max-w-md text-black/60">
        An unexpected error occurred. We've been notified and are looking into it.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()} className="rounded-full">
          <RefreshCcw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button variant="outline" onClick={() => window.location.href = "/"} className="rounded-full">
          Back to home
        </Button>
      </div>
      {error.digest && (
         <p className="mt-8 text-[10px] text-black/20 font-mono">Error ID: {error.digest}</p>
      )}
    </div>
  );
}
