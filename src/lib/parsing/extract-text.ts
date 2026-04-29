import mammoth from "mammoth";
import pdfParse from "pdf-parse";

import { extractDocxTextFromBuffer } from "@/lib/parsing/docx-xml";

export async function extractTextFromFile(file?: File | null) {
  if (!file) {
    return "";
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (
    extension === "txt" ||
    extension === "md" ||
    mimeType.includes("text/plain")
  ) {
    return buffer.toString("utf-8");
  }

  if (
    extension === "docx" ||
    mimeType.includes(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
  ) {
    try {
      const extracted = await extractDocxTextFromBuffer(buffer);
      if (extracted.trim()) {
        return extracted;
      }
    } catch {
      // Fall back to Mammoth if low-level XML extraction fails.
    }

    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (extension === "pdf" || mimeType.includes("pdf")) {
    const result = await pdfParse(buffer);
    return result.text;
  }

  throw new Error(`Unsupported file type: ${file.name}`);
}
