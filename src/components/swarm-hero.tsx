"use client";

import { motion } from "framer-motion";
import { ArrowRight, FileText, ScanSearch, Sparkles } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const floatingCards = [
  { label: "ATS fit", score: "84", color: "bg-cyan", x: "8%", y: "16%" },
  { label: "Format lock", score: "DOCX", color: "bg-gold", x: "68%", y: "10%" },
  { label: "Deep mode", score: "Adaptive", color: "bg-salmon", x: "70%", y: "66%" },
  { label: "Export", score: "DOCX + PDF", color: "bg-ink", x: "16%", y: "70%" }
];

const featureList = [
  "Weighted ATS scoring with gap diagnosis",
  "One-page resume improvement without inventing facts",
  "DOCX-first export to preserve the original layout",
  "Deep improvement only when the role needs more context"
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
    title: "Deep improvement",
    body: "Answer guided questions when the job needs a stronger positioning shift."
  }
];

export function SwarmHero() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-10 lg:px-10 lg:pb-28 lg:pt-16">
      <div className="grid-overlay absolute inset-0 animate-pulseGrid opacity-40" />
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
                  className="rounded-[22px] border border-black/10 bg-white/72 px-4 py-3 text-sm text-black/72 shadow-soft"
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
                Explore deep improvement
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative min-h-[520px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="glass-panel absolute inset-8 rounded-[36px] border border-black/10 p-8 shadow-glow"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-black/45">Three paths</p>
                  <p className="font-display text-2xl font-semibold">Choose the level you need.</p>
                </div>
                <div className="rounded-full bg-ink px-4 py-2 text-sm text-bone">One-page ready</div>
              </div>

              <div className="grid gap-4">
                {paths.map((path, index) => (
                  <Card key={path.title} className="rounded-[24px] border-black/10 bg-white/80">
                    <CardContent className="flex items-start gap-4 p-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black/5 text-sm font-medium">
                        0{index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{path.title}</p>
                        <p className="mt-1 text-sm text-black/62">{path.body}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Score", icon: ScanSearch },
                  { label: "Preserve", icon: FileText },
                  { label: "Deep mode", icon: Sparkles }
                ].map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="rounded-[20px] border border-black/10 bg-white/75 p-4 text-sm"
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
                  repeat: Number.POSITIVE_INFINITY,
                  duration: 7 + index,
                  ease: "easeInOut"
                }}
                className="w-40 rounded-[28px] border border-black/10 bg-white/88 p-4 shadow-soft backdrop-blur-lg"
              >
                <div className={`mb-3 h-2 w-12 rounded-full ${card.color}`} />
                <p className="text-xs uppercase tracking-[0.18em] text-black/45">{card.label}</p>
                <p className="mt-2 font-display text-xl font-semibold">{card.score}</p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
