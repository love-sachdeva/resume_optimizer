"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
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
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
      <div className="mb-8 space-y-3">
        <Badge>Improve Resume</Badge>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Surgical ATS Optimization
        </h1>
        <p className="max-w-2xl text-black/65">
          Upload your base resume and the target job description. We'll optimize the content while preserving your exact template structure.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card className="rounded-[32px] border-black/5 bg-white shadow-sm">
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
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        selectedSavedResumeId === item.id ? "bg-ink text-bone" : "bg-black/5 text-black/65 hover:bg-black/10"
                      }`}
                    >
                      {item.domain}: {item.label}
                    </button>
                  ))}
                  <button
                    onClick={() => { setSelectedSavedResumeId(""); setResumeFile(null); }}
                    className={`rounded-full px-4 py-2 text-sm border border-dashed transition ${
                       !selectedSavedResumeId ? "border-ink text-ink bg-ink/5" : "border-black/10 text-black/40"
                    }`}
                  >
                    + New
                  </button>
                </div>
              </div>
            ) : null}
            
            {!selectedSavedResumeId && (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-black/15 bg-white/60 px-5 py-8 text-center transition hover:bg-black/5">
                <UploadCloud className="mb-2 h-6 w-6 text-black/45" />
                <span className="font-medium text-sm">Drop resume here or click</span>
                <Input
                    type="file"
                    className="hidden"
                    accept=".doc,.docx,.pdf,.txt"
                    onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)}
                />
                </label>
            )}
            
            {resumeFile ? (
              <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/50 p-4 text-sm flex items-center justify-between">
                <span>Selected: <span className="font-bold">{resumeFile.name}</span></span>
                <button onClick={() => setResumeFile(null)} className="text-black/30 hover:text-red-500">Remove</button>
              </div>
            ) : selectedSavedResumeId ? (
                <div className="rounded-[22px] border border-blue-100 bg-blue-50/50 p-4 text-sm">
                    Using saved resume from library.
                </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-black/5 bg-white shadow-sm">
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
              className="min-h-[160px] w-full rounded-[24px] border border-black/10 bg-white/60 p-5 text-sm transition focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
          </CardContent>
        </Card>
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-6 p-6 rounded-[32px] border border-black/5 bg-white shadow-sm">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-3 bg-black/5 px-4 py-2 rounded-full">
                <Switch checked={keepSameFormat} onCheckedChange={setKeepSameFormat} />
                <span className="text-sm font-medium">Keep original format (DOCX)</span>
            </div>
            <div className="flex items-center gap-3 bg-black/5 px-4 py-2 rounded-full">
                <Switch checked={onePage} onCheckedChange={setOnePage} />
                <span className="text-sm font-medium">Enforce 1-Page limit</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {error && <p className="text-sm text-red-600 max-w-xs">{error}</p>}
            <Button
                size="lg"
                className="rounded-full bg-ink text-bone h-14 px-10 font-bold shadow-soft hover:scale-105 transition-all disabled:opacity-50"
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
