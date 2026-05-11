import { Suspense } from "react";

import { ExportView } from "@/components/export-view";
import { SiteHeader } from "@/components/site-header";

export default function ExportPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Suspense fallback={null}>
        <ExportView />
      </Suspense>
    </main>
  );
}
