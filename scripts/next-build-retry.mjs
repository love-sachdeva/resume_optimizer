#!/usr/bin/env node
/**
 * Next.js occasionally flakes during "Finalizing page optimization" / trace steps
 * (ENOENT on export/500.html rename, missing manifests or chunks). A clean retry
 * usually succeeds without code changes.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(path.join(root, "package.json"));
const nextPkgDir = path.dirname(require.resolve("next/package.json"));
const nextBin = path.join(nextPkgDir, "dist", "bin", "next");
const maxAttempts = Number(process.env.NEXT_BUILD_ATTEMPTS || "4");

if (!fs.existsSync(nextBin)) {
  console.error(`Could not find Next.js CLI at ${nextBin}`);
  process.exit(1);
}

function rmRf(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  rmRf(path.join(root, ".next"));

  const result = spawnSync(process.execPath, [nextBin, "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env },
  });

  if (result.status === 0) {
    process.exit(0);
  }

  if (attempt < maxAttempts) {
    console.error(
      `\n[next-build-retry] Build attempt ${attempt}/${maxAttempts} failed — retrying with a fresh .next\n`,
    );
  }
}

process.exit(1);
