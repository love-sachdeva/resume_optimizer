"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Clock3, FileStack } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listSessions, type StoredSession } from "@/lib/client-store";

export function ProfilesView() {
  const [sessions, setSessions] = useState<StoredSession[]>([]);

  useEffect(() => {
    setSessions(listSessions());
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
      <div className="mb-8 space-y-3">
        <Badge>Saved profiles</Badge>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Reuse answers and previous optimization runs
        </h1>
        <p className="max-w-3xl text-black/65">
          Every session stores the parsed resume, the JD profile, the current answers, and the
          improved draft so repeat applications are faster.
        </p>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-black/10 bg-white/78 shadow-soft">
        {sessions.map((session) => (
          <Link
            key={session.id}
            href={`/dashboard?session=${session.id}`}
            className="grid gap-4 border-b border-black/5 p-5 transition hover:bg-black/[0.025] md:grid-cols-[1.1fr_0.8fr_0.45fr_auto] md:items-center"
          >
            <div>
              <p className="font-semibold text-ink">
                {session.analysis.jobDescriptionProfile.company ||
                  session.analysis.jobDescriptionProfile.roleTitle ||
                  "Untitled session"}
              </p>
              <p className="mt-1 text-sm text-black/55">
                {session.analysis.resumeProfile.identity.name || "Candidate"} ·{" "}
                {session.analysis.jobDescriptionProfile.roleTitle || "Target role"}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-black/60">
              <Clock3 className="h-4 w-4" />
              {new Date(session.updatedAt).toLocaleString()}
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-black/70">
              <FileStack className="h-4 w-4" />
              {Math.round(session.analysis.matchAnalysis.overallScore)} {"->"}{" "}
              {Math.round(session.improvedResume.estimatedScore)}
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-bone">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>

      {!sessions.length ? (
        <Card>
          <CardContent className="p-8">
            <p className="text-black/65">No saved sessions yet. Analyze a resume first.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
