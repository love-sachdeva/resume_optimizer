import { Suspense } from "react";

import { ProfileView } from "@/components/profile-view";
import { SiteHeader } from "@/components/site-header";

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Suspense fallback={null}>
        <ProfileView />
      </Suspense>
    </main>
  );
}
