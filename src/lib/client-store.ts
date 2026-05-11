"use client";

import { getSettings } from "@/lib/auth-store";
import type {
  AnalysisResponse,
  GeneratedResume,
  QuestionnaireAnswers
} from "@/lib/schemas";

const STORAGE_KEY = "thankyoulove-sessions";

export type StoredSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  analysis: AnalysisResponse;
  improvedResume: GeneratedResume;
  answers: QuestionnaireAnswers;
  source: {
    resumeText: string;
    jobText: string;
    resumeFileName: string;
    resumeDocxDataUrl?: string;
    originalFormat: "docx" | "pdf" | "text";
    coachJobId?: string;
    coachJobUrl?: string;
    coachJobTitle?: string;
    coachCompany?: string;
  };
};

function getStorage() {
  if (typeof window === "undefined") {
    return [];
  }

  if (getSettings().storageMode === "private") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(sessions: StoredSession[]) {
  if (typeof window === "undefined") {
    return;
  }

  if (getSettings().storageMode === "private") {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function listSessions() {
  return getStorage().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSession(id: string) {
  return getStorage().find((session) => session.id === id) ?? null;
}

export function saveSession(session: StoredSession) {
  const sessions = getStorage();
  const next = sessions.filter((item) => item.id !== session.id);
  next.push(session);
  writeStorage(next);
}

export function createSession(input: Omit<StoredSession, "id" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const session: StoredSession = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  };
  saveSession(session);
  return session;
}

export function updateSession(
  id: string,
  updater: (session: StoredSession) => StoredSession
) {
  const session = getSession(id);
  if (!session) {
    return null;
  }
  const updated = {
    ...updater(session),
    id,
    updatedAt: new Date().toISOString()
  };
  saveSession(updated);
  return updated;
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function dataUrlToFile(dataUrl: string, fileName: string) {
  const [prefix, content] = dataUrl.split(",");
  const mimeMatch = prefix.match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] ?? "application/octet-stream";
  const bytes = Uint8Array.from(atob(content), (char) => char.charCodeAt(0));
  return new File([bytes], fileName, { type: mime });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
