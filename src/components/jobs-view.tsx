"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Briefcase, ExternalLink, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteJob, listJobs, saveJob, type StoredJob } from "@/lib/jobs-store";

type JobSource = "coach" | "linkedin";

export function JobsView() {
  const [activeTab, setActiveTab] = useState<JobSource>("coach");
  const [jobs, setJobs] = useState<StoredJob[]>([]);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const sync = () => setJobs(listJobs());
    sync();
    window.addEventListener("thankyoulove:jobs-updated", sync as EventListener);

    return () => {
      window.removeEventListener("thankyoulove:jobs-updated", sync as EventListener);
    };
  }, []);

  const filteredJobs = jobs.filter((job) => job.source === activeTab);

  function resetForm() {
    setTitle("");
    setCompany("");
    setLocation("");
    setUrl("");
    setDescription("");
  }

  function handleSave() {
    if (!description.trim() && !url.trim()) {
      return;
    }

    saveJob({
      source: activeTab,
      title,
      company,
      location,
      url,
      description
    });
    resetForm();
    setJobs(listJobs());
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Badge>Jobs</Badge>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Job workspace
          </h1>
          <p className="max-w-3xl text-black/65">
            Keep Coach and LinkedIn-target jobs in one place, then push a selected job straight into the
            resume analysis flow.
          </p>
        </div>

        <Link
          href="https://coach.mastersunion.org/app/career-coach/find-jobs"
          target="_blank"
          className="rounded-full border border-black/10 bg-white/75 px-5 py-3 text-sm font-medium"
        >
          Open Coach jobs
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          ["coach", "Coach Jobs"],
          ["linkedin", "LinkedIn Jobs"]
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveTab(value as JobSource)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              activeTab === value ? "bg-ink text-bone" : "bg-white/80 text-black/65"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>
              {activeTab === "coach" ? "Add a Coach job" : "Add a LinkedIn job"}
            </CardTitle>
            <CardDescription>
              {activeTab === "coach"
                ? "Open the LMS, copy the job description or URL, and save it here."
                : "Paste a LinkedIn job link, then add the JD text so the score and rewrite are usable."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Role title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                placeholder="Company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
              <Input
                placeholder="Location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </div>
            <Input
              placeholder="Job URL"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            <Textarea
              placeholder="Paste the job description here"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <Button onClick={handleSave}>
              <Plus className="h-4 w-4" />
              Save job
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {activeTab === "coach" ? "Saved Coach jobs" : "Saved LinkedIn jobs"}
            </CardTitle>
            <CardDescription>
              Select a saved job to open the upload workspace with that JD prefilled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredJobs.length ? (
              filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-[22px] border border-black/10 bg-white/72 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{job.title || "Untitled role"}</p>
                      <p className="mt-1 text-sm text-black/58">
                        {[job.company, job.location].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {job.url ? (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          deleteJob(job.id);
                          setJobs(listJobs());
                        }}
                        className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-4 text-sm leading-6 text-black/65">
                    {job.description || "Saved from URL only. Add the JD text for better scoring."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link href={`/upload?jobId=${job.id}`}>
                      <Button variant="secondary">
                        <Briefcase className="h-4 w-4" />
                        Analyze this job
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-black/10 bg-white/72 p-5 text-sm text-black/60">
                No saved jobs yet for this tab.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
