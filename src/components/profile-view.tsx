"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, RotateCcw, Save, Star, Trash2, UploadCloud } from "lucide-react";

import { updateSettings, useAppSettings } from "@/lib/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/site/section-label";
import { Textarea } from "@/components/ui/textarea";
import { fileToDataUrl } from "@/lib/client-store";
import { clearProfileMemory, getProfileMemory, saveProfileMemory } from "@/lib/profile-store";
import { QUESTION_BANK } from "@/lib/questionnaire";
import {
  deleteSavedResume,
  getDefaultResumeId,
  listSavedResumes,
  saveResumeToLibrary,
  setDefaultResumeId,
  type SavedResume
} from "@/lib/resume-library";
import type { QuestionnaireAnswers } from "@/lib/schemas";

const domainRoleOptions: Record<string, string[]> = {
  Product: ["Associate Product Manager", "Product Analyst", "Growth PM", "Platform PM"],
  Software: ["Software Engineer", "Backend Engineer", "Frontend Engineer", "Full-stack Engineer"],
  Analytics: ["Business Analyst", "Data Analyst", "Analytics Associate", "Strategy Analyst"],
  Consulting: ["Consultant", "Associate Consultant", "Business Analyst", "Strategy Associate"],
  Growth: ["Growth Associate", "Growth Manager", "Lifecycle Analyst", "Performance Marketer"],
  Category: ["Category Manager", "Category Associate", "Marketplace Operations", "Vendor Growth"]
};

const domainTitleOptions: Record<string, string[]> = {
  Product: ["APM", "Product Manager", "Product Analyst", "Founder's Office"],
  Software: ["SDE I", "Software Engineer", "Frontend Engineer", "Backend Engineer"],
  Analytics: ["Business Analyst", "Data Analyst", "Operations Analyst", "BI Analyst"],
  Consulting: ["Consultant", "Associate Consultant", "Business Analyst", "Strategy Analyst"],
  Growth: ["Growth Analyst", "Growth Associate", "Lifecycle Specialist", "Acquisition Analyst"],
  Category: ["Category Manager", "Category Analyst", "Vendor Operations", "Category Associate"]
};

