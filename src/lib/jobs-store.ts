"use client";

import { z } from "zod";

const JOBS_KEY = "thankyoulove-jobs";

export const storedJobSchema = z.object({
  id: z.string(),
  source: z.enum(["coach", "linkedin", "manual"]).default("manual"),
  title: z.string().default(""),
  company: z.string().default(""),
  location: z.string().default(""),
  url: z.string().default(""),
  description: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type StoredJob = z.infer<typeof storedJobSchema>;

function getStorage() {
  if (typeof window === "undefined") {
    return [] as StoredJob[];
  }

  try {
    const raw = window.localStorage.getItem(JOBS_KEY);
    return raw ? z.array(storedJobSchema).parse(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function writeStorage(jobs: StoredJob[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
  window.dispatchEvent(new CustomEvent("thankyoulove:jobs-updated"));
}

export function listJobs() {
  return getStorage().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getJob(id: string) {
  return getStorage().find((job) => job.id === id) ?? null;
}

export function saveJob(
  input: Omit<StoredJob, "id" | "createdAt" | "updatedAt"> & { id?: string }
) {
  const now = new Date().toISOString();
  const nextJob = storedJobSchema.parse({
    ...input,
    id: input.id || crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  });

  const jobs = getStorage().filter((job) => job.id !== nextJob.id);
  jobs.push(nextJob);
  writeStorage(jobs);
  return nextJob;
}

export function deleteJob(id: string) {
  writeStorage(getStorage().filter((job) => job.id !== id));
}
