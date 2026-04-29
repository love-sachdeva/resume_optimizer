import { Suspense } from "react";

import { ImproveView } from "@/components/improve-view";
import { SiteHeader } from "@/components/site-header";

export default function ImprovePage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <Suspense fallback={null}>
        <ImproveView />
      </Suspense>
    </main>
  );
}
