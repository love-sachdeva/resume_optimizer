"use client";

import { useState } from "react";
import { Briefcase, FileText, LayoutDashboard, Linkedin } from "lucide-react";
import { cn } from "@/lib/utils";

import { OverviewTab } from "./overview-tab";
import { CoachJobsTab } from "./coach-tab";
import { LinkedInJobsTab } from "./linkedin-tab";
import { ResumesTab } from "./resumes-tab";

type Tab = "overview" | "coach" | "linkedin" | "resumes";

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "coach", label: "Coach LMS", icon: Briefcase },
    { id: "linkedin", label: "LinkedIn Jobs", icon: Linkedin },
    { id: "resumes", label: "My Resumes", icon: FileText },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink">Welcome back, Love</h1>
          <p className="text-black/50 mt-1">Here&apos;s what&apos;s happening with your job applications.</p>
        </div>
      </div>

      <div className="flex flex-col gap-10 lg:flex-row">
        {/* Sidebar Navigation */}
        <aside className="w-full lg:w-64 shrink-0">
          <nav className="flex flex-row gap-2 overflow-x-auto pb-4 lg:flex-col lg:pb-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-[20px] px-5 py-4 text-sm font-semibold transition-all duration-300 whitespace-nowrap",
                    activeTab === tab.id
                      ? "bg-ink text-bone shadow-lg translate-x-2"
                      : "bg-white/50 text-black/40 hover:bg-white hover:text-ink hover:shadow-sm"
                  )}
                >
                  <Icon className={cn("h-5 w-5", activeTab === tab.id ? "text-bone" : "text-black/30")} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
          
          <div className="mt-10 hidden lg:block rounded-[24px] bg-emerald-50 p-6 border border-emerald-100">
             <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-2">Pro Tip</p>
             <p className="text-sm text-emerald-700/80 leading-relaxed">
               Tailoring your resume for each job increases your ATS score by an average of 45%.
             </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1">
          <div className="min-h-[600px]">
             {activeTab === "overview" && <OverviewTab />}
             {activeTab === "coach" && <CoachJobsTab />}
             {activeTab === "linkedin" && <LinkedInJobsTab />}
             {activeTab === "resumes" && <ResumesTab />}
             {children}
          </div>
        </main>
      </div>
    </div>
  );
}
