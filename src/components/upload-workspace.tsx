"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowRight,
  Briefcase,
  FileArchive,
  FileText,
  LoaderCircle,
  Sparkles,
  UploadCloud
} from "lucide-react";

import { useAppSettings } from "@/lib/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionLabel } from "@/components/site/section-label";
import { createSession, dataUrlToFile, fileToDataUrl } from "@/lib/client-store";
import { getProfileMemory } from "@/lib/profile-store";
import {
  getDefaultResumeId,
  getSavedResume,
  listSavedResumes,
  saveResumeToLibrary,
  type SavedResume
} from "@/lib/resume-library";
import type { AnalysisResponse } from "@/lib/schemas";

export function UploadWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const settings = useAppSettings();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jobText, setJobText] = useState("");
  const [keepSameFormat, setKeepSameFormat] = useState(true);
  const [onePage, setOnePage] = useState(true);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [selectedSavedResumeId, setSelectedSavedResumeId] = useState("");
  const [savedProfile, setSavedProfile] = useState<{ answers: any }>({ answers: {} });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const resumes = listSavedResumes();
    setSavedResumes(resumes);
    setSavedProfile(getProfileMemory());
    const requestedResumeId = params.get("resumeId") || getDefaultResumeId();
    if (requestedResumeId && resumes.some((resume) => resume.id === requestedResumeId)) {
      setSelectedSavedResumeId(requestedResumeId);
    }
    setMounted(true);
  }, [params]);

  useEffect(() => {
    const jobTitle = params.get("jobTitle") ?? "";
    const jobCompany = params.get("jobCompany") ?? "";
    const jobDescription = params.get("jobDescription") ?? "";

    if (jobDescription) {
      setJobText(`Role: ${jobTitle}\nCompany: ${jobCompany}\n\n${jobDescription}`);
    }
  }, [params]);

  if (!mounted) return null;

  async function handleSubmit() {
    startTransition(async () => {
      try {
        setError("");

        if (!settings.account.isLoggedIn) {
          router.push("/profile?next=%2Fupload&reason=login");
          return;
        }

        const formData = new FormData();
        const selectedResume = !resumeFile && selectedSavedResumeId ? getSavedResume(selectedSavedResumeId) : null;
        const effectiveResumeFile = resumeFile || (selectedResume ? dataUrlToFile(selectedResume.dataUrl, selectedResume.fileName) : null);

        if (effectiveResumeFile) formData.append("resumeFile", effectiveResumeFile);
        formData.append("resumeText", resumeText || selectedResume?.parsedText || "");
        formData.append("jobText", jobText);
        const reusableAnswers = {
          ...savedProfile.answers,
          public_proof: [savedProfile.answers.public_proof, settings.account.portfolio]
            .filter(Boolean)
            .join(" | ")
        };
        formData.append("answers", JSON.stringify(reusableAnswers));
        formData.append("preferences", JSON.stringify({ keepSameFormat, onePage }));
        formData.append("providerConfig", JSON.stringify(settings.provider));

        const response = await fetch("/api/analyze", { method: "POST", body: formData });
        const payload = await response.json();

        if (!response.ok) throw new Error(payload.error || "Failed to analyze.");

        const analysisPayload = payload as AnalysisResponse;

        if (effectiveResumeFile && !selectedSavedResumeId) {
            const resumeDataUrl = await fileToDataUrl(effectiveResumeFile);
            saveResumeToLibrary({
                label: effectiveResumeFile.name.replace(/\.[^/.]+$/, ""),
                domain: settings.account.primaryDomain || "General",
                fileName: effectiveResumeFile.name,
                dataUrl: resumeDataUrl,
                parsedText: analysisPayload.resumeProfile.rawText,
                originalFormat: effectiveResumeFile.name.toLowerCase().endsWith(".docx") ? "docx" : "pdf"
            });
        }

        const session = createSession({
          analysis: analysisPayload,
          improvedResume: analysisPayload.improvedResume,
          answers: reusableAnswers,
          source: {
            resumeText: analysisPayload.resumeProfile.rawText,
            jobText: analysisPayload.jobDescriptionProfile.rawText,
            resumeFileName: effectiveResumeFile?.name ?? "pasted-resume.txt",
            resumeDocxDataUrl: effectiveResumeFile && effectiveResumeFile.name.toLowerCase().endsWith(".docx") ? await fileToDataUrl(effectiveResumeFile) : undefined,
            originalFormat: effectiveResumeFile?.name.toLowerCase().endsWith(".docx") ? "docx" : effectiveResumeFile?.name.toLowerCase().endsWith(".pdf") ? "pdf" : "text"
          }
        });

        router.push(`/dashboard?session=${session.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to analyze inputs.");
      }
    });
  }

  return (
    <div className="relative mx-auto max-w-7xl overflow-hidden px-6 py-12 lg:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_20%_0%,hsl(var(--primary)/0.10),transparent_60%)]" />
      <div className="relative mb-8 border-b border-foreground/15 pb-8 animate-fade-in">
        <SectionLabel index="01">Analyze resume</SectionLabel>
        <h1 className="mid-type mt-5 max-w-4xl text-balance">
          Surgical ATS <span className="text-primary">optimization.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-foreground/65">
          Upload your base resume and the target job description. We'll optimize the content while preserving your exact template structure.
        </p>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card className="animate-rise-in bg-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileArchive className="h-5 w-5" />
              1. Base Resume
            </CardTitle>
            <CardDescription>Select from library or upload new.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {savedResumes.length ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {savedResumes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedSavedResumeId(item.id);
                        setResumeFile(null);
                        setResumeText("");
                      }}
                      className={`mono border px-4 py-2 text-[11px] uppercase tracking-[0.16em] transition ${
                        selectedSavedResumeId === item.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-foreground/20 text-foreground/60 hover:border-primary hover:text-primary"
                      }`}
                    >
                      {item.domain}: {item.label}
                    </button>
                  ))}
                  <button
                    onClick={() => { setSelectedSavedResumeId(""); setResumeFile(null); }}
                    className={`mono border border-dashed px-4 py-2 text-[11px] uppercase tracking-[0.16em] transition ${
                       !selectedSavedResumeId ? "border-primary bg-primary/10 text-primary" : "border-foreground/20 text-foreground/45"
                    }`}
                  >
                    + New
                  </button>
                </div>
              </div>
            ) : null}
            
            {!selectedSavedResumeId && (
                <label className="flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-foreground/20 bg-primary/10 px-5 py-10 text-center transition hover:border-primary hover:bg-primary/15">
                <UploadCloud className="mb-3 h-7 w-7 text-primary" />
                <span className="mono text-[11px] uppercase tracking-[0.18em]">Drop resume here or click</span>
                <Input
                    type="file"
                    className="hidden"
                    accept=".doc,.docx,.pdf,.txt"
                    onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)}
                />
                </label>
            )}
            
            {resumeFile ? (
              <div className="flex items-center justify-between border border-primary/30 bg-primary/10 p-4 text-sm">
                <span>Selected: <span className="font-bold">{resumeFile.name}</span></span>
                <button onClick={() => setResumeFile(null)} className="text-foreground/40 hover:text-primary">Remove</button>
              </div>
            ) : selectedSavedResumeId ? (
                <div className="border border-primary/30 bg-primary/10 p-4 text-sm">
                    Using saved resume from library.
                </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="animate-rise-in bg-background [animation-delay:80ms]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              2. Job Description
            </CardTitle>
            <CardDescription>Paste the JD text below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste the job description here..."
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              className="min-h-[190px] p-5"
            />
          </CardContent>
        </Card>
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-6 border-2 border-foreground bg-background p-6 animate-rise-in [animation-delay:140ms]">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-3 border border-foreground/15 px-4 py-3">
                <Switch checked={keepSameFormat} onCheckedChange={setKeepSameFormat} />
                <span className="mono text-[11px] uppercase tracking-[0.16em]">Keep original format</span>
            </div>
            <div className="flex items-center gap-3 border border-foreground/15 px-4 py-3">
                <Switch checked={onePage} onCheckedChange={setOnePage} />
                <span className="mono text-[11px] uppercase tracking-[0.16em]">Enforce 1-page limit</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {error && <p className="max-w-xs border border-primary bg-primary/10 px-3 py-2 text-sm text-primary">{error}</p>}
            <Button
                size="lg"
                className="h-14 px-10 font-bold"
                onClick={handleSubmit}
                disabled={isPending || (!resumeFile && !selectedSavedResumeId) || !jobText.trim()}
            >
                {isPending ? (
                    <div className="flex items-center gap-3">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Analyzing...
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Optimize Now
                    </div>
                )}
            </Button>
          </div>
      </div>
    </div>
  );
}
