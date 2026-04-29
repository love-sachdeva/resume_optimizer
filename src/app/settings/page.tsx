import { Suspense } from "react";

import { SettingsView } from "@/components/settings-view";
import { SiteHeader } from "@/components/site-header";

export default function SettingsPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <Suspense fallback={null}>
        <SettingsView />
      </Suspense>
    </main>
  );
}
