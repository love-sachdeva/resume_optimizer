"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, LogIn, LogOut, ShieldCheck } from "lucide-react";

import { useAppSettings, signInAccount, signOutAccount } from "@/lib/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleSignInButton } from "@/components/google-signin-button";
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
    <div className="mx-auto max-w-5xl px-6 py-12 lg:px-10">
      <div className="mb-8 space-y-3">
        <Badge>Account</Badge>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {account.isLoggedIn ? "Profile & Preferences" : "Create your workspace"}
        </h1>
        <p className="max-w-3xl text-black/65">
          Define your domains to enable automatic job-fit analysis and persona-based optimization.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[32px]">
          <CardHeader>
            <CardTitle>{account.isLoggedIn ? "Your Profile" : "Sign in"}</CardTitle>
            <CardDescription>
              {account.isLoggedIn ? "Update your career focus areas." : "Sign in to save your progress."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!account.isLoggedIn && (
               <div className="space-y-4 pb-6 border-b border-black/5">
                 <div className="flex flex-col gap-3">
                   {googleConfigured ? (
                     <div className="flex flex-col items-center justify-center p-6 rounded-[24px] border border-black/5 bg-black/[0.02]">
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
                        <p className="text-[10px] text-black/30 mt-4 uppercase tracking-widest">Recommended for Coach LMS Sync</p>
                     </div>
                   ) : (
                     <div className="flex flex-col items-center justify-center p-8 rounded-[32px] border-2 border-dashed border-black/10 bg-black/[0.01] text-center">
                        <div className="h-12 w-12 rounded-full bg-black/5 flex items-center justify-center mb-4">
                           <ShieldCheck className="h-6 w-6 text-black/20" />
                        </div>
                        <h4 className="font-bold text-ink mb-1">Google Login Unavailable</h4>
                        <p className="text-xs text-black/50 max-w-[240px] mb-6">
                           `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is not set in your environment variables.
                        </p>
                        <Button 
                          variant="secondary" 
                          className="rounded-full px-8"
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
                <p className="text-xs font-bold uppercase tracking-widest text-black/40">Full Name</p>
                <Input placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-black/40">Email Address</p>
                <Input placeholder="Your email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-black/40">Organization</p>
                <Input placeholder="Cohort / Company" value={organization} onChange={(event) => setOrganization(event.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-black/40">Cohort Track</p>
                <Input placeholder="e.g. Co25" value={roleTrack} onChange={(event) => setRoleTrack(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2 pt-4">
               <p className="text-xs font-bold uppercase tracking-widest text-black/40">Career Domains (for Fit Analysis)</p>
               <div className="grid gap-3 md:grid-cols-3">
                  <Input placeholder="Primary (e.g. Product)" value={primaryDomain} onChange={(e) => setPrimaryDomain(e.target.value)} />
                  <Input placeholder="Secondary (e.g. Growth)" value={secondaryDomain} onChange={(e) => setSecondaryDomain(e.target.value)} />
                  <Input placeholder="Tertiary (e.g. Ops)" value={tertiaryDomain} onChange={(e) => setTertiaryDomain(e.target.value)} />
               </div>
               <p className="text-[10px] text-black/40 italic">Jobs outside these domains will be flagged as "Low Fit".</p>
            </div>

            <div className="flex flex-wrap gap-3 pt-4">
              <Button onClick={handleSignIn} disabled={!name?.trim() || !email?.trim()} className="rounded-full bg-ink text-bone px-8">
                <LogIn className="h-4 w-4 mr-2" />
                Save Profile
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              {account.isLoggedIn ? (
                <Button variant="ghost" onClick={() => signOutAccount()} className="rounded-full text-red-500">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-ink text-bone rounded-[32px]">
          <CardHeader>
            <CardTitle className="text-bone">Pro Access</CardTitle>
            <CardDescription className="text-bone/60">
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
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-bone/80">
                {item}
              </div>
            ))}
            <Button variant="secondary" onClick={() => router.push("/settings")} className="w-full rounded-full mt-4">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Provider Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
