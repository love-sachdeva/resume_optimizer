"use client";

import Link from "next/link";
import { ArrowRight, TrendingUp, Target, FileText, Briefcase, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/site/section-label";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { listSessions, type StoredSession } from "@/lib/client-store";
import { listSavedResumes, type SavedResume } from "@/lib/resume-library";

export function OverviewTab() {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSessions(listSessions());
    setResumes(listSavedResumes());
    setMounted(true);
  }, []);

  if (!mounted) return null;
  
  const stats = [
    { label: "Sessions", value: sessions.length.toString(), icon: Target, tone: "red" },
    { label: "Resumes", value: resumes.length.toString(), icon: FileText, tone: "light" },
    { label: "Analyzed", value: sessions.filter(s => s.source.jobText).length.toString(), icon: Briefcase, tone: "light" },
    { label: "Avg. ATS", value: sessions.length > 0 ? (sessions.reduce((acc, s) => acc + (s.analysis.matchAnalysis.overallScore || 0), 0) / sessions.length).toFixed(0) + "%" : "0%", icon: Zap, tone: "solid" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b-2 border-foreground pb-4">
        <SectionLabel index="01">Overview</SectionLabel>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/65">
          Fast health check across saved resumes, analyzed jobs, and ATS movement.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat, i) => (
          <div
            key={i}
            className={cn(
              "relative overflow-hidden border-2 border-foreground p-5 transition-all hover:-translate-y-0.5",
              stat.tone === "solid" && "bg-primary text-primary-foreground",
              stat.tone === "red" && "bg-primary/10",
              stat.tone === "light" && "bg-card hover:bg-primary/10"
            )}
          >
            {stat.tone !== "solid" ? <div className="absolute right-0 top-0 h-full w-10 bg-primary/10" /> : null}
            <div className={cn("mb-4 flex h-10 w-10 items-center justify-center border-2", i === 3 ? "border-primary-foreground" : "border-foreground text-primary")}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className={cn("mono text-[11px] uppercase tracking-[0.18em]", i === 3 ? "text-primary-foreground/70" : "text-foreground/55")}>{stat.label}</p>
            <p className="display mt-1 text-3xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="display text-2xl font-semibold">Recent Activity</h3>
        </div>
        <div className="grid gap-4">
          {sessions.slice(0, 4).map((session) => (
            <Link
              key={session.id}
              href={`/dashboard?session=${session.id}`}
              className="group flex items-center justify-between border-2 border-foreground bg-card p-4 transition-all hover:-translate-y-0.5 hover:bg-primary/10"
            >
               <div className="flex items-center gap-4">
                 <div className="flex h-12 w-12 items-center justify-center border-2 border-foreground text-primary">
                    <TrendingUp className="h-5 w-5" />
                 </div>
                 <div>
                   <p className="font-semibold text-foreground">
                      {session.analysis.jobDescriptionProfile.company ||
                        session.analysis.jobDescriptionProfile.roleTitle ||
                        "Resume improvement"}
                   </p>
                   <div className="flex items-center gap-2 mt-1">
                      <Badge className={cn(
                        "text-[10px]",
                        session.analysis.matchAnalysis.overallScore >= 80 ? "border-primary bg-primary/10 text-primary" : "border-foreground/25 bg-secondary text-foreground/55"
                      )}>
                        ATS: {session.analysis.matchAnalysis.overallScore}%
                      </Badge>
                      <span className="mono text-xs text-foreground/40">{new Date(session.updatedAt).toLocaleDateString()}</span>
                   </div>
                 </div>
               </div>
               <span className="flex h-10 w-10 items-center justify-center bg-foreground text-background opacity-0 transition-opacity group-hover:opacity-100">
                 <ArrowRight className="h-4 w-4" />
               </span>
            </Link>
          ))}
          {sessions.length === 0 && (
            <div className="border-2 border-dashed border-primary/40 bg-primary/10 py-12 text-center">
               <p className="text-foreground/45">No activity yet. Start by improving a resume.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
