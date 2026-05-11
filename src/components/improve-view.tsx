"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Download,
  FileArchive,
  FileText,
  LoaderCircle,
  TrendingUp,
  Wand2
} from "lucide-react";

import { useAppSettings } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionEmptyState } from "@/components/session-empty-state";
import { SectionLabel } from "@/components/site/section-label";
import { ResumeDiffViewer } from "@/components/resume-diff-viewer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  dataUrlToFile,
  downloadBlob,
  getSession,
  updateSession,
  type StoredSession
} from "@/lib/client-store";
import type { FormattingPreferences, GeneratedResume } from "@/lib/schemas";

export function ImproveView() {
  const settings = useAppSettings();
  const params = useSearchParams();
  const sessionId = params.get("session") ?? "";
  const [session, setSession] = useState<StoredSession | null>(null);
  const [tone, setTone] = useState<FormattingPreferences["tone"]>("balanced");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const nextSession = getSession(sessionId);
    setSession(nextSession);
    if (nextSession) {
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
            keepSameFormat: true,
            onePage: true,
            tone,
            formatMode: "same-format"
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
              keepSameFormat: true,
              onePage: true,
              tone,
              formatMode: "same-format"
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
      formData.append("skillsDiff", JSON.stringify(session.improvedResume.rewritePlan?.skillsDiff ?? null));
      formData.append("layoutHints", JSON.stringify(session.improvedResume.layoutInventory ?? null));
      formData.append("qualityMode", session.improvedResume.rewritePlan?.fitStrategy ?? "visual-fit-first");
      formData.append("onePage", "true");
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
      setInfo("DOCX exported successfully.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to export DOCX.");
    } finally {
      setDocxLoading(false);
    }
  }

  async function exportPdf() {
    if (!session) return;

    setPdfLoading(true);
    setError("");
    setInfo("");

    try {
      // First export as DOCX, then convert
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
      formData.append("skillsDiff", JSON.stringify(session.improvedResume.rewritePlan?.skillsDiff ?? null));
      formData.append("layoutHints", JSON.stringify(session.improvedResume.layoutInventory ?? null));
      formData.append("qualityMode", session.improvedResume.rewritePlan?.fitStrategy ?? "visual-fit-first");
      formData.append("onePage", "true");
      formData.append("candidateName", session.analysis.resumeProfile.identity.name);
      formData.append(
        "companyName",
        session.analysis.jobDescriptionProfile.company ||
        session.analysis.jobDescriptionProfile.roleTitle
      );

      // Try to use PDF API if available
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        // Fallback: export DOCX and show message
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "PDF export is not yet available. Please export as DOCX.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileName = disposition.match(/filename="(.+)"/)?.[1] ?? "thankyoulove.pdf";
      downloadBlob(blob, fileName);
      setInfo("PDF exported successfully.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "PDF export failed.");
    } finally {
      setPdfLoading(false);
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

  return (
    <div className="relative min-w-0 overflow-x-hidden px-6 py-8 lg:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_20%_0%,hsl(var(--primary)/0.06),transparent_58%)]" />

      {/* Compact header with ATS score */}
      <motion.div
        className="relative mb-6 grid gap-4 border-b border-foreground/15 pb-6 md:grid-cols-[1fr_auto] md:items-start"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div>
          <SectionLabel index="03">Resume-only improvement</SectionLabel>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Rewrite only what the resume <span className="text-primary">supports.</span>
          </h1>
          <p className="mt-2 text-sm text-foreground/65">
            Rewrites supported lines only. Dates, titles, companies, and structure stay intact.
          </p>
        </div>

        <motion.div
          className="min-w-[200px] border-2 border-primary bg-primary px-5 py-4 text-primary-foreground shadow-soft"
          animate={
            reduceMotion
              ? undefined
              : {
                boxShadow: [
                  "10px 10px 0 hsl(var(--foreground) / 0.08)",
                  "12px 16px 0 hsl(var(--foreground) / 0.11)",
                  "10px 10px 0 hsl(var(--foreground) / 0.08)"
                ]
              }
          }
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p className="mono text-[10px] uppercase tracking-[0.22em] opacity-75">ATS change</p>
          <div className="mt-1 flex items-end gap-3">
            <div>
              <p className="mono text-[9px] uppercase tracking-[0.16em] opacity-70">Before</p>
              <p className="display text-4xl">
                {Math.round(session.analysis.matchAnalysis.overallScore)}
              </p>
            </div>
            <ArrowRight className="mb-2 h-4 w-4 opacity-60" />
            <div>
              <p className="mono text-[9px] uppercase tracking-[0.16em] opacity-70">After</p>
              <p className="display text-5xl">
                {Math.round(session.improvedResume.estimatedScore)}
              </p>
            </div>
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs font-medium">
            <TrendingUp className="h-3 w-3" />
            {session.improvedResume.scoreDelta >= 0 ? "+" : ""}
            {Math.round(session.improvedResume.scoreDelta)} points
          </p>
        </motion.div>
      </motion.div>

      {/* Action bar at top - Export + Rebuild */}
      <motion.div
        className="mb-6 flex flex-wrap items-center justify-between gap-3 border-2 border-foreground p-4"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2">
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-foreground/50">
            Format: Same · One page · Tone: {tone}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={rerunImprove} disabled={isPending} variant="outline" size="sm">
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Rebuild
          </Button>
          <Button onClick={() => setExportOpen(true)} size="sm">
            Continue to export
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {info ? <p className="mb-4 text-sm text-emerald-700">{info}</p> : null}

      {/* Resume diff */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resume changes</CardTitle>
            <CardDescription className="text-xs">
              Left is the uploaded resume text. Right is the optimized same-format version.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResumeDiffViewer
              originalText={session.source.resumeText}
              improvedText={session.improvedResume.exportText}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Export resume</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-foreground/65">
              Download your optimized resume. DOCX preserves the original template formatting when available.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <Button onClick={exportDocx} disabled={docxLoading} className="justify-between">
                {docxLoading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <FileArchive className="h-4 w-4" />
                )}
                Export DOCX
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={exportPdf} disabled={pdfLoading} className="justify-between">
                {pdfLoading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Export PDF
                <Download className="h-4 w-4" />
              </Button>
            </div>
            {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
