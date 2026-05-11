"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SessionEmptyState } from "@/components/session-empty-state";
import { SectionLabel } from "@/components/site/section-label";
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
    <div className="relative mx-auto max-w-7xl overflow-hidden px-6 py-12 lg:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_80%_0%,hsl(var(--primary)/0.10),transparent_60%)]" />
      <div className="relative mb-8 flex flex-wrap items-start justify-between gap-6 border-b border-foreground/15 pb-8 animate-fade-in">
        <div className="space-y-3">
          <SectionLabel index="02">Resume analysis</SectionLabel>
          <h1 className="mid-type max-w-5xl text-balance">
            Match report for <span className="text-primary">{analysis.jobDescriptionProfile.roleTitle || "the target role"}</span>
          </h1>
          <p className="max-w-3xl text-foreground/65">
            Actual ATS score is {baselineScore}/100. The first generated draft was rebuilt,
            parsed again, and rescored at {firstDraftScore}/100.
          </p>
          <p className="text-sm text-foreground/50">
            Runtime:{" "}
            {analysis.meta.runMode === "provider"
              ? `${analysis.meta.providerUsed} / ${analysis.meta.modelUsed}${
                  analysis.meta.fallbackUsed ? " (fallback applied)" : ""
                }`
              : "heuristic"}
          </p>
          <div className="flex flex-wrap gap-2">
            {analysis.meta.stages.resumeExtraction ? (
              <span className="mono border border-foreground/15 bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground/60">
                AI resume extraction
              </span>
            ) : null}
            {analysis.meta.stages.jdExtraction ? (
              <span className="mono border border-foreground/15 bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground/60">
                AI JD extraction
              </span>
            ) : null}
            {analysis.meta.stages.rewrite ? (
              <span className="mono border border-foreground/15 bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground/60">
                AI rewrite
              </span>
            ) : null}
          </div>
        </div>

        <div className="min-w-[260px] border-2 border-primary bg-primary px-6 py-5 text-primary-foreground">
          <p className="mono text-[10px] uppercase tracking-[0.18em] opacity-75">Overall ATS score</p>
          <p className="display text-7xl">{baselineScore}</p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-sm opacity-80">
              Source: <span className="font-medium uppercase">{source.originalFormat}</span>
            </p>
            <span
              className={`border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                analysis.matchAnalysis.confidenceLevel === "high"
                  ? "border-primary-foreground/50 bg-primary-foreground text-primary"
                  : analysis.matchAnalysis.confidenceLevel === "medium"
                    ? "border-primary-foreground/50 bg-primary-foreground/20 text-primary-foreground"
                    : "border-primary-foreground bg-primary-foreground text-primary"
              }`}
            >
              {analysis.matchAnalysis.confidenceLevel} confidence
            </span>
          </div>
          <div className="mt-4 border border-primary-foreground/35 bg-primary-foreground/10 px-4 py-3">
            <p className="mono text-[10px] uppercase tracking-[0.16em] opacity-75">
              Rescored first draft
            </p>
            <div className="mt-2 flex items-end gap-3">
              <p className="display text-4xl">{firstDraftScore}</p>
              <p className="pb-1 text-sm font-medium">
                {analysis.improvedResume.scoreDelta >= 0 ? "+" : ""}
                {Math.round(analysis.improvedResume.scoreDelta)} pts
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <Card className="animate-rise-in bg-background">
          <CardHeader>
            <CardTitle>Scoring breakdown</CardTitle>
            <CardDescription>Weighted factors behind the overall score.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {breakdownLabels.map(([key, label]) => {
              const value = analysis.matchAnalysis.breakdown[key];
              const colorClass =
                value >= 70 ? "text-primary" : value >= 50 ? "text-foreground" : "text-primary";
              const reason = breakdownReason(key, session);
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{label}</span>
                    <span className={`font-medium ${colorClass}`}>{formatPercent(value)}</span>
                  </div>
                  <Progress value={value} />
                  <p className="text-xs leading-5 text-foreground/48" title={reason}>
                    {reason}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="animate-rise-in overflow-hidden bg-background [animation-delay:80ms]">
          <CardHeader>
            <CardTitle>Next step</CardTitle>
            <CardDescription>Open the same-format resume rewrite for this application.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              {
                href: `/improve?session=${session.id}`,
                title: "Resume-only improvement",
                body: "Sharpen the current resume without asking for more context.",
                icon: ArrowRight
              }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.title} href={item.href}>
                  <div className="border border-foreground/15 bg-background p-4 transition hover:border-primary hover:bg-primary hover:text-primary-foreground">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-medium">{item.title}</p>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm opacity-70">{item.body}</p>
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
            <Card key={block.title} className="animate-rise-in bg-background [animation-delay:140ms]">
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
                    className="border border-foreground/15 bg-primary/10 p-3 text-sm leading-6 text-foreground/70"
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
