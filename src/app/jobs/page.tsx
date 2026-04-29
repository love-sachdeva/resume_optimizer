import { JobsView } from "@/components/jobs-view";
import { SiteHeader } from "@/components/site-header";

export default function JobsPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <JobsView />
    </main>
  );
}
