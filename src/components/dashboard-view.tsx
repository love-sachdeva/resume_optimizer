"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, ShieldAlert, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SessionEmptyState } from "@/components/session-empty-state";
import { getSession, type StoredSession } from "@/lib/client-store";
import { formatPercent } from "@/lib/utils";

const breakdownLabels = [
  ["keyword", "Keyword match"],
  ["semantic", "Semantic alignment"],
  ["title", "Title and seniority"],
  ["domain", "Domain alignment"],
  ["quantifiedImpact", "Quantified impact"],
  ["hardFilters", "Hard filters"],
  ["readability", "ATS readability"]
] as const;

function breakdownReason(key: (typeof breakdownLabels)[number][0], session: StoredSession) {
  const { analysis } = session;
  const value = analysis.matchAnalysis.breakdown[key];
  const missing = analysis.matchAnalysis.missingKeywords.slice(0, 5).join(", ");
  const overlap = analysis.matchAnalysis.keywordOverlap.slice(0, 5).join(", ");

  const reasons: Record<typeof key, string> = {
    keyword: overlap
      ? `Matched ${overlap}${missing ? `; missing ${missing}` : ""}.`
      : "Limited exact keyword overlap with the JD.",
    semantic:
      analysis.matchAnalysis.strengths[0] ||
      "Based on overlap between JD responsibilities and resume experience clusters.",
    title: analysis.resumeProfile.experiences.some(
      (experience) =>
        analysis.jobDescriptionProfile.roleTitle &&
        experience.title.toLowerCase().includes(analysis.jobDescriptionProfile.roleTitle.toLowerCase())
    )
      ? "Past title is close to the target role."
      : "Past titles are adjacent, not an exact target-role match.",
    domain: analysis.jobDescriptionProfile.domainKeywords.length
      ? `Checked domain terms: ${analysis.jobDescriptionProfile.domainKeywords.slice(0, 4).join(", ")}.`
      : "JD has limited explicit domain language.",
    quantifiedImpact:
      "Rewards bullets with metrics, money, scale, conversion, time saved, and throughput.",
    hardFilters:
      analysis.matchAnalysis.redFlags[0] ||
      "Checks mandatory filters such as years, location, credentials, and role-defining requirements.",
    readability:
      "Checks parseable text, section clarity, bullet consistency, and ATS-friendly structure."
  };

  return `${Math.round(value)}/100. ${reasons[key]}`;
}

export function DashboardView() {
  const params = useSearchParams();
  const sessionId = params.get("session") ?? "";
  const [session, setSession] = useState<StoredSession | null>(null);

  useEffect(() => {
    setSession(getSession(sessionId));
  }, [sessionId]);

  if (!session) {
    return (
      <SessionEmptyState
        title="No analysis session found"
        description="Analyze a resume first to open the ATS dashboard."
      />
    );
  }

  const { analysis, source } = session;
  const baselineScore = Math.round(analysis.matchAnalysis.overallScore);
  const firstDraftScore = Math.round(analysis.improvedResume.estimatedScore);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Badge>Step 2</Badge>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Match report for {analysis.jobDescriptionProfile.roleTitle || "the target role"}
          </h1>
          <p className="max-w-3xl text-black/65">
            Actual ATS score is {baselineScore}/100. The first generated draft was rebuilt,
            parsed again, and rescored at {firstDraftScore}/100.
          </p>
          <p className="text-sm text-black/50">
            Runtime:{" "}
            {analysis.meta.runMode === "provider"
              ? `${analysis.meta.providerUsed} / ${analysis.meta.modelUsed}${
                  analysis.meta.fallbackUsed ? " (fallback applied)" : ""
                }`
              : "heuristic"}
          </p>
          <div className="flex flex-wrap gap-2">
            {analysis.meta.stages.resumeExtraction ? (
              <span className="rounded-full bg-black/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-black/55">
                AI resume extraction
              </span>
            ) : null}
            {analysis.meta.stages.jdExtraction ? (
              <span className="rounded-full bg-black/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-black/55">
                AI JD extraction
              </span>
            ) : null}
            {analysis.meta.stages.rewrite ? (
              <span className="rounded-full bg-black/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-black/55">
                AI rewrite
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-[30px] border border-black/10 bg-white/75 px-6 py-5 shadow-soft">
          <p className="text-sm uppercase tracking-[0.18em] text-black/45">Overall ATS score</p>
          <p className="font-display text-6xl font-semibold">{baselineScore}</p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-sm text-black/55">
              Source: <span className="font-medium uppercase">{source.originalFormat}</span>
            </p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                analysis.matchAnalysis.confidenceLevel === "high"
                  ? "bg-emerald-100 text-emerald-700"
                  : analysis.matchAnalysis.confidenceLevel === "medium"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {analysis.matchAnalysis.confidenceLevel} confidence
            </span>
          </div>
          <div className="mt-4 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-emerald-800/70">
              Rescored first draft
            </p>
            <div className="mt-2 flex items-end gap-3">
              <p className="font-display text-3xl font-semibold">{firstDraftScore}</p>
              <p className="pb-1 text-sm font-medium text-emerald-700">
                {analysis.improvedResume.scoreDelta >= 0 ? "+" : ""}
                {Math.round(analysis.improvedResume.scoreDelta)} pts
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Scoring breakdown</CardTitle>
            <CardDescription>Weighted factors behind the overall score.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {breakdownLabels.map(([key, label]) => {
              const value = analysis.matchAnalysis.breakdown[key];
              const colorClass =
                value >= 70 ? "text-emerald-600" : value >= 50 ? "text-amber-600" : "text-red-500";
              const reason = breakdownReason(key, session);
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{label}</span>
                    <span className={`font-medium ${colorClass}`}>{formatPercent(value)}</span>
                  </div>
                  <Progress value={value} />
                  <p className="text-xs leading-5 text-black/48" title={reason}>
                    {reason}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Choose the next step</CardTitle>
            <CardDescription>Pick the amount of help you need for this application.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              {
                href: `/improve?session=${session.id}`,
                title: "Resume-only improvement",
                body: "Sharpen the current resume without asking for more context.",
                icon: ArrowRight
              },
              {
                href: `/questionnaire?session=${session.id}`,
                title: "Deep improvement",
                body: "Answer profile questions and tailor harder for the role.",
                icon: Sparkles
              }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.title} href={item.href}>
                  <div className="rounded-[24px] border border-black/10 bg-white/72 p-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-medium">{item.title}</p>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm text-black/62">{item.body}</p>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
        {[
          {
            title: "What is missing",
            icon: AlertTriangle,
            items: analysis.matchAnalysis.gaps
          },
          {
            title: "Deal breakers",
            icon: ShieldAlert,
            items:
              analysis.matchAnalysis.redFlags.length > 0
                ? analysis.matchAnalysis.redFlags
                : ["No explicit hard-filter blocker was detected from the resume and JD."]
          }
        ].map((block) => {
          const Icon = block.icon;
          return (
            <Card key={block.title}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Icon className="h-5 w-5" />
                  {block.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {block.items.slice(0, 5).map((item) => (
                  <div
                    key={item}
                    className="rounded-[18px] border border-black/10 bg-white/70 p-3 text-sm leading-6 text-black/70"
                  >
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
