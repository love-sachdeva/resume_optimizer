import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type RenderVerificationStatus =
  | "unavailable"
  | "passed-one-page"
  | "failed-multiple-pages"
  | "failed";

async function resolveLibreOfficeBinary() {
  for (const binary of ["soffice", "libreoffice"]) {
    try {
      const { stdout } = await execFileAsync("which", [binary], { timeout: 1500 });
      const resolved = stdout.trim();
      if (resolved) {
        return resolved;
      }
    } catch {
      // Try the next binary.
    }
  }

  return null;
}

function countPdfPages(pdfBuffer: Buffer) {
  const text = pdfBuffer.toString("latin1");
  return (text.match(/\/Type\s*\/Page\b/g) ?? []).length;
}

export async function verifyDocxRender(input: {
  buffer: Buffer;
  onePage: boolean;
}): Promise<RenderVerificationStatus> {
  const officeBinary = await resolveLibreOfficeBinary();
  if (!officeBinary) {
    return "unavailable";
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "thankyoulove-docx-"));

  try {
    const inputPath = path.join(workDir, "resume.docx");
    await writeFile(inputPath, input.buffer);

    await execFileAsync(
      officeBinary,
      ["--headless", "--convert-to", "pdf", "--outdir", workDir, inputPath],
      { timeout: 30000 }
    );

    const pdfFile = (await readdir(workDir)).find((file) => file.endsWith(".pdf"));
    if (!pdfFile) {
      return "failed";
    }

    const pageCount = countPdfPages(await readFile(path.join(workDir, pdfFile)));
    if (!input.onePage) {
      return pageCount > 0 ? "passed-one-page" : "failed";
    }

    return pageCount <= 1 ? "passed-one-page" : "failed-multiple-pages";
  } catch {
    return "failed";
  } finally {
    await rm(workDir, { force: true, recursive: true });
  }
}
