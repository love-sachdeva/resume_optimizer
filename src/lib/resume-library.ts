"use client";

import { z } from "zod";

const RESUME_LIBRARY_KEY = "thankyoulove-resume-library";
const DEFAULT_RESUME_ID_KEY = "thankyoulove-default-resume-id";

export const savedResumeSchema = z.object({
  id: z.string(),
  label: z.string(),
  domain: z.string(),
  fileName: z.string(),
  dataUrl: z.string(),
  parsedText: z.string().default(""),
  originalFormat: z.enum(["docx", "pdf", "text"]).default("docx"),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type SavedResume = z.infer<typeof savedResumeSchema>;

function getStorage() {
  if (typeof window === "undefined") {
    return [] as SavedResume[];
  }

  try {
    const raw = window.localStorage.getItem(RESUME_LIBRARY_KEY);
    return raw ? z.array(savedResumeSchema).parse(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function writeStorage(items: SavedResume[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(RESUME_LIBRARY_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("thankyoulove:resume-library-updated"));
}

export function listSavedResumes() {
  return getStorage().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getSavedResume(id: string) {
  return getStorage().find((item) => item.id === id) ?? null;
}

export function getDefaultResumeId() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(DEFAULT_RESUME_ID_KEY) ?? "";
}

export function getDefaultResume() {
  const defaultId = getDefaultResumeId();
  return defaultId ? getSavedResume(defaultId) : null;
}

export function setDefaultResumeId(id: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (id) {
    window.localStorage.setItem(DEFAULT_RESUME_ID_KEY, id);
  } else {
    window.localStorage.removeItem(DEFAULT_RESUME_ID_KEY);
  }
  window.dispatchEvent(new CustomEvent("thankyoulove:resume-library-updated"));
}

export function saveResumeToLibrary(
  input: Omit<SavedResume, "id" | "createdAt" | "updatedAt"> & { id?: string }
) {
  const now = new Date().toISOString();
  const next = savedResumeSchema.parse({
    ...input,
    id: input.id || crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  });

  const items = getStorage().filter((item) => item.id !== next.id);
  items.push(next);
  writeStorage(items);
  return next;
}

export function deleteSavedResume(id: string) {
  if (getDefaultResumeId() === id) {
    setDefaultResumeId("");
  }
  writeStorage(getStorage().filter((item) => item.id !== id));
}
