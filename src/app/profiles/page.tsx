import { ProfilesView } from "@/components/profiles-view";
import { SiteHeader } from "@/components/site-header";

export default function ProfilesPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <ProfilesView />
    </main>
  );
}
