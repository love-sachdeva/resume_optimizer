import { Suspense } from "react";

import { DebugView } from "@/components/debug-view";
import { SiteHeader } from "@/components/site-header";

export default function DebugPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <Suspense fallback={null}>
        <DebugView />
      </Suspense>
    </main>
  );
}
