import { Suspense } from "react";

import { AccountView } from "@/components/account-view";
import { SiteHeader } from "@/components/site-header";

export default function AccountPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Suspense fallback={null}>
        <AccountView />
      </Suspense>
    </main>
  );
}
