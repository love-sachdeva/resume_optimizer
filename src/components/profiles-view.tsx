"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Clock3, FileStack } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { SectionLabel } from "@/components/site/section-label";
import { listSessions, type StoredSession } from "@/lib/client-store";

export function ProfilesView() {
  const [sessions, setSessions] = useState<StoredSession[]>([]);

  useEffect(() => {
    setSessions(listSessions());
  }, []);

  return (
    <div className="relative mx-auto max-w-7xl px-6 py-12 lg:px-10">
      <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 bg-primary/10 blur-3xl" />
      <div className="mb-8 space-y-3">
        <SectionLabel index="06">Saved profiles</SectionLabel>
        <h1 className="mid-type max-w-4xl text-4xl font-semibold tracking-tight">
          Reuse previous optimization runs
        </h1>
        <p className="max-w-3xl text-foreground/65">
          Every session stores the parsed resume, the JD profile, the current answers, and the
          improved draft so repeat applications are faster.
        </p>
      </div>

      <div className="overflow-hidden border-2 border-foreground/35 bg-card">
        {sessions.map((session) => (
          <Link
            key={session.id}
            href={`/dashboard?session=${session.id}`}
            className="grid gap-4 border-b-2 border-foreground/10 p-5 transition hover:bg-primary/10 md:grid-cols-[1.1fr_0.8fr_0.45fr_auto] md:items-center"
          >
            <div>
              <p className="font-semibold text-foreground">
                {session.analysis.jobDescriptionProfile.company ||
                  session.analysis.jobDescriptionProfile.roleTitle ||
                  "Untitled session"}
              </p>
              <p className="mt-1 text-sm text-foreground/55">
                {session.analysis.resumeProfile.identity.name || "Candidate"} ·{" "}
                {session.analysis.jobDescriptionProfile.roleTitle || "Target role"}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground/60">
              <Clock3 className="h-4 w-4" />
              {new Date(session.updatedAt).toLocaleString()}
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <FileStack className="h-4 w-4" />
              {Math.round(session.analysis.matchAnalysis.overallScore)} {"->"}{" "}
              {Math.round(session.improvedResume.estimatedScore)}
            </div>
            <span className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>

      {!sessions.length ? (
        <Card>
          <CardContent className="p-8">
            <p className="text-foreground/65">No saved sessions yet. Analyze a resume first.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
