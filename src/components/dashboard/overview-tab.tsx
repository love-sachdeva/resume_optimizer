"use client";

import Link from "next/link";
import { ArrowRight, TrendingUp, Target, FileText, Briefcase, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    { label: "Sessions", value: sessions.length.toString(), icon: Target, color: "bg-blue-50 text-blue-600" },
    { label: "Resumes", value: resumes.length.toString(), icon: FileText, color: "bg-emerald-50 text-emerald-600" },
    { label: "Analyzed", value: sessions.filter(s => s.source.jobText).length.toString(), icon: Briefcase, color: "bg-purple-50 text-purple-600" },
    { label: "Avg. ATS", value: sessions.length > 0 ? (sessions.reduce((acc, s) => acc + (s.analysis.matchAnalysis.overallScore || 0), 0) / sessions.length).toFixed(0) + "%" : "0%", icon: Zap, color: "bg-amber-50 text-amber-600" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className="rounded-[32px] border border-black/5 bg-white p-6 transition-all hover:shadow-md">
            <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center mb-4", stat.color)}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-black/40 uppercase tracking-widest">{stat.label}</p>
            <p className="text-3xl font-display font-bold mt-1 text-ink">{stat.value}</p>
          </div>
        ))}
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl font-semibold">Recent Activity</h3>
        </div>
        <div className="grid gap-4">
          {sessions.slice(0, 4).map((session) => (
            <Link
              key={session.id}
              href={`/dashboard?session=${session.id}`}
              className="group flex items-center justify-between rounded-[28px] border border-black/5 bg-white p-4 transition-all hover:shadow-md"
            >
               <div className="flex items-center gap-4">
                 <div className="h-12 w-12 rounded-2xl bg-ink/5 flex items-center justify-center text-ink">
                    <TrendingUp className="h-5 w-5" />
                 </div>
                 <div>
                   <p className="font-semibold text-ink">
                      {session.analysis.jobDescriptionProfile.company ||
                        session.analysis.jobDescriptionProfile.roleTitle ||
                        "Resume improvement"}
                   </p>
                   <div className="flex items-center gap-2 mt-1">
                      <Badge className={cn(
                        "text-[10px] rounded-full",
                        session.analysis.matchAnalysis.overallScore >= 80 ? "bg-emerald-50 text-emerald-700" : "bg-black/5 text-black/40"
                      )}>
                        ATS: {session.analysis.matchAnalysis.overallScore}%
                      </Badge>
                      <span className="text-xs text-black/30">{new Date(session.updatedAt).toLocaleDateString()}</span>
                   </div>
                 </div>
               </div>
               <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white opacity-0 transition-opacity group-hover:opacity-100">
                 <ArrowRight className="h-4 w-4" />
               </span>
            </Link>
          ))}
          {sessions.length === 0 && (
            <div className="py-12 text-center border-2 border-dashed border-black/5 rounded-[32px]">
               <p className="text-black/30">No activity yet. Start by improving a resume!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
