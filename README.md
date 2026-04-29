# ThankYouLove

ThankYouLove is a Next.js MVP for ATS-focused resume optimization. A user uploads a resume and a job description, gets a weighted ATS score with an explanation, reviews a truthful rewrite, optionally answers a deeper questionnaire, and exports both `DOCX` and `PDF`.

## What it does

- Upload resume as `DOCX`, `PDF`, or text
- Upload or paste a job description as `DOCX`, `PDF`, or text
- Parse both inputs into structured JSON
- Compute weighted ATS scores across keyword, semantic, title, domain, quantified impact, hard-filter, and readability factors
- Explain why the score is what it is
- Generate a safer improved resume using only supported information
- Preserve the uploaded `DOCX` as the preferred export template when available
- Keep one-page mode and same-format mode visible in the UI
- Run a structured deep-improvement questionnaire with stored answers
- Export `DOCX` and `PDF`
- Inspect extracted JSON, overlap, scoring, and prompt scaffolding in a debug panel

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Lightweight shadcn-style component structure
- `pdf-parse` for PDF extraction
- `mammoth` for DOCX text extraction
- `jszip` for DOCX template patching
- `docx` and `jspdf` for export generation
- `zod` for schema validation
- `framer-motion` for the animated hero

## Key product behavior

### DOCX-first preservation

If the user uploads a `DOCX`, ThankYouLove stores it as the preferred export template and patches `word/document.xml` in place during export. This keeps the original structure, paragraph styling, and layout much closer to the uploaded resume than rebuilding from scratch.

This is still a best-effort template-preserving approach, not a byte-perfect Word layout engine. Exact preservation is much more realistic with `DOCX` than with `PDF`, which is why the product explicitly prefers `DOCX`.

### PDF handling

`PDF` uploads are supported for parsing and analysis. When the source is only a `PDF`, the app can still generate a clean `DOCX` and `PDF`, but exact source styling cannot be guaranteed because the original editable Word structure is unavailable.

### One-page bias

The rewrite flow and export copy are tuned toward one-page output by default. The UI keeps one-page mode on by default and surfaces that constraint in the improvement and export views.

## Pages

- `/` landing page with animated hero
- `/upload` upload and input page
- `/dashboard` ATS score dashboard
- `/improve` resume diff and rewrite controls
- `/questionnaire` deep improvement flow
- `/export` final export and recruiter note
- `/profiles` saved sessions
- `/debug` admin/debug inspection panel

## Local demo data

The upload page includes a `Load demo data` action backed by seeded example resume and JD text in [src/lib/demo-data.ts](/Users/lovesachdeva/Documents/ThankYouLove/src/lib/demo-data.ts).

## Project structure

- [src/app](/Users/lovesachdeva/Documents/ThankYouLove/src/app) route pages and API routes
- [src/components](/Users/lovesachdeva/Documents/ThankYouLove/src/components) UI and product components
- [src/lib/analysis.ts](/Users/lovesachdeva/Documents/ThankYouLove/src/lib/analysis.ts) end-to-end orchestration
- [src/lib/parsing](/Users/lovesachdeva/Documents/ThankYouLove/src/lib/parsing) file extraction and profile parsers
- [src/lib/scoring](/Users/lovesachdeva/Documents/ThankYouLove/src/lib/scoring) weighted ATS scoring engine
- [src/lib/rewrite](/Users/lovesachdeva/Documents/ThankYouLove/src/lib/rewrite) prompt scaffolding and truthful rewrite logic
- [src/lib/export](/Users/lovesachdeva/Documents/ThankYouLove/src/lib/export) template patching and file export helpers
- [src/lib/questionnaire.ts](/Users/lovesachdeva/Documents/ThankYouLove/src/lib/questionnaire.ts) deep improvement question bank
- [src/lib/client-store.ts](/Users/lovesachdeva/Documents/ThankYouLove/src/lib/client-store.ts) client-side session persistence

## Getting started

```bash
pnpm install --no-frozen-lockfile
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
pnpm typecheck
pnpm build
```

Both commands were run successfully in this workspace.

## Current limitations

- The score and rewrite engine are deterministic heuristics, not an external LLM integration.
- DOCX preservation is strong only when the uploaded resume is an actual `DOCX`.
- PDF export is generated from the improved text and does not guarantee the original source styling.
- Session persistence is client-side local storage in this MVP.
