"use client";

import { useEffect, useState } from "react";

import { type ProviderConfig } from "@/lib/schemas";
import { PROVIDER_DEFAULTS } from "@/lib/provider-config";

export interface AccountProfile {
  name?: string;
  email?: string;
  organization?: string;
  roleTrack?: string;
  portfolio?: string;
  primaryDomain?: string;
  secondaryDomain?: string;
  tertiaryDomain?: string;
  googleToken?: string;
  isLoggedIn: boolean;
  services?: {
    coach?: {
      email?: string;
      password?: string;
      apiToken?: string;
      userUuid?: string;
      tokenExpiresAt?: string;
    };
    linkedin?: { email?: string; password?: string };
  };
}

export interface AppSettings {
  account: AccountProfile;
  provider: ProviderConfig;
  storageMode: "local" | "private";
}

const SETTINGS_KEY = "thankyoulove-settings";

function defaultSettings(): AppSettings {
  return {
    account: {
      isLoggedIn: false,
      services: {
        coach: {},
        linkedin: {}
      }
    },
    provider: {
      provider: "openai",
      model: PROVIDER_DEFAULTS.openai.model,
      apiKey: "",
      enabled: false
    },
    storageMode: "local"
  };
}

export function getSettings() {
  if (typeof window === "undefined") {
    return defaultSettings();
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return defaultSettings();
    }
    return JSON.parse(raw) as AppSettings;
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("thankyoulove:settings-updated"));
}

export function updateSettings(updater: (settings: AppSettings) => AppSettings) {
  const current = getSettings();
  const next = updater(current);
  saveSettings(next);
  return next;
}

export function signInAccount(account: Omit<AccountProfile, "isLoggedIn">) {
  return updateSettings((settings) => {
    const nextAccount = {
      ...settings.account,
      ...account,
      isLoggedIn: true
    };

    // Auto-populate coach email if missing
    if (nextAccount.email && !nextAccount.services?.coach?.email) {
      nextAccount.services = {
        ...nextAccount.services,
        coach: {
          ...nextAccount.services?.coach,
          email: nextAccount.email
        }
      };
    }

    return {
      ...settings,
      account: nextAccount
    };
  });
}

export function saveServiceCredentials(
  service: "coach" | "linkedin",
  credentials: {
    email?: string;
    password?: string;
    apiToken?: string;
    userUuid?: string;
    tokenExpiresAt?: string;
  }
) {
  return updateSettings((settings) => ({
    ...settings,
    account: {
      ...settings.account,
      services: {
        ...settings.account.services,
        [service]: credentials
      }
    }
  }));
}

export function signOutAccount() {
  return updateSettings((settings) => ({
    ...settings,
    account: {
      name: "",
      email: "",
      organization: "",
      roleTrack: "",
      portfolio: "",
      isLoggedIn: false
    }
  }));
}

export function saveProviderSettings(provider: ProviderConfig) {
  return updateSettings((settings) => ({
    ...settings,
    provider
  }));
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings());

  useEffect(() => {
    const sync = () => setSettings(getSettings());
    sync();
    window.addEventListener("thankyoulove:settings-updated", sync as EventListener);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener("thankyoulove:settings-updated", sync as EventListener);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return settings;
}
