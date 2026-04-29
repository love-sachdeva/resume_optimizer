"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, LoaderCircle, NotebookPen, Sparkles } from "lucide-react";

import { useAppSettings } from "@/lib/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SessionEmptyState } from "@/components/session-empty-state";
import { Textarea } from "@/components/ui/textarea";
import { getSession, updateSession, type StoredSession } from "@/lib/client-store";
import type { GeneratedResume, QuestionnaireAnswers } from "@/lib/schemas";

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

export function QuestionnaireView() {
  const router = useRouter();
  const settings = useAppSettings();
  const params = useSearchParams();
  const sessionId = params.get("session") ?? "";
  const [session, setSession] = useState<StoredSession | null>(null);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({});
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const nextSession = getSession(sessionId);
    setSession(nextSession);
    setAnswers(nextSession?.answers ?? {});
  }, [sessionId]);

  const quickQuestions = useMemo(
    () => session?.improvedResume.followUpQuestions ?? [],
    [session]
  );

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
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    setAnswers((state) => ({
      ...state,
      [id]: next.join(" | ")
    }));
  }

  async function handleSubmit() {
    if (!session) {
      return;
    }

    setIsPending(true);
    setError("");

    try {
      const response = await fetch("/api/improve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          resumeText: session.source.resumeText,
          jobText: session.source.jobText,
          answers,
          preferences: {
            ...session.analysis.resumeProfile.formattingPreferences,
            keepSameFormat: true,
            onePage: true,
            formatMode: "same-format"
          },
          providerConfig: settings.provider
        })
      });
      const payload = (await response.json()) as GeneratedResume | { error?: string };

      if (!response.ok) {
        throw new Error(
          ("error" in payload && payload.error) || "Failed to generate deeper improvement."
        );
      }

      const improvedPayload = payload as GeneratedResume;
      const updated = updateSession(session.id, (current) => ({
        ...current,
        answers,
        improvedResume: improvedPayload
      }));
      setSession(updated);
      router.push(`/export?session=${session.id}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to generate deeper improvement."
      );
    } finally {
      setIsPending(false);
    }
  }

  if (!session) {
    return (
      <SessionEmptyState
        title="No session found for deep improvement"
        description="Analyze a resume first to generate adaptive follow-up questions."
      />
    );
  }

  return (
    <div className="relative mx-auto max-w-6xl overflow-hidden px-6 py-12 lg:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-10 h-64 bg-grain blur-3xl" />
      <div className="mb-8 space-y-3">
        <Badge>Step 4</Badge>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Deep improvement mode
        </h1>
        <p className="max-w-3xl text-black/65">
          Answer only the short follow-ups that can improve this specific application. Keep the
          longer reusable profile in one place.
        </p>
        <p className="text-sm text-black/50">
          Runtime:{" "}
          {settings.provider.enabled && settings.provider.apiKey
            ? `${settings.provider.provider} / ${settings.provider.model || "default"}`
            : "heuristic fallback"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Highest-impact follow-up</CardTitle>
              <CardDescription>
                These are the clarifications most likely to move the score for this job.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                router.push(`/profile?next=${encodeURIComponent(`/questionnaire?session=${session.id}`)}`)
              }
            >
              <NotebookPen className="h-4 w-4" />
              Open full profile memory
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {quickQuestions.length ? (
            quickQuestions.map((question) => {
              const resolvedOptions = resolveOptions(question.id, question.options ?? []);
              const selectedMulti = new Set(
                (answers[question.id] ?? "")
                  .split("|")
                  .map((item) => item.trim())
                  .filter(Boolean)
              );

              return (
                <div
                  key={question.id}
                  className="rounded-[24px] border border-black/10 bg-white/72 p-4"
                >
                  <div className="mb-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      <p className="font-medium">{question.label}</p>
                    </div>
                    <p className="text-sm text-black/58">{question.prompt}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-black/42">
                      {question.reason}
                    </p>
                  </div>

                  {question.type === "textarea" ? (
                    <Textarea
                      value={answers[question.id] ?? ""}
                      placeholder={question.placeholder}
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
                          className={`rounded-full px-4 py-2 text-sm transition ${
                            answers[question.id] === option
                              ? "bg-ink text-bone"
                              : "bg-black/5 text-black/65 hover:bg-black/10"
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
                            className={`rounded-full px-4 py-2 text-sm transition ${
                              selectedMulti.has(option)
                                ? "bg-ink text-bone"
                                : "bg-black/5 text-black/65 hover:bg-black/10"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      <Input
                        value={answers[question.id] ?? ""}
                        placeholder={question.placeholder}
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
                          className={`rounded-full px-4 py-2 text-sm transition ${
                            answers[question.id] === value
                              ? "bg-ink text-bone"
                              : "bg-black/5 text-black/65"
                          }`}
                          onClick={() =>
                            setAnswers((current) => ({ ...current, [question.id]: value }))
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Input
                      value={answers[question.id] ?? ""}
                      placeholder={question.placeholder}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: event.target.value
                        }))
                      }
                    />
                  )}
                </div>
              );
            })
          ) : (
            <div className="md:col-span-2 rounded-[24px] border border-dashed border-black/10 bg-white/72 p-6 text-sm text-black/62">
              The current saved profile already answers the most important follow-ups for this
              application. You can generate the stronger version now or open the full profile memory
              page if you want to add more optional context.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          Generate stronger version
          <ArrowRight className="h-4 w-4" />
        </Button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
