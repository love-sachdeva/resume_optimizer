"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession, listSessions, type StoredSession } from "@/lib/client-store";

export function DebugView() {
  const params = useSearchParams();
  const sessionId = params.get("session");
  const [session, setSession] = useState<StoredSession | null>(null);

  useEffect(() => {
    setSession(sessionId ? getSession(sessionId) : listSessions()[0] ?? null);
  }, [sessionId]);

  const jsonSections = useMemo(
    () =>
      session
        ? [
            {
              title: "Extracted resume JSON",
              body: JSON.stringify(session.analysis.resumeProfile, null, 2)
            },
            {
              title: "Extracted JD JSON",
              body: JSON.stringify(session.analysis.jobDescriptionProfile, null, 2)
            },
            {
              title: "Keyword overlap",
              body: JSON.stringify(
                {
                  overlap: session.analysis.matchAnalysis.keywordOverlap,
                  missing: session.analysis.matchAnalysis.missingKeywords
                },
                null,
                2
              )
            },
            {
              title: "Scoring breakdown",
              body: JSON.stringify(session.analysis.matchAnalysis.breakdown, null, 2)
            },
            {
              title: "Rewrite prompt",
              body: session.analysis.debugPrompts.rewrite
            }
          ]
        : [],
    [session]
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
      <div className="mb-8 space-y-3">
        <Badge>Admin / debug</Badge>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Inspect the extracted data and internal reasoning
        </h1>
        <p className="max-w-3xl text-black/65">
          This panel is for validation and development. It surfaces the structured profiles, overlap
          lists, scoring rubric output, and the prompt scaffolding used for rewrite generation.
        </p>
      </div>

      <div className="space-y-6">
        {jsonSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>Developer-facing inspection output.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-[24px] bg-ink p-5 text-sm text-bone/85">
                {section.body}
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
