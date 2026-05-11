import { Suspense } from "react";

import { SiteHeader } from "@/components/site-header";
import { UploadWorkspace } from "@/components/upload-workspace";

export default function UploadPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Suspense fallback={null}>
        <UploadWorkspace />
      </Suspense>
    </main>
  );
}
