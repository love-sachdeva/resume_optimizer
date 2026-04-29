"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

type GooglePayload = {
  email?: string;
  name?: string;
  rawToken?: string;
};

type GoogleSignInButtonProps = {
  onCredential: (payload: GooglePayload) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: Record<string, string | number>
          ) => void;
        };
      };
    };
  }
}

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1];
  if (!payload) {
    return {};
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return JSON.parse(json) as GooglePayload;
  } catch {
    return {};
  }
}

export function GoogleSignInButton({ onCredential }: GoogleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const buttonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      if (window.google && buttonRef.current && clientId) {
        clearInterval(timer);
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!response.credential) return;
            onCredential({
              ...decodeJwtPayload(response.credential),
              rawToken: response.credential
            });
          }
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "pill",
          width: 280
        });
      }
    }, 100);
    return () => clearInterval(timer);
  }, [clientId, onCredential]);

  if (!clientId) {
    return null;
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <div ref={buttonRef} />
    </>
  );
}
