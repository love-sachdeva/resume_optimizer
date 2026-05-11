"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, LogIn, LogOut, ShieldCheck } from "lucide-react";

import { useAppSettings, signInAccount, signOutAccount } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { SectionLabel } from "@/components/site/section-label";
import { Input } from "@/components/ui/input";

export function AccountView() {
  const router = useRouter();
  const params = useSearchParams();
  const settings = useAppSettings();
  const account = settings.account;
  const next = params.get("next");
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const googleConfigured = clientId.length > 0;
  
  const [name, setName] = useState(account.name || "");
  const [email, setEmail] = useState(account.email || "");
  const [organization, setOrganization] = useState(account.organization || "");
  const [roleTrack, setRoleTrack] = useState(account.roleTrack || "");
  const [primaryDomain, setPrimaryDomain] = useState(account.primaryDomain || "");
  const [secondaryDomain, setSecondaryDomain] = useState(account.secondaryDomain || "");
  const [tertiaryDomain, setTertiaryDomain] = useState(account.tertiaryDomain || "");

  useEffect(() => {
    setName(account.name || "");
    setEmail(account.email || "");
    setOrganization(account.organization || "");
    setRoleTrack(account.roleTrack || "");
    setPrimaryDomain(account.primaryDomain || "");
    setSecondaryDomain(account.secondaryDomain || "");
    setTertiaryDomain(account.tertiaryDomain || "");
  }, [account]);

  function handleSignIn() {
    signInAccount({
      name,
      email,
      organization,
      roleTrack,
      primaryDomain,
      secondaryDomain,
      tertiaryDomain
    });
    router.push(next || "/profile");
  }

  return (
    <div className="relative mx-auto max-w-5xl px-6 py-12 lg:px-10">
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 bg-primary/10 blur-3xl" />
      <div className="mb-8 space-y-3">
        <SectionLabel index="00">Account</SectionLabel>
        <h1 className="mid-type text-4xl font-semibold tracking-tight">
          {account.isLoggedIn ? "Profile & Preferences" : "Create your workspace"}
        </h1>
        <p className="max-w-3xl text-foreground/65">
          Define your domains to enable automatic job-fit analysis and persona-based optimization.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{account.isLoggedIn ? "Your Profile" : "Sign in"}</CardTitle>
            <CardDescription>
              {account.isLoggedIn ? "Update your career focus areas." : "Sign in to save your progress."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!account.isLoggedIn && (
               <div className="space-y-4 border-b-2 border-foreground/10 pb-6">
                 <div className="flex flex-col gap-3">
                   {googleConfigured ? (
                     <div className="flex flex-col items-center justify-center border-2 border-foreground bg-primary/10 p-6">
                        <GoogleSignInButton
                          onCredential={(payload) => {
                            signInAccount({
                              name: payload.name || name,
                              email: payload.email || email,
                              googleToken: (payload as any).rawToken,
                              organization,
                              roleTrack,
                              primaryDomain,
                              secondaryDomain,
                              tertiaryDomain
                            });
                            router.push(next || "/profile");
                          }}
                        />
                        <p className="mono mt-4 text-[10px] uppercase tracking-widest text-foreground/45">Recommended for Coach LMS Sync</p>
                     </div>
                   ) : (
                     <div className="flex flex-col items-center justify-center border-2 border-dashed border-foreground/20 bg-card p-8 text-center">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center border-2 border-foreground/30 text-primary">
                           <ShieldCheck className="h-6 w-6" />
                        </div>
                        <h4 className="mb-1 font-bold text-foreground">Google Login Unavailable</h4>
                        <p className="mb-6 max-w-[240px] text-xs text-foreground/55">
                           `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is not set in your environment variables.
                        </p>
                        <Button 
                          variant="secondary" 
                          className="px-8"
                          onClick={() => {
                            signInAccount({
                              name: "Demo User",
                              email: "demo@mastersunion.in",
                              primaryDomain: "Product Management",
                              organization: "Masters Union"
                            });
                            router.push("/profile");
                          }}
                        >
                          Use Demo Account
                        </Button>
                     </div>
                   )}
                 </div>
               </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="mono text-xs font-bold uppercase tracking-widest text-foreground/45">Full Name</p>
                <Input placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="mono text-xs font-bold uppercase tracking-widest text-foreground/45">Email Address</p>
                <Input placeholder="Your email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="mono text-xs font-bold uppercase tracking-widest text-foreground/45">Organization</p>
                <Input placeholder="Cohort / Company" value={organization} onChange={(event) => setOrganization(event.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="mono text-xs font-bold uppercase tracking-widest text-foreground/45">Cohort Track</p>
                <Input placeholder="e.g. Co25" value={roleTrack} onChange={(event) => setRoleTrack(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2 pt-4">
               <p className="mono text-xs font-bold uppercase tracking-widest text-foreground/45">Career Domains (for Fit Analysis)</p>
               <div className="grid gap-3 md:grid-cols-3">
                  <Input placeholder="Primary (e.g. Product)" value={primaryDomain} onChange={(e) => setPrimaryDomain(e.target.value)} />
                  <Input placeholder="Secondary (e.g. Growth)" value={secondaryDomain} onChange={(e) => setSecondaryDomain(e.target.value)} />
                  <Input placeholder="Tertiary (e.g. Ops)" value={tertiaryDomain} onChange={(e) => setTertiaryDomain(e.target.value)} />
               </div>
               <p className="text-[10px] text-foreground/45 italic">Jobs outside these domains will be flagged as "Low Fit".</p>
            </div>

            <div className="flex flex-wrap gap-3 pt-4">
              <Button onClick={handleSignIn} disabled={!name?.trim() || !email?.trim()} className="px-8">
                <LogIn className="h-4 w-4 mr-2" />
                Save Profile
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              {account.isLoggedIn ? (
                <Button variant="ghost" onClick={() => signOutAccount()} className="text-primary">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-primary-foreground">Pro Access</CardTitle>
            <CardDescription className="text-primary-foreground/70">
              Personalizing your profile improves AI relevance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Automated Job Fit Analysis based on domains.",
              "Surgical resume optimization for your target track.",
              "Secure local storage for all your sessions.",
              "Direct integration with Coach LMS portals."
            ].map((item) => (
              <div key={item} className="border-2 border-primary-foreground/25 bg-primary-foreground/10 p-4 text-sm text-primary-foreground/85">
                {item}
              </div>
            ))}
            <Button variant="secondary" onClick={() => router.push("/settings")} className="mt-4 w-full">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Provider Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
