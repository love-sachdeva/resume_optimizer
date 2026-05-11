"use client";

import { motion } from "framer-motion";
import { ArrowRight, FileText, ScanSearch, Target } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const floatingCards = [
  { label: "ATS fit", score: "84", x: "8%", y: "16%" },
  { label: "Format lock", score: "DOCX", x: "68%", y: "10%" },
  { label: "JD keywords", score: "Mapped", x: "70%", y: "66%" },
  { label: "Export", score: "DOCX + PDF", x: "16%", y: "70%" }
];

const featureList = [
  "Weighted ATS scoring with gap diagnosis",
  "One-page resume improvement without inventing facts",
  "DOCX-first export to preserve the original layout",
  "JD-wise rewrite with unsupported gaps flagged clearly"
];

const paths = [
  {
    title: "Quick pass",
    body: "Upload the resume and JD, get the score, then decide what to improve."
  },
  {
    title: "Resume-only improvement",
    body: "Tighten bullets and wording using the current resume only."
  },
  {
    title: "JD-wise rewrite",
    body: "Map the job language to truthful resume evidence before export."
  }
];

export function SwarmHero() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-10 lg:px-10 lg:pb-28 lg:pt-16">
      <div className="grid-overlay absolute inset-0 opacity-35" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-grain blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-8">
          <Badge>Resume tailoring that stays readable and believable.</Badge>
          <div className="space-y-6">
            <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[0.94] tracking-tight text-balance sm:text-6xl lg:text-[5.3rem]">
              Upload once. Diagnose fast. Improve only where it matters.
            </h1>
            <div className="grid gap-3 sm:max-w-2xl">
              {featureList.map((feature) => (
                <div
                  key={feature}
                  className="border-2 border-foreground bg-primary/10 px-4 py-3 text-sm text-foreground/72"
                >
                  {feature}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/upload">
              <Button size="lg" className="pr-4">
                Start optimization
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/upload">
              <Button variant="outline" size="lg">
                See resume rewrite
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative min-h-[520px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-8 border-2 border-foreground bg-card p-8"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-black/45">Three paths</p>
                  <p className="font-display text-2xl font-semibold">Choose the level you need.</p>
                </div>
                <div className="bg-primary px-4 py-2 text-sm text-primary-foreground">One-page ready</div>
              </div>

              <div className="grid gap-4">
                {paths.map((path, index) => (
                  <Card key={path.title}>
                    <CardContent className="flex items-start gap-4 p-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-foreground bg-primary/10 text-sm font-medium text-primary">
                        0{index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{path.title}</p>
                        <p className="mt-1 text-sm text-foreground/62">{path.body}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Score", icon: ScanSearch },
                  { label: "Preserve", icon: FileText },
                  { label: "JD map", icon: Target }
                ].map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="border-2 border-foreground bg-card p-4 text-sm"
                    >
                      <ItemIcon className="mb-3 h-4 w-4" />
                      <p className="font-medium">{item.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {floatingCards.map((card, index) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: index * 0.08 }}
              className="absolute"
              style={{ left: card.x, top: card.y }}
            >
              <motion.div
                animate={{
                  y: [0, -14, 0],
                  rotate: [0, index % 2 === 0 ? 4 : -4, 0]
                }}
                transition={{
                  repeat: 0,
                  duration: 7 + index,
                  ease: "easeInOut"
                }}
                className="w-40 border-2 border-foreground bg-card p-4 backdrop-blur-lg"
              >
                <div className="mb-3 h-2 w-12 bg-primary" />
                <p className="mono text-xs uppercase tracking-[0.18em] text-foreground/45">{card.label}</p>
                <p className="display mt-2 text-xl font-semibold">{card.score}</p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
