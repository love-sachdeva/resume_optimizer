"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Download, FileArchive, LoaderCircle, Send, Upload, Wand2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ResumePreview } from "@/components/resume-preview";
import { dataUrlToFile } from "@/lib/client-store";
import { useAppSettings } from "@/lib/auth-store";
import { parseJobDescriptionText } from "@/lib/parsing/jd-parser";
import { parseResumeText } from "@/lib/parsing/resume-parser";
import { getProfileMemory } from "@/lib/profile-store";
import { analyzeMatch } from "@/lib/scoring";
import type { AnalysisResponse, GeneratedResume, ResumeProfile } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export type ApplyJobQuestion = {
  question: string;
  answerType?: "singleSelect" | "multiSelect" | "description" | "upload" | string;
  options?: string[];
  mandatory?: boolean;
};

export type OneClickApplyJob = {
  id: string;
  title: string;
  company: string;
  location?: string;
  ctc?: string;
  domain?: string;
  description: string;
  additionalQuestions?: ApplyJobQuestion[];
};

export type ApplyResumeSource = {
  label: string;
  fileName: string;
  dataUrl?: string;
  parsedText: string;
  originalFormat: "docx" | "pdf" | "text";
};

type AnswerValue = string | string[];
type ResumeSelection = "original" | "improved" | "custom";

type OneClickApplyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: OneClickApplyJob;
  baseResume: ApplyResumeSource | null;
  initialImprovedResume?: GeneratedResume | null;
  initialIdentity?: ResumeProfile["identity"] | null;
};

function normalizeJobText(job: OneClickApplyJob) {
  return [
    job.title ? `Role: ${job.title}` : "",
    job.company ? `Company: ${job.company}` : "",
    job.location ? `Location: ${job.location}` : "",
    job.domain ? `Domain: ${job.domain}` : "",
    job.ctc ? `Compensation: ${job.ctc}` : "",
    job.description
  ]
    .filter(Boolean)
    .join("\n");
}

function flattenGeneratedResume(generated: GeneratedResume) {
  if (generated.exportText.trim()) {
    return generated.exportText;
  }

  const lines = [
    generated.headline,
    generated.summary,
    "Experience",
    ...generated.experiences.flatMap((experience) => [
      [experience.title, experience.company, experience.location].filter(Boolean).join(" | "),
      ...experience.bullets
    ]),
    "Projects",
    ...generated.projects.flatMap((project) => [
      [project.name, project.role].filter(Boolean).join(" | "),
      project.description,
      ...project.bullets
    ]),
    "Education",
    ...generated.education.flatMap((education) => [
      [education.degree, education.institution, education.field].filter(Boolean).join(" | "),
      ...education.details
    ]),
    "Skills",
    generated.skills.join(" | "),
    "Certifications",
    ...generated.certifications,
    "Awards",
    ...generated.awards
  ];

  return lines.filter(Boolean).join("\n");
}

function generatedFromResumeText(resumeText: string, score: number): {
  profile: ResumeProfile;
  generated: GeneratedResume;
} {
  const profile = parseResumeText(resumeText);

  return {
    profile,
    generated: {
      headline: profile.summary || profile.targetRoles[0] || "Current resume",
      summary: profile.summary,
      recruiterNote: "",
      skills: profile.skills,
      experiences: profile.experiences,
      projects: profile.projects,
      education: profile.education,
      certifications: profile.certifications,
      awards: profile.awards,
      notes: [],
      changeSummary: [],
      unsupportedSuggestions: [],
      lineDiffs: [],
      followUpQuestions: [],
      baselineScore: score,
      estimatedScore: score,
      scoreDelta: 0,
      exportText: resumeText
    }
  };
}

function buildAdditionalAnswers(job: OneClickApplyJob, answers: Record<string, AnswerValue>) {
  return (job.additionalQuestions ?? [])
    .filter((question) => question.question?.trim())
    .map((question) => ({
      ...question,
      answer:
        answers[question.question] ??
        (question.answerType === "multiSelect" ? [] : "")
    }));
}

function getMissingMandatoryAnswers(job: OneClickApplyJob, answers: Record<string, AnswerValue>) {
  return (job.additionalQuestions ?? []).filter((question) => {
    if (!question.mandatory) return false;
    const answer = answers[question.question];
    return Array.isArray(answer) ? answer.length === 0 : !String(answer ?? "").trim();
  });
}

