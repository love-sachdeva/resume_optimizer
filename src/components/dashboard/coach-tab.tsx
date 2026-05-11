"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BadgeCheck, Briefcase, ExternalLink, Info, MapPin, RefreshCcw, Wallet, Wand2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/lib/auth-store";
import { getDefaultResume, listSavedResumes, type SavedResume } from "@/lib/resume-library";
import { parseResumeText } from "@/lib/parsing/resume-parser";
import { parseJobDescriptionText } from "@/lib/parsing/jd-parser";
import { analyzeMatch } from "@/lib/scoring";
import { SectionLabel } from "@/components/site/section-label";
import { OneClickApplyDialog, type ApplyJobQuestion } from "@/components/one-click-apply-dialog";

const JOB_CACHE_KEY = "thankyoulove-coach-jobs-cache-v4";
const SCORE_CACHE_KEY = "thankyoulove-coach-score-cache-v3";
const COMPANY_RESEARCH_CACHE_KEY = "thankyoulove-company-research-cache-v3";
const JOB_CACHE_TTL_MS = 30 * 60 * 1000;
const COMPANY_RESEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const APPLIED_JOBS_KEY = "thankyoulove-applied-jobs-v1";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  date: string;
  description: string;
  atsScore?: number | null;
  fitStatus?: string;
  ctc?: string;
  domain?: string;
  companyScore?: number;
  cultureScore?: number;
  cultureDetails?: string;
  eligible?: boolean;
  additionalInformation?: string;
  additionalQuestions?: ApplyJobQuestion[];
  applicationDeadline?: string;
  expiresAt?: string;
}

function getAppliedJobIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(APPLIED_JOBS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markJobAsApplied(jobId: string) {
  const ids = getAppliedJobIds();
  ids.add(jobId);
  window.localStorage.setItem(APPLIED_JOBS_KEY, JSON.stringify([...ids]));
}

function isJobExpired(job: Job): boolean {
  const deadline = job.applicationDeadline || job.expiresAt;
  if (!deadline) return false;
  try {
    return new Date(deadline) < new Date();
  } catch {
    return false;
  }
}

type CompanyResearch = {
  score: number;
  confidence: "high" | "medium" | "low";
  summary: string;
  breakdown: {
    compensation: number;
    culture: number;
    stability: number;
    rolePay: number;
  };
  compensation?: {
    score: number;
    min: number;
    max: number;
    label: string;
  };
  greenFlags: string[];
  redFlags: string[];
  citations: Array<{
    title: string;
    url: string;
    source: string;
  }>;
};

type ScoredJob = Job & {
  atsScore: number | null;
  scoreConfidence?: "high" | "medium" | "low";
  scoreReason?: string;
  companyResearch?: CompanyResearch;
};

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return String(hash >>> 0);
}

function jobCacheKey(userUuid: string) {
  return `${JOB_CACHE_KEY}:${userUuid || "env-fallback"}`;
}

