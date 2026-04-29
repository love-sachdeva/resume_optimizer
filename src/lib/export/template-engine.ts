import JSZip from "jszip";
import fs from "fs";

/**
 * Surgically replaces text in a DOCX file while preserving all formatting.
 * This works by opening the DOCX (zip), modifying word/document.xml, and re-zipping.
 */
export async function generateResumeFromTemplate(templatePath: string, replacements: Map<string, string>) {
  const data = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(data);
  let docXml = await zip.file("word/document.xml")?.async("string");

  if (!docXml) {
    throw new Error("Could not find word/document.xml in template.");
  }

  // We iterate through the replacements and find the corresponding <w:t> tags.
  // Note: Word sometimes splits a single sentence into multiple <w:t> tags.
  // A robust approach is needed, but for simple exact matches, this works:
  replacements.forEach((improved, original) => {
    // Escape XML special characters in the text
    const escapedOriginal = original.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const escapedImproved = improved.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    if (docXml && docXml.includes(escapedOriginal)) {
      docXml = docXml.replace(escapedOriginal, escapedImproved);
    } else {
       // Fallback: Word might have split the text across multiple runs.
       // For now, we'll log it and try a more fuzzy match if needed.
       console.warn(`Could not find exact match for bullet: ${original}`);
    }
  });

  zip.file("word/document.xml", docXml);
  return await zip.generateAsync({ type: "nodebuffer" });
}
