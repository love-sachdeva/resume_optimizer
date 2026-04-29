"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, KeyRound, Sparkles } from "lucide-react";

import { PROVIDER_DEFAULTS } from "@/lib/provider-config";
import { useAppSettings, saveProviderSettings, updateSettings } from "@/lib/auth-store";
import { providerConfigSchema, type ProviderConfig } from "@/lib/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function SettingsView() {
  const router = useRouter();
  const params = useSearchParams();
  const settings = useAppSettings();
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState<ProviderConfig>(settings.provider);
  const [savedMessage, setSavedMessage] = useState("");
  const next = params.get("next");
  const reason = params.get("reason");

  useEffect(() => {
    setForm(settings.provider);
  }, [settings.provider]);

  const providerMeta = useMemo(() => PROVIDER_DEFAULTS[form.provider], [form.provider]);

  function save() {
    const next = providerConfigSchema.parse({
      ...form,
      model: form.model.trim() || PROVIDER_DEFAULTS[form.provider].model
    });
    saveProviderSettings(next);
    setSavedMessage("Provider settings saved locally in this browser.");
    if (params.get("next")) {
      router.push(params.get("next") as string);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
      <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_0.42fr] lg:items-end">
        <div className="space-y-3">
        <Badge>Settings</Badge>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Connect a provider before real analysis
        </h1>
        <p className="max-w-3xl text-black/65">
          Keys stay in local storage for this MVP. When a provider is enabled, ThankYouLove routes
          analyze and improve calls through your selected model and falls back gracefully if the
          response is unusable.
        </p>
        {reason === "provider" ? (
          <div className="inline-flex rounded-full border border-black/10 bg-white/72 px-4 py-2 text-sm text-black/62">
            Connect a provider key first, or go back and use demo mode.
          </div>
        ) : null}
        </div>
        <div className="rounded-[32px] border border-black/10 bg-white/75 p-5 shadow-soft">
          <p className="text-xs uppercase tracking-[0.18em] text-black/42">Current mode</p>
          <p className="mt-2 font-display text-3xl font-semibold">
            {form.enabled && form.apiKey ? providerMeta.label : "Local fallback"}
          </p>
          <p className="mt-2 text-sm leading-6 text-black/55">
            {form.enabled && form.apiKey
              ? "Analyze and improve calls use your selected model."
              : "Analysis still works, but scoring and rewriting are heuristic-only."}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[34px] bg-white/82 shadow-soft">
          <CardHeader>
            <CardTitle>Provider</CardTitle>
            <CardDescription>Choose one provider, add the key, then continue back to upload.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              {(Object.keys(PROVIDER_DEFAULTS) as Array<ProviderConfig["provider"]>).map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      provider,
                      model: PROVIDER_DEFAULTS[provider].model
                    }))
                  }
                  className={`rounded-[24px] border p-4 text-left transition hover:-translate-y-0.5 ${
                    form.provider === provider
                      ? "border-black/15 bg-ink text-bone"
                      : "border-black/10 bg-white/72 text-black"
                  }`}
                >
                  <p className="font-medium">{PROVIDER_DEFAULTS[provider].label}</p>
                  <p className={`mt-2 text-sm ${form.provider === provider ? "text-bone/65" : "text-black/58"}`}>
                    {PROVIDER_DEFAULTS[provider].help}
                  </p>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-[22px] border border-black/10 bg-white/72 px-4 py-3">
              <div>
                <p className="font-medium">Enable provider-backed runs</p>
                <p className="text-sm text-black/55">Disable this to use heuristic mode only.</p>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(enabled) => setForm((current) => ({ ...current, enabled }))}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Model</p>
              <Input
                value={form.model}
                placeholder={providerMeta.model}
                onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">API key</p>
              <div className="flex gap-2">
                <Input
                  type={showKey ? "text" : "password"}
                  value={form.apiKey}
                  placeholder="Paste your provider API key"
                  onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
                />
                <Button variant="outline" onClick={() => setShowKey((current) => !current)}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={save}>
                <KeyRound className="h-4 w-4" />
                Save and continue
              </Button>
              {next ? (
                <Button variant="outline" onClick={() => router.push(next)}>
                  Continue without provider
                </Button>
              ) : null}
              {savedMessage ? <p className="text-sm text-emerald-700">{savedMessage}</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[34px] bg-ink text-bone shadow-soft">
          <CardHeader>
            <CardTitle className="text-bone">Runtime behavior</CardTitle>
            <CardDescription className="text-bone/80">
              Current app mode and storage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[22px] border border-white/10 bg-white/10 p-4">
              <p className="text-sm uppercase tracking-[0.18em] text-bone/55">Current account</p>
              <p className="mt-2 font-medium">
                {settings.account.isLoggedIn ? settings.account.email : "Not signed in"}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/10 p-4">
              <p className="text-sm uppercase tracking-[0.18em] text-bone/55">Current mode</p>
              <p className="mt-2 font-medium">
                {form.enabled && form.apiKey ? `${providerMeta.label} via ${form.model || providerMeta.model}` : "Heuristic fallback"}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/10 p-4">
              <p className="text-sm uppercase tracking-[0.18em] text-bone/55">Storage</p>
              <p className="mt-2 text-sm text-bone/78">
                Keys and settings are currently stored in browser local storage for zero-cost hosting.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/10 px-4 py-3">
              <div>
                <p className="font-medium">Private mode</p>
                <p className="text-sm text-bone/65">Disable saved local sessions if you want less persistence.</p>
              </div>
              <Switch
                checked={settings.storageMode === "private"}
                onCheckedChange={(checked) =>
                  updateSettings((current) => ({
                    ...current,
                    storageMode: checked ? "private" : "local"
                  }))
                }
              />
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/10 p-4 text-sm text-bone/78">
              <Sparkles className="mb-3 h-4 w-4" />
              If a provider call fails, the app falls back to the local parser and scoring engine so
              the workflow never completely breaks.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