function normalizeJobText(job: Job) {
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

function cleanDisplayText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[Â�]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isJobEligible(job: Job) {
  return job.eligible !== false;
}

function getCoachJobUrl(job: Job) {
  const companySlug = job.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const titleSlug = job.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `https://coach.mastersunion.org/app/career-coach/${companySlug || "company"}/${titleSlug || "role"}?jobId=${job.id}`;
}

function scoreJobs(jobs: Job[], defaultResume: SavedResume | null): ScoredJob[] {
  if (!defaultResume?.parsedText.trim()) {
    return jobs.map((job) => ({
      ...job,
      atsScore: null,
      scoreConfidence: "low",
      scoreReason: "Select a default resume with parsed text to calculate ATS fit."
    }));
  }

  const cache = safeJsonParse<Record<string, { score: number; reason: string; confidence: "high" | "medium" | "low" }>>(
    window.localStorage.getItem(SCORE_CACHE_KEY),
    {}
  );
  const resumeHash = hashText(`${defaultResume.id}:${defaultResume.updatedAt}:${defaultResume.parsedText}`);
  const resumeProfile = parseResumeText(defaultResume.parsedText);

  const scored = jobs.map((job) => {
    const jobText = normalizeJobText(job);
    const cacheKey = `${resumeHash}:${job.id}:${hashText(jobText)}`;
    const cached = cache[cacheKey];
    if (cached) {
      return {
        ...job,
        atsScore: cached.score,
        fitStatus: cached.score >= 80 ? "high" : cached.score >= 60 ? "medium" : "low",
        scoreConfidence: cached.confidence,
        scoreReason: cached.reason
      };
    }

    const jd = parseJobDescriptionText(jobText);
    const analysis = analyzeMatch(resumeProfile, jd);
    const score = Math.round(analysis.overallScore);
    const reason = [
      analysis.strengths.slice(0, 2).join("; "),
      analysis.gaps.slice(0, 2).join("; ")
    ].filter(Boolean).join(" | ");

    cache[cacheKey] = {
      score,
      reason,
      confidence: analysis.confidenceLevel
    };

    return {
      ...job,
      atsScore: score,
      fitStatus: score >= 80 ? "high" : score >= 60 ? "medium" : "low",
      scoreConfidence: analysis.confidenceLevel,
      scoreReason: reason
    };
  });

  window.localStorage.setItem(SCORE_CACHE_KEY, JSON.stringify(cache));
  return scored;
}

async function enrichCompanyResearch(jobs: ScoredJob[], onBatch: (jobs: ScoredJob[]) => void) {
  const cache = safeJsonParse<Record<string, { savedAt: number; research: CompanyResearch }>>(
    window.localStorage.getItem(COMPANY_RESEARCH_CACHE_KEY),
    {}
  );
  let nextJobs = jobs.map((job) => {
    const key = `${job.company}:${job.title}:${job.ctc}:${hashText(job.description)}`;
    const cached = cache[key];
    if (cached && Date.now() - cached.savedAt < COMPANY_RESEARCH_TTL_MS) {
      return {
        ...job,
        companyScore: cached.research.score,
        companyResearch: cached.research
      };
    }
    return job;
  });

  onBatch(nextJobs);

  const pending = nextJobs
    .map((job, index) => ({ job, index }))
    .filter(({ job }) => !job.companyResearch && job.company && job.company !== "Confidential")
    .slice(0, 40);

  for (let start = 0; start < pending.length; start += 4) {
    const batch = pending.slice(start, start + 4);
    const researched = await Promise.all(
      batch.map(async ({ job, index }) => {
        try {
          const response = await fetch("/api/company/research", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              company: job.company,
              title: job.title,
              location: job.location,
              ctc: job.ctc,
              description: job.description
            })
          });
          if (!response.ok) return null;
          const research = await response.json() as CompanyResearch;
          const key = `${job.company}:${job.title}:${job.ctc}:${hashText(job.description)}`;
          cache[key] = { savedAt: Date.now(), research };
          return { index, research };
        } catch {
          return null;
        }
      })
    );

    researched.filter(Boolean).forEach((item) => {
      if (!item) return;
      nextJobs = nextJobs.map((job, index) =>
        index === item.index
          ? { ...job, companyScore: item.research.score, companyResearch: item.research }
          : job
      );
    });

    window.localStorage.setItem(COMPANY_RESEARCH_CACHE_KEY, JSON.stringify(cache));
    onBatch(nextJobs);
  }
}

