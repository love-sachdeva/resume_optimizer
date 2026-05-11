import { Suspense } from "react";

import { QuestionnaireView } from "@/components/questionnaire-view";
import { SiteHeader } from "@/components/site-header";

export default function QuestionnairePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Suspense fallback={null}>
        <QuestionnaireView />
      </Suspense>
    </main>
  );
}
