"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SessionEmptyStateProps = {
  title: string;
  description: string;
};

export function SessionEmptyState({
  title,
  description
}: SessionEmptyStateProps) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
      <Card>
        <CardHeader>
        <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/upload">
            <Button>Analyze a resume</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Go home</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
