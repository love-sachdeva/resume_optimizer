import { Suspense } from "react";

import { ProfileView } from "@/components/profile-view";
import { SiteHeader } from "@/components/site-header";

export default function ProfilePage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <Suspense fallback={null}>
        <ProfileView />
      </Suspense>
    </main>
  );
}
