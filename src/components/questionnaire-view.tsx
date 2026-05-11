"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionLabel } from "@/components/site/section-label";

export function QuestionnaireView() {
  const params = useSearchParams();
  const sessionId = params.get("session") ?? "";
  const improveHref = sessionId ? `/improve?session=${sessionId}` : "/upload";

  return (
    <div className="relative mx-auto max-w-3xl px-6 py-12 lg:px-10">
      <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 bg-primary/10 blur-3xl" />
      <Card>
        <CardHeader>
          <SectionLabel index="04">Questionnaire disabled</SectionLabel>
          <CardTitle className="mt-4">Use the same-format rewrite flow</CardTitle>
          <CardDescription>
            Extra-question tailoring is currently hidden. Resume optimization now uses the uploaded resume,
            JD evidence mapping, and same-layout constraints directly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={improveHref}>
            <Button>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
