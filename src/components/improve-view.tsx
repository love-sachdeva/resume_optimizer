"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Download,
  FileArchive,
  FileText,
  LoaderCircle,
  Shuffle,
  TrendingUp,
  Wand2
} from "lucide-react";

import { useAppSettings } from "@/lib/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SessionEmptyState } from "@/components/session-empty-state";
import { Switch } from "@/components/ui/switch";
import {
  dataUrlToFile,
  downloadBlob,
  getSession,
  updateSession,
  type StoredSession
} from "@/lib/client-store";
import type { FormattingPreferences, GeneratedResume } from "@/lib/schemas";

function wordDiff(original: string, improved: string, side: "original" | "improved") {
  const normalizeWord = (word: string) => word.toLowerCase().replace(/[^\w%₹.+-]/g, "");
  const originalWords = new Set(original.toLowerCase().split(/\s+/).map(normalizeWord).filter(Boolean));
  const improvedWords = new Set(improved.toLowerCase().split(/\s+/).map(normalizeWord).filter(Boolean));
  const words = (side === "original" ? original : improved).split(/(\s+)/);

  return words.map((word, index): ReactNode => {
    if (!word.trim()) return word;
    const key = normalizeWord(word);
    const changed = side === "original" ? !improvedWords.has(key) : !originalWords.has(key);
    if (!changed) return word;

    return (
      <mark
        key={`${word}-${index}`}
        className={
          side === "original"
            ? "rounded bg-red-100 px-1 text-red-800"
            : "rounded bg-emerald-100 px-1 text-emerald-800"
        }
      >
        {word}
      </mark>
    );
  });
}

