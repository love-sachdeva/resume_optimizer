"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, FileArchive, FileText, LoaderCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResumePreview } from "@/components/resume-preview";
import { SectionLabel } from "@/components/site/section-label";
import { SessionEmptyState } from "@/components/session-empty-state";
import { dataUrlToFile, downloadBlob, getSession, type StoredSession } from "@/lib/client-store";

export function ExportView() {
  const params = useSearchParams();
  const sessionId = params.get("session") ?? "";
  const [session, setSession] = useState<StoredSession | null>(null);
  const [docxLoading, setDocxLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const pdfExportAvailable = true;

  useEffect(() => {
    setSession(getSession(sessionId));
  }, [sessionId]);

  if (!session) {
    return (
      <SessionEmptyState
        title="No export session found"
        description="Generate an improved resume first, then return here to export the DOCX."
      />
    );
  }

  async function exportDocx() {
    if (!session) {
      return;
    }
    const activeSession = session;
    setDocxLoading(true);
    setError("");
    setInfo("");

    try {
      const formData = new FormData();
      if (activeSession.source.resumeDocxDataUrl) {
        formData.append(
          "templateFile",
          dataUrlToFile(activeSession.source.resumeDocxDataUrl, activeSession.source.resumeFileName)
        );
      }
      formData.append("originalText", activeSession.source.resumeText);
      formData.append("exportText", activeSession.improvedResume.exportText);
      formData.append("lineDiffs", JSON.stringify(activeSession.improvedResume.lineDiffs));
      formData.append(
        "onePage",
        String(activeSession.analysis.resumeProfile.formattingPreferences.onePage)
      );
      formData.append("candidateName", activeSession.analysis.resumeProfile.identity.name);
      formData.append(
        "companyName",
        activeSession.analysis.jobDescriptionProfile.company ||
          activeSession.analysis.jobDescriptionProfile.roleTitle
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

      const templatePreserved = response.headers.get("X-Template-Preserved") === "true";
      const rowsRemoved = Number(response.headers.get("X-Trailing-Blank-Rows-Removed") ?? "0");
      const patchedLines = Number(response.headers.get("X-Patched-Lines") ?? "0");
      const compressedLines = Number(response.headers.get("X-Compressed-Lines") ?? "0");
      const qaStatus = response.headers.get("X-Render-Verification") ?? "not-run";
      setInfo(
        templatePreserved
          ? `Original DOCX template was edited directly. Patched ${patchedLines} lines${
              compressedLines ? `, layout-capped ${compressedLines}` : ""
            }${
              rowsRemoved ? ` and removed ${rowsRemoved} trailing blank rows` : ""
            }. Render check: ${qaStatus}.`
          : "No DOCX template was available, so a clean rebuilt DOCX was generated."
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to export DOCX.");
    } finally {
      setDocxLoading(false);
    }
  }

  async function exportPdf() {
    if (!session) {
      return;
    }
    const activeSession = session;
    setPdfLoading(true);
    setError("");

    try {
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          exportText: activeSession.improvedResume.exportText,
          candidateName: activeSession.analysis.resumeProfile.identity.name,
          companyName:
            activeSession.analysis.jobDescriptionProfile.company ||
            activeSession.analysis.jobDescriptionProfile.roleTitle
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to export PDF.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileName = disposition.match(/filename="(.+)"/)?.[1] ?? "thankyoulove.pdf";
      downloadBlob(blob, fileName);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to export PDF.");
    } finally {
      setPdfLoading(false);
    }
  }

  const namingPreview = `${session.analysis.resumeProfile.identity.name
    .toLowerCase()
    .replace(/\s+/g, "-")}-${(
    session.analysis.jobDescriptionProfile.company ||
    session.analysis.jobDescriptionProfile.roleTitle ||
    "company"
  )
    .toLowerCase()
    .replace(/\s+/g, "-")}-thankyoulove`;

  return (
    <div className="relative mx-auto max-w-7xl px-6 py-12 lg:px-10">
      <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 bg-primary/10 blur-3xl" />
      <div className="mb-8 space-y-3">
        <SectionLabel index="05">Export assets</SectionLabel>
        <h1 className="mid-type max-w-4xl text-4xl font-semibold tracking-tight">
          Export the resume and recruiter-ready note
        </h1>
        <p className="max-w-3xl text-foreground/65">
          The app names the file from the candidate and target company, keeps the resume one-page,
          and prefers reusing the uploaded `DOCX` as the style template whenever it is available.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Export status</CardTitle>
            <CardDescription>Source format and preservation confidence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-foreground bg-primary/10 p-4">
              <p className="mono text-sm uppercase tracking-[0.18em] text-foreground/50">Naming preview</p>
              <p className="mt-2 break-words font-medium text-foreground">{namingPreview}</p>
            </div>
            <div className="border-2 border-foreground bg-card p-4">
              <p className="mono text-sm uppercase tracking-[0.18em] text-foreground/50">Layout lock</p>
              <p className="mt-2 font-medium text-foreground">
                {session.source.originalFormat === "docx"
                  ? "Original DOCX template is edited directly. Fonts, spacing, tabs, and margins stay tied to the uploaded file."
                  : "Exact format preservation is only trusted when the source file is DOCX."}
              </p>
            </div>
            <div className="border-2 border-foreground bg-card p-4">
              <p className="mono text-sm uppercase tracking-[0.18em] text-foreground/50">One-page intent</p>
              <p className="mt-2 font-medium text-foreground">
                {session.analysis.resumeProfile.formattingPreferences.onePage ? "Enabled" : "Disabled"}
              </p>
            </div>
            <div className="border-2 border-foreground bg-card p-4">
              <p className="mono text-sm uppercase tracking-[0.18em] text-foreground/50">AI status</p>
              <p className="mt-2 text-sm leading-6 text-foreground/70">
                {session.analysis.meta.runMode === "provider" && !session.analysis.meta.fallbackUsed
                  ? `Provider-backed analysis completed via ${session.analysis.meta.providerUsed}.`
                  : "Current version was generated using the local fallback engine."}
              </p>
            </div>
            <div className="border-2 border-primary bg-primary p-4 text-primary-foreground">
              <p className="mono text-sm uppercase tracking-[0.18em] text-primary-foreground/70">ATS change</p>
              <p className="mt-2 font-medium">
                {Math.round(session.improvedResume.baselineScore)} to{" "}
                {Math.round(session.improvedResume.estimatedScore)}
                {" · "}
                {session.improvedResume.scoreDelta >= 0 ? "+" : ""}
                {Math.round(session.improvedResume.scoreDelta)} points
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Final assets</CardTitle>
            <CardDescription>Export the trusted DOCX file and review the recruiter note.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Button onClick={exportDocx} disabled={docxLoading} className="justify-between">
                {docxLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
                Export DOCX
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={exportPdf}
                disabled={pdfLoading || !pdfExportAvailable}
                className="justify-between"
              >
                {pdfLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Export PDF
                <Download className="h-4 w-4" />
              </Button>
            </div>

            <div className="border-2 border-foreground bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <p className="font-medium">Recruiter note</p>
              </div>
              <p className="text-sm leading-7 text-foreground/70">{session.improvedResume.recruiterNote}</p>
            </div>

            <div className="border-2 border-foreground bg-card p-5">
              <p className="mb-3 font-medium">Export notes</p>
              <div className="space-y-2 text-sm text-foreground/65">
                {[...session.improvedResume.changeSummary, ...session.improvedResume.notes].map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </div>

            {info ? <p className="border-2 border-primary bg-primary/10 p-3 text-sm text-primary">{info}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <ResumePreview
          identity={session.analysis.resumeProfile.identity}
          generated={session.improvedResume}
        />
      </div>
    </div>
  );
}