function scoreResumeAgainstJob(resumeText: string, job: OneClickApplyJob) {
  const resume = parseResumeText(resumeText);
  const jd = parseJobDescriptionText(normalizeJobText(job));
  return Math.round(analyzeMatch(resume, jd).overallScore);
}

export function OneClickApplyDialog({
  open,
  onOpenChange,
  job,
  baseResume,
  initialImprovedResume = null,
  initialIdentity = null
}: OneClickApplyDialogProps) {
  const settings = useAppSettings();
  const [improvedResume, setImprovedResume] = useState<GeneratedResume | null>(initialImprovedResume);
  const [selectedVersion, setSelectedVersion] = useState<ResumeSelection>(
    initialImprovedResume ? "improved" : "original"
  );
  const [customResumeFile, setCustomResumeFile] = useState<File | null>(null);
  const [originalScore, setOriginalScore] = useState<number | null>(null);
  const [updatedScore, setUpdatedScore] = useState<number | null>(null);
  const [portfolio, setPortfolio] = useState(settings.account.portfolio ?? "");
  const [linkedIn, setLinkedIn] = useState("");
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setInfo("");
    setConfirmed(false);
    setPortfolio(settings.account.portfolio ?? "");
    setImprovedResume(initialImprovedResume);
    setSelectedVersion(initialImprovedResume ? "improved" : "original");
    setCustomResumeFile(null);

    if (!baseResume?.parsedText.trim()) {
      setOriginalScore(null);
      setUpdatedScore(null);
      return;
    }

    // Don't auto-fill LinkedIn from resume parsing as it may pick up education text.
    // Keep it empty so users fill it manually, or pre-fill from profile if available.
    setLinkedIn("");
    const nextOriginalScore = scoreResumeAgainstJob(baseResume.parsedText, job);
    setOriginalScore(nextOriginalScore);
    setUpdatedScore(
      initialImprovedResume
        ? scoreResumeAgainstJob(flattenGeneratedResume(initialImprovedResume), job)
        : null
    );
  }, [baseResume, initialImprovedResume, job, open, settings.account.portfolio]);

  const originalPreview = useMemo(() => {
    if (!baseResume?.parsedText.trim()) return null;
    return generatedFromResumeText(baseResume.parsedText, originalScore ?? 0);
  }, [baseResume, originalScore]);

  const activeIdentity = initialIdentity ?? originalPreview?.profile.identity ?? {
    name: settings.account.name || "Candidate",
    email: settings.account.email || "",
    phone: "",
    linkedin: linkedIn,
    github: "",
    location: ""
  };

  const missingMandatory = getMissingMandatoryAnswers(job, answers);
  const selectedLabel =
    selectedVersion === "improved"
      ? "updated resume"
      : selectedVersion === "custom"
        ? "uploaded resume"
        : "previous resume";

  async function updateResume() {
    if (!baseResume?.parsedText.trim()) {
      setError("Set a default resume in Profile before updating this application.");
      return;
    }

    setIsUpdating(true);
    setError("");
    setInfo("");

    try {
      const formData = new FormData();
      if (baseResume.dataUrl) {
        formData.append("resumeFile", dataUrlToFile(baseResume.dataUrl, baseResume.fileName));
      }
      formData.append("resumeText", baseResume.parsedText);
      formData.append("jobText", normalizeJobText(job));
      formData.append(
        "answers",
        JSON.stringify({
          ...getProfileMemory().answers,
          public_proof: [getProfileMemory().answers.public_proof, settings.account.portfolio]
            .filter(Boolean)
            .join(" | ")
        })
      );
      formData.append("preferences", JSON.stringify({
        keepSameFormat: true,
        onePage: true,
        tone: "balanced",
        formatMode: "same-format"
      }));
      formData.append("providerConfig", JSON.stringify(settings.provider));

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update resume.");
      }

      const analysis = payload as AnalysisResponse;
      const generated = analysis.improvedResume;
      const nextUpdatedScore = Math.round(generated.estimatedScore || scoreResumeAgainstJob(flattenGeneratedResume(generated), job));
      const lineChangeCount = generated.lineDiffs.filter(
        (diff) => diff.original.trim() && diff.improved.trim() && diff.original.trim() !== diff.improved.trim()
      ).length;
      setImprovedResume(generated);
      setUpdatedScore(nextUpdatedScore);
      setSelectedVersion("improved");
      setInfo(
        nextUpdatedScore <= (originalScore ?? 0)
          ? `Updated resume is ready with ${lineChangeCount} layout-safe line edits, but the ATS score is capped by hard filters or title/seniority gaps in this JD.`
          : `Updated resume is ready with ${lineChangeCount} layout-safe line edits and a ${nextUpdatedScore - (originalScore ?? nextUpdatedScore)} point ATS lift.`
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to update resume.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function buildImprovedDocxFile() {
    if (!baseResume || !improvedResume) {
      throw new Error("Updated resume is not ready.");
    }

    const formData = new FormData();
    if (baseResume.dataUrl && baseResume.fileName.toLowerCase().endsWith(".docx")) {
      formData.append("templateFile", dataUrlToFile(baseResume.dataUrl, baseResume.fileName));
    }
    formData.append("originalText", baseResume.parsedText);
    formData.append("exportText", flattenGeneratedResume(improvedResume));
    formData.append("lineDiffs", JSON.stringify(improvedResume.lineDiffs));
    formData.append("skillsDiff", JSON.stringify(improvedResume.rewritePlan?.skillsDiff ?? null));
    formData.append("layoutHints", JSON.stringify(improvedResume.layoutInventory ?? null));
    formData.append("qualityMode", improvedResume.rewritePlan?.fitStrategy ?? "visual-fit-first");
    formData.append("onePage", "true");
    formData.append("candidateName", activeIdentity.name || settings.account.name || "candidate");
    formData.append("companyName", job.company || job.title || "company");

    const response = await fetch("/api/export/docx", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || "Failed to build updated DOCX.");
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const fileName = disposition.match(/filename="(.+)"/)?.[1] ?? "thankyoulove-optimized.docx";
    return new File([blob], fileName, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
  }

  async function buildSelectedResumeFile() {
    if (selectedVersion === "custom") {
      if (!customResumeFile) {
        throw new Error("Upload the resume file you want to submit.");
      }
      return customResumeFile;
    }

    if (!baseResume) {
      throw new Error("No resume is available for this application.");
    }

    if (selectedVersion === "improved") {
      return buildImprovedDocxFile();
    }

    if (baseResume.dataUrl) {
      return dataUrlToFile(baseResume.dataUrl, baseResume.fileName);
    }

    return new File([baseResume.parsedText], baseResume.fileName || "resume.txt", {
      type: "text/plain"
    });
  }

  async function applyToCoach() {
    if (selectedVersion !== "custom" && !baseResume?.parsedText.trim()) {
      setError("Set a default resume in Profile before applying.");
      return;
    }
    if (!confirmed) {
      setError("Confirm the final submission before applying.");
      return;
    }
    if (selectedVersion === "improved" && !improvedResume) {
      setError("Click Update Resume before applying with the updated version.");
      return;
    }
    if (selectedVersion === "custom" && !customResumeFile) {
      setError("Upload the resume file you want to submit.");
      return;
    }
    if (missingMandatory.length) {
      setError(`Answer mandatory Coach question: ${missingMandatory[0].question}`);
      return;
    }

    setIsApplying(true);
    setError("");
    setInfo("");

    try {
      const resumeFile = await buildSelectedResumeFile();
      const formData = new FormData();
      formData.append("jobId", job.id);
      formData.append("jobTitle", job.title);
      formData.append("company", job.company);
      formData.append("portfolio", portfolio);
      formData.append("linkedIn", linkedIn);
      formData.append("coachApiToken", settings.account.services?.coach?.apiToken ?? "");
      formData.append("coachUserUuid", settings.account.services?.coach?.userUuid ?? "");
      formData.append("candidateName", activeIdentity.name || settings.account.name || "");
      formData.append("candidateEmail", activeIdentity.email || settings.account.email || "");
      formData.append("selectedVersion", selectedVersion);
      formData.append("confirmApply", "true");
      formData.append("additionalAnswers", JSON.stringify(buildAdditionalAnswers(job, answers)));
      formData.append("resumeFile", resumeFile);

      const response = await fetch("/api/jobs/coach/apply", {
        method: "POST",
        body: formData
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Coach application failed.");
      }

      setInfo(payload.message || `Application submitted with ${selectedLabel}.`);
      setConfirmed(false);
      // Flag so the parent can detect the application on dialog close
      window.localStorage.setItem(`thankyoulove-just-applied-${job.id}`, "true");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Coach application failed.");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-7xl flex-col overflow-hidden p-0">
        <div className="border-b border-foreground/15 p-6 pr-20">
          <DialogHeader>
            <DialogTitle>One-click apply to {job.company}</DialogTitle>
            <p className="text-sm leading-6 text-foreground/65">
              Preview your current resume, generate the updated version, compare ATS scores, choose the file, then confirm the Coach submission.
            </p>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {/* Notifications at top for visibility */}
          {info ? (
            <div className="mb-4 flex items-start gap-2 border-2 border-primary bg-primary/15 p-4 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{info}</span>
            </div>
          ) : null}
          {error ? <p className="mb-4 text-sm text-red-600 border border-red-200 bg-red-50 p-3">{error}</p> : null}

          {!baseResume ? (
            <div className="border-2 border-primary bg-primary/10 p-5">
              <p className="font-semibold">No default resume found.</p>
              <p className="mt-2 text-sm text-foreground/70">
                Upload and mark a default resume in Profile before Coach ATS scoring and one-click apply can work.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <ScoreTile label="Previous ATS" score={originalScore} />
            <ScoreTile label="Updated ATS" score={updatedScore} />
            <div className="border-2 border-foreground bg-background p-4">
              <p className="mono text-[10px] uppercase tracking-[0.18em] text-foreground/45">Selected</p>
              <p className="mt-2 display text-2xl">{selectedLabel}</p>
              <p className="mt-1 text-xs text-foreground/55">{job.title}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-2 border-foreground p-4">
            <div>
              <p className="font-semibold">{baseResume?.label ?? "Resume preview"}</p>
              <p className="text-sm text-foreground/60">Update first if you want the higher-scoring tailored version.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={updateResume} disabled={isUpdating || !baseResume}>
                {isUpdating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Update Resume
              </Button>
              {baseResume?.dataUrl && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      if (selectedVersion === "improved" && improvedResume) {
                        const docxFile = await buildImprovedDocxFile();
                        const url = URL.createObjectURL(docxFile);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = docxFile.name;
                        a.click();
                        URL.revokeObjectURL(url);
                      } else if (baseResume.dataUrl) {
                        const file = dataUrlToFile(baseResume.dataUrl, baseResume.fileName);
                        const url = URL.createObjectURL(file);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = file.name;
                        a.click();
                        URL.revokeObjectURL(url);
                      }
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Download failed.");
                    }
                  }}
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            <ResumeChoiceCard
              label="Previous resume"
              selected={selectedVersion === "original"}
              onSelect={() => setSelectedVersion("original")}
              score={originalScore}
            >
              {originalPreview ? (
                <ResumePreview identity={originalPreview.profile.identity} generated={originalPreview.generated} />
              ) : (
                <PreviewPlaceholder text="Set a default resume to preview the previous version." />
              )}
            </ResumeChoiceCard>

            <ResumeChoiceCard
              label="Updated resume"
              selected={selectedVersion === "improved"}
              onSelect={() => improvedResume && setSelectedVersion("improved")}
              score={updatedScore}
              disabled={!improvedResume}
            >
              {improvedResume ? (
                <ResumePreview identity={activeIdentity} generated={improvedResume} diffMode />
              ) : (
                <PreviewPlaceholder text="Click Update Resume to generate the tailored version." />
              )}
            </ResumeChoiceCard>

            <ResumeChoiceCard
              label="Upload different resume"
              selected={selectedVersion === "custom"}
              onSelect={() => setSelectedVersion("custom")}
              score={null}
            >
              <div className="flex min-h-[380px] flex-col justify-center border border-dashed border-foreground/25 bg-background p-6">
                <Upload className="mb-3 h-8 w-8" />
                <p className="font-semibold">Use your own final file</p>
                <p className="mt-2 text-sm leading-6 text-foreground/60">
                  Upload a PDF, DOC, or DOCX if you do not want to submit the previous or generated resume.
                  Coach accepts resumes up to 1MB.
                </p>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="mt-5"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setCustomResumeFile(file);
                    if (file) {
                      setSelectedVersion("custom");
                    }
                  }}
                />
                {customResumeFile ? (
                  <div className="mt-4 border border-foreground/15 bg-muted/40 p-3 text-sm">
                    <p className="font-medium">{customResumeFile.name}</p>
                    <p className="mt-1 text-xs text-foreground/55">
                      {(customResumeFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-foreground/45">No custom resume selected.</p>
                )}
              </div>
            </ResumeChoiceCard>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="border-2 border-foreground p-4">
              <p className="mb-3 font-semibold">Application links</p>
              <div className="space-y-3">
                <Input
                  placeholder="Portfolio URL"
                  value={portfolio}
                  onChange={(event) => setPortfolio(event.target.value)}
                />
                <Input
                  placeholder="LinkedIn URL"
                  value={linkedIn}
                  onChange={(event) => setLinkedIn(event.target.value)}
                />
              </div>
            </div>

            <div className="border-2 border-foreground p-4">
              <p className="mb-3 font-semibold">Coach questions</p>
              {job.additionalQuestions?.length ? (
                <div className="space-y-3">
                  {job.additionalQuestions.map((question) => (
                    <QuestionField
                      key={question.question}
                      question={question}
                      value={answers[question.question]}
                      onChange={(value) =>
                        setAnswers((current) => ({
                          ...current,
                          [question.question]: value
                        }))
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground/55">No extra Coach questions were returned for this job.</p>
              )}
            </div>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 border-2 border-foreground p-4 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4 accent-current"
            />
            <span>
              I confirm submitting this application to Coach LMS with the {selectedLabel}
              {portfolio ? ` and portfolio ${portfolio}` : ""}. This is the final application step.
            </span>
          </label>

          {/* Info and error moved to top of dialog for visibility */}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-foreground/15 bg-background p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
            Close
          </Button>
          <Button
            onClick={applyToCoach}
            disabled={isApplying || !confirmed || (selectedVersion !== "custom" && !baseResume)}
          >
            {isApplying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Apply with {selectedVersion === "improved" ? "updated" : selectedVersion === "custom" ? "uploaded" : "previous"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScoreTile({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="border-2 border-foreground bg-background p-4">
      <p className="mono text-[10px] uppercase tracking-[0.18em] text-foreground/45">{label}</p>
      <p className="mt-2 display text-4xl">{score == null ? "--" : score}</p>
      <p className="text-xs text-foreground/45">/ 100</p>
    </div>
  );
}

function ResumeChoiceCard({
  label,
  selected,
  score,
  disabled,
  onSelect,
  children
}: {
  label: string;
  selected: boolean;
  score: number | null;
  disabled?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-2 bg-background",
        selected ? "border-primary" : "border-foreground",
        disabled && "opacity-60"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className="flex w-full items-center justify-between border-b border-foreground/15 p-4 text-left disabled:cursor-not-allowed"
      >
        <span className="font-semibold">{label}</span>
        <span className="mono text-[10px] uppercase tracking-[0.18em] text-foreground/55">
          ATS {score == null ? "--" : score}
        </span>
      </button>
      <div className="max-h-[580px] overflow-auto bg-muted/30 p-4">{children}</div>
    </div>
  );
}

function PreviewPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex min-h-[380px] flex-col items-center justify-center border border-dashed border-foreground/25 bg-background p-8 text-center text-sm text-foreground/55">
      <FileArchive className="mb-3 h-8 w-8" />
      {text}
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange
}: {
  question: ApplyJobQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  const label = `${question.question}${question.mandatory ? " *" : ""}`;
  const options = question.options ?? [];

  if (question.answerType === "singleSelect" && options.length) {
    return (
      <div>
        <p className="mb-2 text-sm font-medium">{label}</p>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={cn(
                "border px-3 py-2 text-xs",
                value === option ? "border-primary bg-primary text-primary-foreground" : "border-foreground/20"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (question.answerType === "multiSelect" && options.length) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div>
        <p className="mb-2 text-sm font-medium">{label}</p>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() =>
                  onChange(active ? selected.filter((item) => item !== option) : [...selected, option])
                }
                className={cn(
                  "border px-3 py-2 text-xs",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-foreground/20"
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (question.answerType === "upload") {
    return (
      <div>
        <p className="mb-2 text-sm font-medium">{label}</p>
        <Input
          placeholder="Paste file URL if this Coach question requires an attachment"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <Textarea
        className="min-h-[90px]"
        placeholder="Enter your answer"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