export function CoachJobsTab() {
  const settings = useAppSettings();
  const [jobs, setJobs] = useState<ScoredJob[]>([]);
  const [defaultResume, setDefaultResume] = useState<SavedResume | null>(null);
  const [resumeCount, setResumeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [coachError, setCoachError] = useState("");
  const [eligibilityFilter, setEligibilityFilter] = useState<"eligible" | "notEligible">("eligible");
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const coachApiToken = settings.account.services?.coach?.apiToken?.trim() ?? "";
  const coachUserUuid = settings.account.services?.coach?.userUuid?.trim() ?? "";
  const hasCoachCredentials = Boolean(coachApiToken && coachUserUuid);

  const fetchJobs = async (force = false) => {
    const activeDefaultResume = getDefaultResume();
    setDefaultResume(activeDefaultResume);
    setResumeCount(listSavedResumes().length);
    setCoachError("");

    if (!hasCoachCredentials) {
      setJobs([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const cached = safeJsonParse<{ savedAt: number; jobs: Job[] } | null>(
        window.localStorage.getItem(jobCacheKey(coachUserUuid)),
        null
      );

      if (!force && cached && Date.now() - cached.savedAt < JOB_CACHE_TTL_MS) {
        const scored = scoreJobs(cached.jobs, activeDefaultResume);
        setJobs(scored);
        void enrichCompanyResearch(scored, setJobs);
        return;
      }

      const response = await fetch("/api/jobs/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coachApiToken,
          coachUserUuid
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" && data.error
            ? data.error
            : `Coach sync failed with status ${response.status}.`
        );
      }

      const fetchedJobs = Array.isArray(data.jobs) ? data.jobs as Job[] : [];
      window.localStorage.setItem(jobCacheKey(coachUserUuid), JSON.stringify({ savedAt: Date.now(), jobs: fetchedJobs }));
      const scored = scoreJobs(fetchedJobs, activeDefaultResume);
      setJobs(scored);
      void enrichCompanyResearch(scored, setJobs);
    } catch (err) {
      console.error(err);
      setJobs([]);
      setCoachError(err instanceof Error ? err.message : "Failed to fetch Coach jobs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setAppliedIds(getAppliedJobIds());
    fetchJobs();

    const syncDefaultResume = () => {
      const activeDefaultResume = getDefaultResume();
      setDefaultResume(activeDefaultResume);
      setResumeCount(listSavedResumes().length);
      setJobs((current) => scoreJobs(current, activeDefaultResume));
    };

    window.addEventListener("thankyoulove:resume-library-updated", syncDefaultResume as EventListener);
    return () => {
      window.removeEventListener("thankyoulove:resume-library-updated", syncDefaultResume as EventListener);
    };
  }, [coachApiToken, coachUserUuid]);

  const resumeStatus = useMemo(() => {
    if (!resumeCount) return "Upload and mark a default resume in Profile to calculate real ATS scores.";
    if (!defaultResume) return "Choose a default resume in Profile to calculate real ATS scores.";
    if (!defaultResume.parsedText.trim()) return "Re-upload this default resume from Profile so its text can be parsed for scoring.";
    return `Scoring against default resume: ${defaultResume.label}`;
  }, [defaultResume, resumeCount]);
  const eligibleJobs = jobs.filter(isJobEligible);
  const notEligibleJobs = jobs.filter((job) => !isJobEligible(job));
  const visibleJobs = eligibilityFilter === "eligible" ? eligibleJobs : notEligibleJobs;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <SectionLabel index="02">Coach LMS jobs</SectionLabel>
          <p className="mt-4 max-w-2xl text-sm text-foreground/65">Real ATS fit is calculated from your default resume and each Coach JD.</p>
          <p className="mt-2 mono text-[10px] uppercase tracking-[0.18em] text-foreground/45">{resumeStatus}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchJobs(true)}
          disabled={isLoading || !hasCoachCredentials}
        >
          <RefreshCcw className={cn("mr-2 h-3.5 w-3.5", isLoading && "animate-spin")} />
          Sync Portal
        </Button>
      </div>

      <div className="inline-flex border-2 border-foreground">
        {[
          ["eligible", `Eligible (${eligibleJobs.length})`],
          ["notEligible", `Not eligible (${notEligibleJobs.length})`]
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setEligibilityFilter(id as "eligible" | "notEligible")}
            className={cn(
              "mono border-r border-foreground/15 px-5 py-3 text-[11px] uppercase tracking-[0.18em] transition-colors last:border-r-0",
              eligibilityFilter === id ? "bg-foreground text-background" : "text-foreground/60 hover:bg-primary hover:text-primary-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {!hasCoachCredentials ? (
        <div className="border-2 border-primary bg-primary/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Connect Coach LMS before syncing jobs.</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/70">
                Production uses your own Coach account. Connect Coach once with Google from Account setup;
                if Google is blocked by Coach redirect settings, use the one-time Coach Helper on the Account page.
              </p>
            </div>
            <Button onClick={() => window.location.assign("/account?next=%2F")} variant="outline">
              Connect Coach
            </Button>
          </div>
        </div>
      ) : null}

      {coachError ? (
        <div className="border-2 border-primary bg-primary/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Coach sync failed.</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/70">{coachError}</p>
            </div>
            <Button onClick={() => window.location.assign("/account?next=%2F")} variant="outline">
              Reconnect Coach
            </Button>
          </div>
        </div>
      ) : null}

      {!defaultResume?.parsedText.trim() ? (
        <div className="border-2 border-primary bg-primary/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Default resume required for real ATS scoring.</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/70">
                Coach jobs are loading, but ATS fit stays blank until you upload a resume and mark it as default in Profile.
                This is why the tab currently shows no ATS score.
              </p>
            </div>
            <Button onClick={() => window.location.assign("/profile")} variant="outline">
              Set default resume
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="h-10 w-10 animate-spin border-2 border-foreground/15 border-t-primary" />
            <p className="mono text-[11px] uppercase tracking-[0.18em] text-foreground/45">Fetching jobs from Coach LMS...</p>
          </div>
        ) : visibleJobs.length ? (
          visibleJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              defaultResume={defaultResume}
              isApplied={appliedIds.has(job.id)}
              isExpired={isJobExpired(job)}
              onApplied={() => {
                markJobAsApplied(job.id);
                setAppliedIds(getAppliedJobIds());
              }}
            />
          ))
        ) : (
          <div className="border-2 border-dashed border-foreground/20 p-8 text-sm text-foreground/55">
            {coachError
              ? "Fix the Coach credentials above, then sync again."
              : !hasCoachCredentials
                ? "Coach jobs will load after you connect your Coach LMS credentials."
                : jobs.length
                  ? "No jobs in this eligibility bucket."
                  : "No Coach jobs loaded. Check Coach credentials or click Sync Portal."}
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({ job, defaultResume, isApplied, isExpired, onApplied }: {
  job: ScoredJob;
  defaultResume: SavedResume | null;
  isApplied: boolean;
  isExpired: boolean;
  onApplied: () => void;
}) {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const hasScore = typeof job.atsScore === "number";
  const atsScore = hasScore ? job.atsScore as number : null;
  const isHigh = atsScore !== null && atsScore >= 80;
  const isMid = atsScore !== null && atsScore >= 60 && atsScore < 80;
  const eligible = isJobEligible(job);
  const description = cleanDisplayText(job.description || "");
  const cultureDetails = cleanDisplayText(job.cultureDetails || "");

  const openApply = (event: React.MouseEvent) => {
    event.stopPropagation();
    setDetailsOpen(false);
    setApplyOpen(true);
  };

  const improveResume = (event: React.MouseEvent) => {
    event.stopPropagation();
    const params = new URLSearchParams({
      jobTitle: job.title,
      jobCompany: job.company,
      jobDescription: job.description
    });
    if (defaultResume?.id) {
      params.set("resumeId", defaultResume.id);
    }
    params.set("coachJobId", job.id);
    params.set("coachJobUrl", getCoachJobUrl(job));
    router.push(`/upload?${params.toString()}`);
  };

  const openDetails = () => {
    setDetailsOpen(true);
  };

  const openDetailsFromKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setDetailsOpen(true);
    }
  };

  return (
    <>
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <div
          role="button"
          tabIndex={0}
          onClick={openDetails}
          onKeyDown={openDetailsFromKeyboard}
          aria-label={`View details for ${job.title} at ${job.company}`}
          className={cn(
            "group relative cursor-pointer border-2 bg-background p-6 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
            isApplied
              ? "border-green-500/60 hover:bg-green-500/5"
              : isExpired
                ? "border-foreground/30 opacity-75 hover:bg-foreground/5"
                : "border-foreground hover:bg-foreground hover:text-background"
          )}
        >
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="flex items-start gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center border-2 border-current">
                <Briefcase className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="display text-2xl font-bold leading-tight">{job.title}</h4>
                  {isHigh ? (
                    <Badge className="border-primary bg-primary text-primary-foreground">
                      <BadgeCheck className="h-3 w-3" />
                      Strong fit
                    </Badge>
                  ) : null}
                  <Badge className={cn(
                    eligible ? "border-foreground/30" : "border-primary bg-primary text-primary-foreground"
                  )}>
                    {eligible ? "Eligible" : "Not eligible"}
                  </Badge>
                  {isApplied ? (
                    <Badge className="border-green-500 bg-green-500 text-white">
                      Applied
                    </Badge>
                  ) : null}
                  {isExpired ? (
                    <Badge className="border-orange-500 bg-orange-500/15 text-orange-700">
                      Expired
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-current/65">
                  <span className="font-medium text-current">{job.company}</span>
                  <span className="h-1 w-1 bg-current/25" />
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location}</span>
                  <span className="h-1 w-1 bg-current/25" />
                  <span className="flex items-center gap-1 font-medium"><Wallet className="h-3 w-3" /> {job.ctc}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              <div className="flex items-center gap-3">
                <ScoreBlock label="ATS fit" score={job.atsScore} high={isHigh} mid={isMid} />
                <ScoreBlock label="Company" score={job.companyScore ?? null} high={(job.companyScore ?? 0) >= 80} mid={(job.companyScore ?? 0) >= 60 && (job.companyScore ?? 0) < 80} />
              </div>
              <div className="flex w-full flex-wrap justify-end gap-2 md:w-[290px]">
                <Button onClick={openApply} variant="outline" className="min-w-[132px] group-hover:border-background group-hover:text-background">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Apply now
                </Button>
                <Button onClick={improveResume} className="min-w-[148px]">
                  <Wand2 className="mr-2 h-4 w-4" />
                  Improve resume
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogContent className="flex max-h-[88vh] max-w-5xl flex-col overflow-hidden p-0">
          <div className="border-b border-foreground/15 p-6 pr-20">
            <DialogHeader>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-foreground">
                    <Briefcase className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="leading-tight">{job.title}</DialogTitle>
                    <p className="text-foreground/55">{job.company} • {job.location}</p>
                    <Badge className={cn(
                      "mt-3",
                      eligible ? "" : "border-primary bg-primary text-primary-foreground"
                    )}>
                      {eligible ? "Eligible from Coach listing" : "Not eligible from Coach listing"}
                    </Badge>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="mono text-[10px] uppercase tracking-[0.22em] text-foreground/35">Est. CTC</p>
                  <p className="display text-2xl text-primary">{job.ctc}</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="border border-foreground/15 p-4">
                <p className="mono mb-1 text-[10px] uppercase tracking-[0.18em] text-foreground/35">ATS Fit</p>
                <div className="flex items-center gap-2">
                  <Zap className={cn("h-4 w-4", isHigh ? "fill-primary text-primary" : "text-foreground/25")} />
                  <span className="font-semibold">{hasScore ? `${job.atsScore}%` : "Needs default resume"}</span>
                </div>
              </div>
              <div className="border border-foreground/15 p-4">
                <p className="mono mb-1 text-[10px] uppercase tracking-[0.18em] text-foreground/35">Company Score</p>
                <div className="flex items-center gap-2 text-primary">
                  <span className="text-lg font-bold">{job.companyScore ?? "-"}</span>
                  <span className="text-xs font-medium text-foreground/40">/ 100</span>
                </div>
                <p className="mt-1 text-[11px] text-foreground/40">
                  {job.companyResearch ? `${job.companyResearch.confidence} confidence` : "Researching..."}
                </p>
              </div>
              <div className="border border-foreground/15 p-4">
                <p className="mono mb-1 text-[10px] uppercase tracking-[0.18em] text-foreground/35">Domain</p>
                <span className="font-semibold">{job.domain || "General"}</span>
              </div>
            </div>

            {job.scoreReason ? (
              <div className="mt-4 border border-foreground/15 p-4 text-sm text-foreground/65">
                <span className="font-semibold text-foreground">Why this ATS score: </span>
                {job.scoreReason}
              </div>
            ) : null}

            {job.companyResearch ? (
              <div className="mt-4 border border-foreground/15 p-4">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Company quality read</p>
                    <p className="mt-1 text-sm leading-6 text-foreground/65">{job.companyResearch.summary}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  {[
                    ["Pay", job.companyResearch.breakdown.compensation],
                    ["Culture", job.companyResearch.breakdown.culture],
                    ["Stability", job.companyResearch.breakdown.stability],
                    ["Role pay", job.companyResearch.breakdown.rolePay]
                  ].map(([label, value]) => (
                    <div key={label} className="border border-foreground/15 p-3">
                      <p className="mono text-[10px] uppercase tracking-[0.18em] text-foreground/30">{label}</p>
                      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <SignalList title="Green flags" items={job.companyResearch.greenFlags} empty="No strong green flags found." tone="green" />
                  <SignalList title="Red flags" items={job.companyResearch.redFlags} empty="No major public red flags found." tone="red" />
                </div>
              </div>
            ) : (
              <div className="mt-4 border border-dashed border-foreground/20 p-4 text-sm text-foreground/50">
                Company research is still loading or no public no-key signals were available.
              </div>
            )}

            <div className="mt-8 space-y-6">
              <div>
                <h5 className="mono mb-2 text-[11px] uppercase tracking-[0.22em] text-foreground/35">Job Description</h5>
                <p className="whitespace-pre-line break-words border border-foreground/15 p-4 text-sm leading-7 text-foreground/70">{description || "No detailed JD was returned by Coach."}</p>
              </div>
              <div>
                <h5 className="mono mb-2 text-[11px] uppercase tracking-[0.22em] text-foreground/35">Company Context</h5>
                <p className="whitespace-pre-line break-words text-sm italic leading-7 text-foreground/70">&quot;{cultureDetails || "No company context was returned by Coach."}&quot;</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-foreground/15 bg-background p-4">
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
            <Button onClick={openApply} variant="outline" className="px-6">
              <ExternalLink className="mr-2 h-4 w-4" />
              Apply now
            </Button>
            <Button onClick={improveResume} className="px-8">
              Improve resume
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <OneClickApplyDialog
        open={applyOpen}
        onOpenChange={(open) => {
          setApplyOpen(open);
          if (!open) {
            // Mark as applied when dialog closes (user may have applied)
            // We check localStorage for a flag set by the apply dialog
            const appliedFlag = window.localStorage.getItem(`thankyoulove-just-applied-${job.id}`);
            if (appliedFlag) {
              onApplied();
              window.localStorage.removeItem(`thankyoulove-just-applied-${job.id}`);
            }
          }
        }}
        job={{
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          ctc: job.ctc,
          domain: job.domain,
          description,
          additionalQuestions: job.additionalQuestions
        }}
        baseResume={
          defaultResume
            ? {
              label: defaultResume.label,
              fileName: defaultResume.fileName,
              dataUrl: defaultResume.dataUrl,
              parsedText: defaultResume.parsedText,
              originalFormat: defaultResume.originalFormat
            }
            : null
        }
      />
    </>
  );
}

function ScoreBlock({
  label,
  score,
  high,
  mid
}: {
  label: string;
  score: number | null | undefined;
  high: boolean;
  mid: boolean;
}) {
  return (
    <div className="min-w-[84px] text-right">
      <p className="mono mb-1 text-[10px] uppercase tracking-[0.18em] opacity-45">{label}</p>
      <span
        className={cn(
          "display text-2xl font-bold",
          score == null ? "opacity-25" : high ? "text-primary" : mid ? "text-current" : "text-primary"
        )}
      >
        {score == null ? "--" : `${score}%`}
      </span>
    </div>
  );
}

function SignalList({
  title,
  items,
  empty,
  tone
}: {
  title: string;
  items: string[];
  empty: string;
  tone: "green" | "red";
}) {
  return (
    <div>
      <p className="mono text-[10px] uppercase tracking-[0.18em] text-foreground/35">{title}</p>
      <div className="mt-2 space-y-2">
        {items.length ? items.slice(0, 4).map((item) => (
          <p
            key={item}
            className={cn(
              "border px-3 py-2 text-xs leading-5",
              tone === "green" ? "border-foreground/15 text-foreground/75" : "border-primary bg-primary text-primary-foreground"
            )}
          >
            {item}
          </p>
        )) : (
          <p className="border border-dashed border-foreground/20 px-3 py-2 text-xs text-foreground/45">{empty}</p>
        )}
      </div>
    </div>
  );
}
