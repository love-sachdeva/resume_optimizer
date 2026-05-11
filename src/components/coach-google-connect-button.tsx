"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { Chrome, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type CoachGoogleConnectResult = {
  coachApiToken: string;
  coachUserUuid: string;
  tokenExpiresAt?: string;
  coachEmail?: string;
  name?: string;
  mobileNumber?: string;
  countryCode?: string;
};

type CoachGoogleConnectButtonProps = {
  disabled?: boolean;
  onSuccess: (payload: CoachGoogleConnectResult) => void;
  onError: (message: string) => void;
};

export function CoachGoogleConnectButton({ disabled, onSuccess, onError }: CoachGoogleConnectButtonProps) {
  const [clientId, setClientId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const codeClientRef = useRef<{ requestCode: () => void } | null>(null);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let cancelled = false;

    async function loadCoachGoogleClient() {
      try {
        const response = await fetch("/api/coach/connect/google-config");
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.clientId) {
          throw new Error(data.error || "Coach Google login is unavailable.");
        }
        if (!cancelled) {
          setClientId(data.clientId);
        }
      } catch (error) {
        if (!cancelled) {
          onErrorRef.current(error instanceof Error ? error.message : "Coach Google login is unavailable.");
        }
      }
    }

    void loadCoachGoogleClient();
    return () => {
      cancelled = true;
    };
  }, []);

  const exchangeCode = useCallback(
    async (googleCode: string) => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/coach/connect/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ googleCode })
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Coach Google login failed.");
        }

        onSuccess(data as CoachGoogleConnectResult);
      } catch (error) {
        onError(error instanceof Error ? error.message : "Coach Google login failed.");
      } finally {
        setIsLoading(false);
      }
    },
    [onError, onSuccess]
  );

  function handleConnect() {
    onError("");

    if (!clientId) {
      onError("Coach Google login is still loading. Try again in a moment.");
      return;
    }

    const googleOAuth = (window.google as any)?.accounts?.oauth2;

    if (!googleOAuth) {
      onError("Google login script did not load. Refresh and try again.");
      return;
    }

    if (!codeClientRef.current) {
      codeClientRef.current = googleOAuth.initCodeClient({
        client_id: clientId,
        scope: "openid email profile",
        ux_mode: "popup",
        callback: (response: { code?: string; error?: string; error_description?: string }) => {
          if (response.error || !response.code) {
            onError(
              response.error_description ||
                response.error ||
                "Coach Google did not return an authorization code."
            );
            return;
          }
          void exchangeCode(response.code);
        }
      });
    }

    const codeClient = codeClientRef.current;
    if (!codeClient) {
      onError("Coach Google login could not start. Refresh and try again.");
      return;
    }
    codeClient.requestCode();
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <Button
        type="button"
        className="bg-foreground text-background"
        disabled={disabled || isLoading || !clientId}
        onClick={handleConnect}
      >
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Chrome className="mr-2 h-4 w-4" />}
        {isLoading ? "Connecting Coach..." : "Connect Coach with Google"}
      </Button>
    </>
  );
}
