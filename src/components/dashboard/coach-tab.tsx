"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BadgeCheck, Briefcase, ExternalLink, Info, MapPin, RefreshCcw, Wallet, Wand2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getDefaultResume, listSavedResumes, type SavedResume } from "@/lib/resume-library";
import { parseResumeText } from "@/lib/parsing/resume-parser";
import { parseJobDescriptionText } from "@/lib/parsing/jd-parser";
import { analyzeMatch } from "@/lib/scoring";

const JOB_CACHE_KEY = "thankyoulove-coach-jobs-cache-v3";
const SCORE_CACHE_KEY = "thankyoulove-coach-score-cache-v2";
const COMPANY_RESEARCH_CACHE_KEY = "thankyoulove-company-research-cache-v2";
const JOB_CACHE_TTL_MS = 30 * 60 * 1000;
const COMPANY_RESEARCH_TTL_MS = 24 * 60 * 60 * 1000;

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
  const [jobs, setJobs] = useState<ScoredJob[]>([]);
  const [defaultResume, setDefaultResume] = useState<SavedResume | null>(null);
  const [resumeCount, setResumeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [eligibilityFilter, setEligibilityFilter] = useState<"eligible" | "notEligible">("eligible");

  const fetchJobs = async (force = false) => {
    setIsLoading(true);

    try {
      const activeDefaultResume = getDefaultResume();
      setDefaultResume(activeDefaultResume);
      setResumeCount(listSavedResumes().length);

      const cached = safeJsonParse<{ savedAt: number; jobs: Job[] } | null>(
        window.localStorage.getItem(JOB_CACHE_KEY),
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
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error("Failed to fetch jobs");
      }

      const data = await response.json();
      const fetchedJobs = Array.isArray(data.jobs) ? data.jobs as Job[] : [];
      window.localStorage.setItem(JOB_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), jobs: fetchedJobs }));
      const scored = scoreJobs(fetchedJobs, activeDefaultResume);
      setJobs(scored);
      void enrichCompanyResearch(scored, setJobs);
    } catch (err) {
      console.error(err);
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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
  }, []);

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl font-semibold tracking-tight">Coach LMS Jobs</h3>
          <p className="text-sm text-black/50">Real ATS fit is calculated from your default resume and each Coach JD.</p>
          <p className="mt-2 text-xs font-medium text-black/45">{resumeStatus}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchJobs(true)}
          disabled={isLoading}
          className="rounded-full bg-white border-black/5 shadow-sm hover:shadow-md transition-all"
        >
          <RefreshCcw className={cn("mr-2 h-3.5 w-3.5", isLoading && "animate-spin")} />
          Sync Portal
        </Button>
      </div>

      <div className="inline-flex rounded-full border border-black/10 bg-white/72 p-1">
        {[
          ["eligible", `Eligible (${eligibleJobs.length})`],
          ["notEligible", `Not eligible (${notEligibleJobs.length})`]
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setEligibilityFilter(id as "eligible" | "notEligible")}
            className={cn(
              "rounded-full px-5 py-2 text-sm transition",
              eligibilityFilter === id ? "bg-ink text-bone" : "text-black/60 hover:text-black"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6">
        {isLoading ? (
           <div className="flex flex-col items-center justify-center py-20 space-y-4">
             <div className="h-10 w-10 rounded-full border-2 border-black/5 border-t-ink animate-spin" />
             <p className="text-sm font-medium text-black/40">Fetching jobs from Coach LMS...</p>
           </div>
        ) : visibleJobs.length ? (
          visibleJobs.map((job) => <JobCard key={job.id} job={job} defaultResume={defaultResume} />)
        ) : (
          <div className="rounded-[32px] border border-dashed border-black/10 bg-white/70 p-8 text-sm text-black/55">
            {jobs.length
              ? "No jobs in this eligibility bucket."
              : "No Coach jobs loaded. Check Coach credentials or click Sync Portal."}
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({ job, defaultResume }: { job: ScoredJob; defaultResume: SavedResume | null }) {
  const router = useRouter();
  const hasScore = typeof job.atsScore === "number";
  const atsScore = hasScore ? job.atsScore as number : null;
  const isHigh = atsScore !== null && atsScore >= 80;
  const isMid = atsScore !== null && atsScore >= 60 && atsScore < 80;
  const eligible = isJobEligible(job);
  const description = cleanDisplayText(job.description || "");
  const cultureDetails = cleanDisplayText(job.cultureDetails || "");

  const openApply = (event: React.MouseEvent) => {
    event.stopPropagation();
    window.open(getCoachJobUrl(job), "_blank");
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
    router.push(`/upload?${params.toString()}`);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="group relative rounded-[32px] border border-black/5 bg-white p-6 transition-all duration-300 hover:shadow-xl cursor-pointer">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="flex items-start gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink/5 text-ink">
                <Briefcase className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-display text-xl font-bold text-ink">{job.title}</h4>
                  {isHigh ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 rounded-full h-5 px-2 flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3" />
                      Strong fit
                    </Badge>
                  ) : null}
                  <Badge className={cn(
                    "rounded-full h-5 px-2",
                    eligible ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"
                  )}>
                    {eligible ? "Eligible" : "Not eligible"}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-black/50">
                  <span className="font-medium text-black/70">{job.company}</span>
                  <span className="h-1 w-1 rounded-full bg-black/10" />
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location}</span>
                  <span className="h-1 w-1 rounded-full bg-black/10" />
                  <span className="flex items-center gap-1 text-emerald-600 font-medium"><Wallet className="h-3 w-3" /> {job.ctc}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              <div className="flex items-center gap-3">
              <ScoreBlock label="ATS fit" score={job.atsScore} high={isHigh} mid={isMid} />
              <ScoreBlock label="Company" score={job.companyScore ?? null} high={(job.companyScore ?? 0) >= 80} mid={(job.companyScore ?? 0) >= 60 && (job.companyScore ?? 0) < 80} />
              </div>
              <div className="flex w-full flex-wrap justify-end gap-2 md:w-[290px]">
                <Button onClick={openApply} variant="outline" className="min-w-[132px] rounded-full bg-white">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Apply now
                </Button>
                <Button onClick={improveResume} className="min-w-[148px] rounded-full bg-ink text-bone shadow-soft hover:bg-black">
                  <Wand2 className="mr-2 h-4 w-4" />
                  Improve resume
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogTrigger>

      <DialogContent className="flex max-h-[88vh] max-w-5xl flex-col overflow-hidden rounded-[32px] p-0">
        <div className="border-b border-black/5 p-6 pr-20">
        <DialogHeader>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex min-w-0 items-start gap-4">
               <div className="h-12 w-12 shrink-0 rounded-2xl bg-ink/5 flex items-center justify-center">
                  <Briefcase className="h-6 w-6" />
               </div>
               <div className="min-w-0">
                  <DialogTitle className="text-2xl font-display font-bold leading-tight">{job.title}</DialogTitle>
                  <p className="text-black/50">{job.company} • {job.location}</p>
                  <Badge className={cn(
                    "mt-3 rounded-full",
                    eligible ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  )}>
                    {eligible ? "Eligible from Coach listing" : "Not eligible from Coach listing"}
                  </Badge>
               </div>
            </div>
            <div className="shrink-0 text-right">
               <p className="text-xs font-bold text-black/30 uppercase tracking-widest">Est. CTC</p>
               <p className="text-xl font-bold text-emerald-600">{job.ctc}</p>
            </div>
          </div>
        </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="grid gap-4 md:grid-cols-3">
           <div className="bg-black/5 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-black/30 uppercase mb-1">ATS Fit</p>
              <div className="flex items-center gap-2">
                 <Zap className={cn("h-4 w-4", isHigh ? "text-amber-500 fill-amber-500" : "text-black/20")} />
                 <span className="font-semibold">{hasScore ? `${job.atsScore}%` : "Needs default resume"}</span>
              </div>
           </div>
           <div className="bg-black/5 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-black/30 uppercase mb-1">Company Score</p>
              <div className="flex items-center gap-2 text-emerald-600">
                 <span className="text-lg font-bold">{job.companyScore ?? "-"}</span>
                 <span className="text-xs font-medium text-black/40">/ 100</span>
              </div>
              <p className="mt-1 text-[11px] text-black/40">
                {job.companyResearch ? `${job.companyResearch.confidence} confidence` : "Researching..."}
              </p>
           </div>
           <div className="bg-black/5 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-black/30 uppercase mb-1">Domain</p>
              <span className="font-semibold">{job.domain || "General"}</span>
           </div>
        </div>

        {job.scoreReason ? (
          <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-black/65">
            <span className="font-semibold text-black">Why this ATS score: </span>
            {job.scoreReason}
          </div>
        ) : null}

        {job.companyResearch ? (
          <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-black/35" />
              <div>
                <p className="text-sm font-semibold text-black">Company quality read</p>
                <p className="mt-1 text-sm leading-6 text-black/65">{job.companyResearch.summary}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {[
                ["Pay", job.companyResearch.breakdown.compensation],
                ["Culture", job.companyResearch.breakdown.culture],
                ["Stability", job.companyResearch.breakdown.stability],
                ["Role pay", job.companyResearch.breakdown.rolePay]
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-black/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/30">{label}</p>
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
          <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white/60 p-4 text-sm text-black/50">
            Company research is still loading or no public no-key signals were available.
          </div>
        )}

        <div className="mt-8 space-y-6">
           <div>
              <h5 className="font-bold text-sm uppercase tracking-widest text-black/30 mb-2">Job Description</h5>
              <p className="whitespace-pre-line break-words rounded-[24px] bg-black/[0.025] p-4 text-sm leading-7 text-black/70">{description || "No detailed JD was returned by Coach."}</p>
           </div>
           <div>
              <h5 className="font-bold text-sm uppercase tracking-widest text-black/30 mb-2">Company Context</h5>
              <p className="whitespace-pre-line break-words text-sm leading-7 text-black/70 italic">"{cultureDetails || "No company context was returned by Coach."}"</p>
           </div>
        </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-black/5 bg-white p-4">
           <DialogClose asChild>
              <Button variant="outline" className="rounded-full">Close</Button>
           </DialogClose>
           <Button onClick={openApply} variant="outline" className="rounded-full bg-white px-6">
             <ExternalLink className="mr-2 h-4 w-4" />
             Apply now
           </Button>
           <Button onClick={improveResume} className="rounded-full bg-ink text-bone px-8">
             Improve resume
           </Button>
        </div>
      </DialogContent>
    </Dialog>
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
      <p className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-1">{label}</p>
      <span
        className={cn(
          "text-2xl font-display font-bold",
          score == null ? "text-black/25" : high ? "text-emerald-600" : mid ? "text-amber-600" : "text-red-600"
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
      <p className="text-[10px] font-bold uppercase tracking-widest text-black/30">{title}</p>
      <div className="mt-2 space-y-2">
        {items.length ? items.slice(0, 4).map((item) => (
          <p
            key={item}
            className={cn(
              "rounded-2xl px-3 py-2 text-xs leading-5",
              tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            )}
          >
            {item}
          </p>
        )) : (
          <p className="rounded-2xl bg-black/5 px-3 py-2 text-xs text-black/45">{empty}</p>
        )}
      </div>
    </div>
  );
}
