import { Suspense } from "react";

import { DashboardView } from "@/components/dashboard-view";
import { SiteHeader } from "@/components/site-header";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Suspense fallback={null}>
        <DashboardView />
      </Suspense>
    </main>
  );
}