export function ProfileView() {
  const router = useRouter();
  const params = useSearchParams();
  const settings = useAppSettings();
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({});
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [defaultResumeId, setDefaultResumeIdState] = useState("");
  const [activeTab, setActiveTab] = useState<"resumes" | "questions">("resumes");
  const [portfolio, setPortfolio] = useState("");
  const [resumeDomain, setResumeDomain] = useState("");
  const [resumeLabel, setResumeLabel] = useState("");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const next = params.get("next") || "/upload";

  useEffect(() => {
    setAnswers(getProfileMemory().answers);
    setSavedResumes(listSavedResumes());
    setDefaultResumeIdState(getDefaultResumeId());
    if (params.get("tab") === "questions") {
      setActiveTab("questions");
    }
  }, [params]);

  useEffect(() => {
    setPortfolio(settings.account.portfolio ?? "");
  }, [settings.account.portfolio]);

  const groupedQuestions = useMemo(() => {
    const groups = new Map<string, typeof QUESTION_BANK>();
    QUESTION_BANK.forEach((question) => {
      const current = groups.get(question.section) ?? [];
      current.push(question);
      groups.set(question.section, current);
    });
    return [...groups.entries()];
  }, []);

  const answeredCount = Object.values(answers).filter((value) => value.trim()).length;

  function resolveOptions(questionId: string, fallback: string[]) {
    const selectedDomain = answers.target_domain || answers.resume_primary_domain;
    if (questionId === "target_roles" && selectedDomain) {
      return domainRoleOptions[selectedDomain] ?? fallback;
    }
    if (questionId === "preferred_titles" && selectedDomain) {
      return domainTitleOptions[selectedDomain] ?? fallback;
    }
    return fallback;
  }

  function toggleMultiValue(id: string, value: string) {
    const current = (answers[id] ?? "")
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
    const nextValues = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    setAnswers((state) => ({
      ...state,
      [id]: nextValues.join(" | ")
    }));
  }

  return (
    <div className="relative mx-auto max-w-7xl px-6 py-12 lg:px-10">
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 bg-primary/10 blur-3xl" />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <SectionLabel index="05">Profile memory</SectionLabel>
          <h1 className="mid-type max-w-4xl text-4xl font-semibold tracking-tight">
            Save reusable resume context
          </h1>
          <p className="max-w-3xl text-foreground/65">
            This is optional. The app will reuse these answers across jobs, so quick-pass analysis
            can produce a stronger first draft without asking the same questions every time.
          </p>
        </div>

        <div className="border-2 border-primary bg-primary px-5 py-4 text-primary-foreground">
          <p className="mono text-sm uppercase tracking-[0.18em] text-primary-foreground/70">Saved answers</p>
          <p className="display text-5xl font-semibold">{answeredCount}</p>
          <p className="text-sm text-primary-foreground/75">You can keep this partial and update it later.</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Button
          onClick={() => {
            saveProfileMemory(answers);
            updateSettings((current) => ({
              ...current,
              account: {
                ...current.account,
                portfolio
              }
            }));
            router.push(next);
          }}
        >
          <Save className="h-4 w-4" />
          Save profile
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            clearProfileMemory();
            setAnswers({});
          }}
        >
          <RotateCcw className="h-4 w-4" />
          Reset saved answers
        </Button>
      </div>

      <div className="mb-6 inline-flex border-2 border-foreground/35 bg-card p-1">
        {[
          ["resumes", "Resume library"],
          ["questions", "Answer better-fit questions"]
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id as "resumes" | "questions")}
            className={`mono px-5 py-2 text-[11px] uppercase tracking-[0.16em] transition ${
              activeTab === id ? "bg-primary text-primary-foreground" : "text-foreground/60 hover:bg-primary/10 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "resumes" ? (
        <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Profile basics</CardTitle>
          <CardDescription>
            Store links and defaults once. These are reused when generating recruiter notes and application context.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <div>
            <p className="mb-2 text-sm font-medium">Portfolio / personal website</p>
            <Input
              placeholder="https://your-portfolio.com"
              value={portfolio}
              onChange={(event) => setPortfolio(event.target.value)}
            />
          </div>
          <div className="border-2 border-foreground/30 bg-primary/10 p-4 text-sm leading-6 text-foreground/65">
            Default resume is used automatically for Coach ATS scores and the Improve resume flow.
            Use the star button below to change it.
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Saved domain resumes</CardTitle>
          <CardDescription>
            Keep one or more base resumes here and reuse them directly from the analyze page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[0.9fr_0.9fr_1.2fr]">
            <Input
              placeholder="Domain, for example Product"
              value={resumeDomain}
              onChange={(event) => setResumeDomain(event.target.value)}
            />
            <Input
              placeholder="Resume label"
              value={resumeLabel}
              onChange={(event) => setResumeLabel(event.target.value)}
            />
            <label className="flex cursor-pointer items-center justify-center border-2 border-dashed border-foreground/30 bg-primary/10 px-4 py-3 text-sm transition hover:border-primary hover:bg-primary/15">
              <UploadCloud className="mr-2 h-4 w-4" />
              Upload resume
              <input
                type="file"
                className="hidden"
                accept=".doc,.docx,.pdf,.txt"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file || !resumeDomain.trim()) {
                    return;
                  }

                  setIsParsingResume(true);
                  setResumeError("");
                  const dataUrl = await fileToDataUrl(file);
                  try {
                    const formData = new FormData();
                    formData.append("resumeFile", file);
                    const response = await fetch("/api/parse/resume", {
                      method: "POST",
                      body: formData
                    });
                    const payload = await response.json();
                    if (!response.ok) {
                      throw new Error(payload.error || "Could not parse resume.");
                    }

                    const saved = saveResumeToLibrary({
                      label: resumeLabel.trim() || file.name,
                      domain: resumeDomain.trim(),
                      fileName: file.name,
                      dataUrl,
                      parsedText: String(payload.text ?? ""),
                      originalFormat: file.name.toLowerCase().endsWith(".docx")
                        ? "docx"
                        : file.name.toLowerCase().endsWith(".pdf")
                          ? "pdf"
                          : "text"
                    });

                    if (!getDefaultResumeId()) {
                      setDefaultResumeId(saved.id);
                      setDefaultResumeIdState(saved.id);
                    }

                    setSavedResumes(listSavedResumes());
                    setResumeLabel("");
                  } catch (error) {
                    setResumeError(error instanceof Error ? error.message : "Could not save resume.");
                  } finally {
                    setIsParsingResume(false);
                    event.target.value = "";
                  }
                }}
              />
            </label>
          </div>
          {isParsingResume ? (
            <p className="flex items-center gap-2 text-sm text-foreground/55">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Extracting resume text for job scoring...
            </p>
          ) : null}
          {resumeError ? <p className="text-sm text-red-600">{resumeError}</p> : null}

          <div className="grid gap-3 md:grid-cols-2">
            {savedResumes.length ? (
              savedResumes.map((resume) => (
                <div
                  key={resume.id}
                  className="flex items-start justify-between gap-3 border-2 border-foreground/30 bg-card p-4 transition hover:border-primary hover:bg-primary/10"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{resume.label}</p>
                      {defaultResumeId === resume.id ? (
                        <Badge className="border-primary bg-primary text-primary-foreground">
                          <CheckCircle2 className="h-3 w-3" />
                          Default
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-foreground/58">
                      {resume.domain} · {resume.fileName}
                    </p>
                    <p className="mt-1 text-xs text-foreground/40">
                      {resume.parsedText.trim()
                        ? "Ready for Coach job scoring"
                        : "Needs re-upload for job scoring"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDefaultResumeId(resume.id);
                        setDefaultResumeIdState(resume.id);
                      }}
                      className="border-2 border-foreground/30 bg-background p-2 transition hover:border-primary hover:bg-primary/10"
                      title="Use as default resume"
                    >
                      <Star className={`h-4 w-4 ${defaultResumeId === resume.id ? "fill-primary text-primary" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteSavedResume(resume.id);
                        setSavedResumes(listSavedResumes());
                        setDefaultResumeIdState(getDefaultResumeId());
                      }}
                      className="border-2 border-foreground/30 bg-background p-2 transition hover:border-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="border-2 border-dashed border-foreground/25 bg-card p-5 text-sm text-foreground/60">
                No saved base resumes yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
        </>
      ) : null}

      {activeTab === "questions" ? (
      <div className="space-y-6">
        {groupedQuestions.map(([section, questions]) => (
          <Card key={section}>
            <CardHeader>
              <CardTitle>{section}</CardTitle>
              <CardDescription>
                {section === "Role targeting"
                  ? "Use this to set your default positioning and target direction."
                  : "Answer only the parts you know and want reused later."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {questions.map((question) => {
                const questionOptions = Array.isArray(question.options) ? question.options : [];
                const questionPlaceholder =
                  typeof question.placeholder === "string" ? question.placeholder : "";
                const resolvedOptions = resolveOptions(question.id, questionOptions);
                const selectedMulti = new Set(
                  (answers[question.id] ?? "")
                    .split("|")
                    .map((item) => item.trim())
                    .filter(Boolean)
                );

                if (
                  question.dependsOn &&
                  !question.dependsOn.values.includes(answers[question.dependsOn.id] ?? "")
                ) {
                  return null;
                }

                return (
                  <div
                    key={question.id}
                    className={question.layout === "full" ? "md:col-span-2" : ""}
                  >
                    <div className="border-2 border-foreground/30 bg-card p-4">
                      <p className="font-medium">{question.label}</p>
                      <p className="mt-1 text-sm text-foreground/58">{question.prompt}</p>
                      <div className="mt-4">
                        {question.type === "textarea" ? (
                          <Textarea
                            value={answers[question.id] ?? ""}
                            placeholder={questionPlaceholder}
                            onChange={(event) =>
                              setAnswers((current) => ({
                                ...current,
                                [question.id]: event.target.value
                              }))
                            }
                          />
                        ) : question.type === "select" ? (
                          <div className="flex flex-wrap gap-2">
                            {resolvedOptions.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() =>
                                  setAnswers((current) => ({ ...current, [question.id]: option }))
                                }
                                className={`border-2 px-4 py-2 text-sm transition ${
                                  answers[question.id] === option
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-foreground/25 bg-background text-foreground/65 hover:border-primary hover:bg-primary/10"
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        ) : question.type === "multiselect" ? (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              {resolvedOptions.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => toggleMultiValue(question.id, option)}
                                  className={`border-2 px-4 py-2 text-sm transition ${
                                    selectedMulti.has(option)
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-foreground/25 bg-background text-foreground/65 hover:border-primary hover:bg-primary/10"
                                  }`}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                            <Input
                              value={answers[question.id] ?? ""}
                              placeholder={questionPlaceholder}
                              onChange={(event) =>
                                setAnswers((current) => ({
                                  ...current,
                                  [question.id]: event.target.value
                                }))
                              }
                            />
                          </div>
                        ) : question.type === "boolean" ? (
                          <div className="flex gap-2">
                            {[
                              ["true", "Yes"],
                              ["false", "No"]
                            ].map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() =>
                                  setAnswers((current) => ({ ...current, [question.id]: value }))
                                }
                                className={`border-2 px-4 py-2 text-sm transition ${
                                  answers[question.id] === value
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-foreground/25 bg-background text-foreground/65 hover:border-primary hover:bg-primary/10"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <Input
                            value={answers[question.id] ?? ""}
                            placeholder={questionPlaceholder}
                            onChange={(event) =>
                              setAnswers((current) => ({
                                ...current,
                                [question.id]: event.target.value
                              }))
                            }
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
      ) : null}
    </div>
  );
}
