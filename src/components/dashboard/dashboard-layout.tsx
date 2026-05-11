"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Briefcase, FileText, LayoutDashboard, Linkedin } from "lucide-react";
import { cn } from "@/lib/utils";

import { OverviewTab } from "./overview-tab";
import { CoachJobsTab } from "./coach-tab";
import { LinkedInJobsTab } from "./linkedin-tab";
import { ResumesTab } from "./resumes-tab";
import { Marquee } from "@/components/site/marquee";
import { SectionLabel } from "@/components/site/section-label";

type Tab = "overview" | "coach" | "linkedin" | "resumes";

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const reduceMotion = useReducedMotion();

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "coach", label: "Coach LMS", icon: Briefcase },
    { id: "linkedin", label: "LinkedIn Jobs", icon: Linkedin },
    { id: "resumes", label: "My Resumes", icon: FileText },
  ] as const;

  return (
    <div className="relative min-w-0 overflow-x-hidden px-6 py-10 lg:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[min(42vh,520px)] bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.07),transparent_55%)]" />

      <motion.div
        className="relative mb-10 overflow-hidden border-2 border-foreground bg-card p-6 md:p-8"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-primary/10" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-36 w-36 bg-primary/20 blur-3xl" />
        <SectionLabel index="00">ThankYouLove workspace</SectionLabel>
        <div className="mt-8 grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <h1 className="mid-type max-w-5xl text-balance">
              Welcome back, <span className="text-primary">Love.</span>
            </h1>
          </div>
          <p className="relative border-l-2 border-primary pl-4 text-foreground/70 md:col-span-4 md:col-start-9">
            Track Coach jobs, score real resume fit, and generate role-specific edits from your default resume.
          </p>
        </div>
      </motion.div>

      <div className="-mx-6 mb-10 border-y border-foreground/15 py-4 lg:-mx-10">
        <Marquee
          size="sm"
          items={[
            "COACH JOB FIT",
            "DEFAULT RESUME",
            "DOCX-FIRST EXPORT",
            "COMPANY QUALITY",
            "ATS SCORING",
            "SAME FORMAT",
          ]}
        />
      </div>

      <div className="relative grid min-w-0 gap-10 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <aside className="min-w-0 shrink-0">
          <nav className="grid gap-0 border-2 border-foreground lg:sticky lg:top-28">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                  transition={{ type: "spring", stiffness: 520, damping: 34 }}
                  className={cn(
                    "mono flex items-center gap-3 border-b border-foreground/15 px-5 py-4 text-left text-[11px] uppercase tracking-[0.18em] transition-colors duration-200 last:border-b-0",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground/60 hover:bg-primary hover:text-primary-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </motion.button>
              );
            })}
          </nav>

          <div className="mt-6 hidden border-2 border-primary bg-primary p-6 text-primary-foreground lg:block">
            <p className="mono mb-4 text-[11px] uppercase tracking-[0.22em] opacity-80">Operating rule</p>
            <p className="text-sm leading-relaxed">
              Choose one default resume. Every Coach job gets scored against the same baseline before improvement.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          {/* Keyed motion only (no AnimatePresence exit) — avoids fragile SSR/streaming edge cases with tab panels */}
          <motion.div
            key={activeTab}
            role="tabpanel"
            initial={reduceMotion ? false : { opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-[600px] min-w-0"
          >
            {activeTab === "overview" && <OverviewTab />}
            {activeTab === "coach" && <CoachJobsTab />}
            {activeTab === "linkedin" && <LinkedInJobsTab />}
            {activeTab === "resumes" && <ResumesTab />}
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
