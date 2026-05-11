import { SiteHeader } from "@/components/site-header";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <DashboardLayout>
        {/* The DashboardLayout handles its own internal tabs for now */}
      </DashboardLayout>
    </main>
  );
}
