"use client";

import type { ProfileMemory, QuestionnaireAnswers } from "@/lib/schemas";
import { profileMemorySchema } from "@/lib/schemas";

const PROFILE_KEY = "thankyoulove-profile-memory";

function defaultProfileMemory(): ProfileMemory {
  return profileMemorySchema.parse({
    answers: {},
    updatedAt: ""
  });
}

export function getProfileMemory() {
  if (typeof window === "undefined") {
    return defaultProfileMemory();
  }

  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) {
      return defaultProfileMemory();
    }

    return profileMemorySchema.parse(JSON.parse(raw));
  } catch {
    return defaultProfileMemory();
  }
}

export function saveProfileMemory(answers: QuestionnaireAnswers) {
  if (typeof window === "undefined") {
    return defaultProfileMemory();
  }

  const next = profileMemorySchema.parse({
    answers,
    updatedAt: new Date().toISOString()
  });

  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("thankyoulove:profile-updated"));
  return next;
}

export function clearProfileMemory() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PROFILE_KEY);
  window.dispatchEvent(new CustomEvent("thankyoulove:profile-updated"));
}