export function ImproveView() {
  const router = useRouter();
  const settings = useAppSettings();
  const params = useSearchParams();
  const sessionId = params.get("session") ?? "";
  const [session, setSession] = useState<StoredSession | null>(null);
  const [keepSameFormat, setKeepSameFormat] = useState(true);
  const [onePage, setOnePage] = useState(true);
  const [tone, setTone] = useState<FormattingPreferences["tone"]>("balanced");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);

  useEffect(() => {
    const nextSession = getSession(sessionId);
    setSession(nextSession);
    if (nextSession) {
      setKeepSameFormat(nextSession.analysis.resumeProfile.formattingPreferences.keepSameFormat);
      setOnePage(nextSession.analysis.resumeProfile.formattingPreferences.onePage);
      setTone(nextSession.analysis.resumeProfile.formattingPreferences.tone);
    }
  }, [sessionId]);

  async function rerunImprove() {
    if (!session) return;

    setIsPending(true);
    setError("");
    setInfo("");

    try {
      const response = await fetch("/api/improve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          resumeText: session.source.resumeText,
          jobText: session.source.jobText,
          answers: session.answers,
          preferences: {
            keepSameFormat,
            onePage,
            tone,
            formatMode: keepSameFormat ? "same-format" : "ats-optimized"
          },
          providerConfig: settings.provider
        })
      });
      const payload = (await response.json()) as GeneratedResume | { error?: string };

      if (!response.ok) {
        throw new Error(("error" in payload && payload.error) || "Failed to improve resume.");
      }

      const improvedPayload = payload as GeneratedResume;
      const updated = updateSession(session.id, (current) => ({
        ...current,
        improvedResume: improvedPayload,
        analysis: {
          ...current.analysis,
          resumeProfile: {
            ...current.analysis.resumeProfile,
            formattingPreferences: {
              ...current.analysis.resumeProfile.formattingPreferences,
              keepSameFormat,
              onePage,
              tone,
              formatMode: keepSameFormat ? "same-format" : "ats-optimized"
            }
          }
        }
      }));

      setSession(updated);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to improve resume.");
    } finally {
      setIsPending(false);
    }
  }

  async function exportDocx() {
    if (!session) return;

    setDocxLoading(true);
    setError("");
    setInfo("");

    try {
      const formData = new FormData();
      if (session.source.resumeDocxDataUrl) {
        formData.append(
          "templateFile",
          dataUrlToFile(session.source.resumeDocxDataUrl, session.source.resumeFileName)
        );
      }
      formData.append("originalText", session.source.resumeText);
      formData.append("exportText", session.improvedResume.exportText);
      formData.append("lineDiffs", JSON.stringify(session.improvedResume.lineDiffs));
      formData.append("onePage", String(session.analysis.resumeProfile.formattingPreferences.onePage));
      formData.append("candidateName", session.analysis.resumeProfile.identity.name);
      formData.append(
        "companyName",
        session.analysis.jobDescriptionProfile.company ||
          session.analysis.jobDescriptionProfile.roleTitle
      );

      const response = await fetch("/api/export/docx", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to export DOCX.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileName = disposition.match(/filename="(.+)"/)?.[1] ?? "thankyoulove.docx";
      downloadBlob(blob, fileName);
      setInfo("DOCX exported. PDF remains disabled until exact DOCX-to-PDF conversion is available.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to export DOCX.");
    } finally {
      setDocxLoading(false);
    }
  }

  if (!session) {
    return (
      <SessionEmptyState
        title="No resume session found"
        description="Run an analysis first to open resume-only improvement."
      />
    );
  }

  const changedDiffs = session.improvedResume.lineDiffs.filter(
    (diff) => diff.original !== diff.improved
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Badge>Step 3</Badge>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Resume-only improvement
          </h1>
          <p className="max-w-3xl text-black/65">
            The draft below only rewrites supported lines. It keeps dates, titles, companies, and
            structure intact, then rescoring happens on the generated draft.
          </p>
          <p className="text-sm text-black/50">
            Runtime:{" "}
            {settings.provider.enabled && settings.provider.apiKey
              ? `${settings.provider.provider} / ${settings.provider.model || "default"}`
              : "heuristic fallback"}
          </p>
        </div>

        <div className="rounded-[28px] border border-black/10 bg-white/80 px-5 py-4">
          <p className="text-sm uppercase tracking-[0.18em] text-black/45">Actual ATS change</p>
          <div className="mt-2 flex items-end gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-black/42">Before</p>
              <p className="font-display text-4xl font-semibold">
                {Math.round(session.analysis.matchAnalysis.overallScore)}
              </p>
            </div>
            <ArrowRight className="mb-2 h-5 w-5 text-black/35" />
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-black/42">After</p>
              <p className="font-display text-5xl font-semibold">
                {Math.round(session.improvedResume.estimatedScore)}
              </p>
            </div>
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <TrendingUp className="h-4 w-4" />
            {session.improvedResume.scoreDelta >= 0 ? "+" : ""}
            {Math.round(session.improvedResume.scoreDelta)} points
          </p>
          <Progress value={session.improvedResume.estimatedScore} className="mt-3 w-48" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Rewrite controls</CardTitle>
            <CardDescription>Use these only if you want to rebuild the draft.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-[22px] border border-black/10 bg-white/70 p-4">
              <div>
                <p className="font-medium">Keep same format</p>
                <p className="text-sm text-black/55">Use the original structure as the target frame.</p>
              </div>
              <Switch checked={keepSameFormat} onCheckedChange={setKeepSameFormat} />
            </div>
            <div className="flex items-center justify-between rounded-[22px] border border-black/10 bg-white/70 p-4">
              <div>
                <p className="font-medium">One-page output</p>
                <p className="text-sm text-black/55">Compress content to a single-page draft.</p>
              </div>
              <Switch checked={onePage} onCheckedChange={setOnePage} />
            </div>
            <div className="rounded-[22px] border border-black/10 bg-white/70 p-4">
              <p className="mb-3 font-medium">Tone</p>
              <div className="flex flex-wrap gap-2">
                {(["conservative", "balanced", "aggressive"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTone(option)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      tone === option ? "bg-ink text-bone" : "bg-black/5 text-black/65"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={rerunImprove} disabled={isPending} className="w-full">
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Rebuild improvement
            </Button>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resume diff</CardTitle>
            <CardDescription>
              Original is on the left. Improved wording is on the right. Changed words are highlighted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {changedDiffs.length ? (
              changedDiffs.slice(0, 24).map((diff, index) => (
                <div
                  key={`${diff.section}-${index}`}
                  className="grid gap-4 rounded-[24px] border border-black/10 bg-white/72 p-4 md:grid-cols-2"
                >
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.16em] text-red-500">Original</p>
                    <p className="text-sm leading-6 text-black/72">
                      {wordDiff(diff.original, diff.improved, "original")}
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.16em] text-emerald-600">Improved</p>
                    <p className="text-sm font-medium leading-6 text-black/82">
                      {wordDiff(diff.original, diff.improved, "improved")}
                    </p>
                  </div>
                  <div className="col-span-full border-t border-black/5 pt-3 text-xs text-black/42">
                    {diff.section}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-black/10 bg-white/70 p-8 text-sm text-black/60">
                No changed lines are available yet. Rebuild the improvement or add deeper context.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  router.push(
                    `/profile?tab=questions&next=${encodeURIComponent(`/questionnaire?session=${session.id}`)}`
                  )
                }
              >
                <Shuffle className="h-4 w-4" />
                Add deeper context
              </Button>
              <Button onClick={() => setShowExport((current) => !current)}>
                Continue to export
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {showExport ? (
              <div className="rounded-[28px] border border-black/10 bg-white/80 p-5">
                <p className="font-medium">Download final files</p>
                <p className="mt-1 text-sm text-black/55">
                  DOCX uses the uploaded DOCX as a template when available. PDF stays disabled until
                  exact DOCX-to-PDF rendering is available.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Button onClick={exportDocx} disabled={docxLoading} className="justify-between">
                    {docxLoading ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileArchive className="h-4 w-4" />
                    )}
                    Export DOCX
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" disabled className="justify-between">
                    <FileText className="h-4 w-4" />
                    PDF unavailable
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                {info ? <p className="mt-3 text-sm text-emerald-700">{info}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
