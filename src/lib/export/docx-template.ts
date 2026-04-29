import JSZip from "jszip";
import { type Document as XmlDocument, type Element as XmlElement, type Node as XmlNode } from "@xmldom/xmldom";

import { buildStyledDocxFromLayout } from "@/lib/export/layout";
import { verifyDocxRender, type RenderVerificationStatus } from "@/lib/export/render-verify";
import { buildExportBaseName } from "@/lib/export/shared";
import {
  collectWordParagraphs,
  extractWordParagraphText,
  normalizeDocxComparableLine,
  parseWordDocumentXml,
  serializeWordDocumentXml,
  splitDocumentLines
} from "@/lib/parsing/docx-xml";

type LineDiffInput = {
  original?: string;
  improved?: string;
};

type DocxExportQa = {
  patchedLines: number;
  trailingBlankRowsRemoved: number;
  visibleParagraphsBefore: number;
  visibleParagraphsAfter: number;
  renderVerification: RenderVerificationStatus;
  compressedLines: number;
};

const TARGET_LINE_MIN_CHARS = 115;
const TARGET_LINE_MAX_CHARS = 120;

function getLocalName(node: XmlNode) {
  return node.localName || node.nodeName.split(":").pop() || node.nodeName;
}

function walkElements(node: XmlNode, visitor: (element: XmlElement) => void) {
  if (node.nodeType === node.ELEMENT_NODE) {
    visitor(node as XmlElement);
  }

  for (let index = 0; index < node.childNodes.length; index += 1) {
    walkElements(node.childNodes[index], visitor);
  }
}

function collectTextElements(node: XmlNode) {
  const textElements: XmlElement[] = [];

  const visit = (current: XmlNode) => {
    if (current.nodeType === current.ELEMENT_NODE) {
      const element = current as XmlElement;

      if (getLocalName(element) === "t") {
        textElements.push(element);
      }
    }

    for (let index = 0; index < current.childNodes.length; index += 1) {
      visit(current.childNodes[index]);
    }
  };

  visit(node);
  return textElements;
}

function collectRunElements(node: XmlNode) {
  const runs: XmlElement[] = [];
  walkElements(node, (element) => {
    if (getLocalName(element) === "r") {
      runs.push(element);
    }
  });
  return runs;
}

function findFirstChildByLocalName(element: XmlElement, localName: string) {
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const child = element.childNodes[index];
    if (child.nodeType === child.ELEMENT_NODE && getLocalName(child) === localName) {
      return child as XmlElement;
    }
  }

  return null;
}

function setElementText(element: XmlElement, value: string) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  if (value.length > 0 && element.ownerDocument) {
    element.appendChild(element.ownerDocument.createTextNode(value));
  }

  if (/^\s|\s$| {2,}/.test(value)) {
    element.setAttribute("xml:space", "preserve");
  } else {
    element.removeAttribute("xml:space");
  }
}

function getRunText(run: XmlElement) {
  return collectTextElements(run)
    .map((element) => element.textContent ?? "")
    .join("");
}

function runIsBold(run: XmlElement) {
  const rPr = findFirstChildByLocalName(run, "rPr");
  if (!rPr) {
    return false;
  }

  let bold = false;
  walkElements(rPr, (element) => {
    if (getLocalName(element) === "b") {
      bold = true;
    }
  });
  return bold;
}

function cloneRunProperties(document: XmlDocument, run: XmlElement | undefined, forceBold = false) {
  const existing = run ? findFirstChildByLocalName(run, "rPr") : null;
  const rPr = existing
    ? (existing.cloneNode(true) as XmlElement)
    : document.createElementNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "w:rPr");

  if (forceBold && !Array.from({ length: rPr.childNodes.length }).some((_, index) => {
    const child = rPr.childNodes[index];
    return child.nodeType === child.ELEMENT_NODE && getLocalName(child) === "b";
  })) {
    rPr.appendChild(
      document.createElementNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "w:b")
    );
  }

  return rPr;
}

function createTextRun(document: XmlDocument, text: string, rPr: XmlElement) {
  const run = document.createElementNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "w:r");
  run.appendChild(rPr);
  const textElement = document.createElementNS(
    "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "w:t"
  );
  if (/^\s|\s$| {2,}/.test(text)) {
    textElement.setAttribute("xml:space", "preserve");
  }
  textElement.appendChild(document.createTextNode(text));
  run.appendChild(textElement);
  return run;
}

function metricSegments(text: string) {
  const segments: { text: string; bold: boolean }[] = [];
  const metricPattern =
    /(₹\s?\d+(?:\.\d+)?(?:[–-]\d+(?:\.\d+)?)?\s?(?:Cr|L|K)?(?:\/year)?|\d+(?:\.\d+)?(?:%|\+|x|M|K|L|Cr)?(?:\s*(?:units\/year|MW|daily meals|clients|vendors|partners|kitchens|riders|students|reach|ROAS|CTR))?)/gi;
  let cursor = 0;

  text.replace(metricPattern, (match, _capture, offset: number) => {
    if (offset > cursor) {
      segments.push({ text: text.slice(cursor, offset), bold: false });
    }
    segments.push({ text: match, bold: true });
    cursor = offset + match.length;
    return match;
  });

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), bold: false });
  }

  return segments.filter((segment) => segment.text.length > 0);
}

function normalizeLayoutText(value: string) {
  return value
    .replace(/\bApi\b/g, "API")
    .replace(/\bAi\b/g, "AI")
    .replace(/\bSeo\b/g, "SEO")
    .replace(/\bGtm\b/g, "GTM")
    .replace(/\s+(?:across|utilizing|leveraging)\s+(?:API|Api|stakeholder|Stakeholder|strategy|Strategy|business|Business|operations|Operations)\.?$/i, ".")
    .replace(/,\s*optimizing\s+(?:API|Api|stakeholder|Stakeholder|strategy|Strategy|business|Business|operations|Operations)\s+outcomes\.?$/i, ".")
    .replace(/\s+across\s+(API|Api|stakeholder|Stakeholder)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferBulletFormat(value: string) {
  const text = value.trim();
  if (/^[-*•●]?\s*(increased|reduced|improved|cut|unlocked|accelerated|enhanced|scaled|grew|saved|drove)\b/i.test(text)) {
    return "rac";
  }
  if (/\b(by|through|via|using)\b.+\b(resulting|leading|increasing|reducing|improving|cutting)\b/i.test(text)) {
    return "star";
  }
  return "action-impact";
}

function preserveReasoningFormat(original: string, candidate: string) {
  const format = inferBulletFormat(original);
  const prefix = candidate.match(/^(\s*[-*•●]\s*)/)?.[1] ?? "";
  const body = prefix ? candidate.slice(prefix.length) : candidate;
  const originalLead = original.replace(/^[-*•●]\s*/, "").trim().match(/^[A-Za-z]+/)?.[0] ?? "";

  if (format !== "rac" || !originalLead) {
    return candidate;
  }

  return `${prefix}${body.replace(/^[A-Za-z]+/, originalLead)}`;
}

function compressLineForLayout(original: string, candidate: string, aggressive = false) {
  const prefix = candidate.match(/^(\s*[-*•●]\s*)/)?.[1] ?? "";
  const body = prefix ? candidate.slice(prefix.length) : candidate;
  const originalBody = original.replace(/^[-*•●]\s*/, "");
  const limit = aggressive ? 108 : TARGET_LINE_MAX_CHARS;
  const maxLength = Math.min(
    Math.max(originalBody.trim().length + (aggressive ? 0 : 8), TARGET_LINE_MIN_CHARS),
    limit
  );
  let normalized = preserveReasoningFormat(original, `${prefix}${normalizeLayoutText(body)}`);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  normalized = normalized
    .replace(/\bend-to-end\b/gi, "E2E")
    .replace(/\bcross-functional\b/gi, "x-functional")
    .replace(/\bstakeholder\b/gi, "stakeholder")
    .replace(/\boperational\b/gi, "ops")
    .replace(/\boperations\b/gi, "ops")
    .replace(/\bapproximately\b/gi, "~")
    .replace(/\bsignificantly\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const boundary = normalized.lastIndexOf(" ", maxLength - 1);
  const clipped = normalized
    .slice(0, boundary > 80 ? boundary : maxLength)
    .replace(/\s+(with|for|through|by|and|to|in|across|using|via|while)\.?\s*$/i, "")
    .replace(/\s+(system|operational|responsive|internal|support|cross-functional)\s*$/i, "")
    .replace(/[,:;|-]\s*$/, "");
  return clipped.endsWith(".") ? clipped : `${clipped}.`;
}

function replaceParagraphWithStyledRuns(paragraph: XmlElement, nextText: string) {
  const document = paragraph.ownerDocument;
  if (!document) {
    replaceParagraphText(paragraph, nextText);
    return;
  }

  const runs = collectRunElements(paragraph).filter((run) => getRunText(run).length > 0);
  if (!runs.length) {
    replaceParagraphText(paragraph, nextText);
    return;
  }

  const bulletMatch = nextText.match(/^(\s*[-*•●]\s*)/);
  const bulletPrefix = bulletMatch?.[1] ?? "";
  const bodyText = bulletPrefix ? nextText.slice(bulletPrefix.length) : nextText;
  const bulletRun = runs.find((run) => /^[-*•●]\s*$/.test(getRunText(run))) ?? runs[0];
  const baseRun =
    runs.find((run) => !runIsBold(run) && !/^[-*•●]\s*$/.test(getRunText(run))) ?? runs[0];
  const boldRun = runs.find((run) => runIsBold(run)) ?? baseRun;
  const baseRPr = cloneRunProperties(document, baseRun, false);
  const boldRPr = cloneRunProperties(document, boldRun, true);
  const bulletRPr = cloneRunProperties(document, bulletRun, runIsBold(bulletRun));
  const pPr = findFirstChildByLocalName(paragraph, "pPr");
  const pPrClone = pPr ? (pPr.cloneNode(true) as XmlElement) : null;

  while (paragraph.firstChild) {
    paragraph.removeChild(paragraph.firstChild);
  }

  if (pPrClone) {
    paragraph.appendChild(pPrClone);
  }

  if (bulletPrefix) {
    paragraph.appendChild(createTextRun(document, bulletPrefix, bulletRPr));
  }

  metricSegments(bodyText).forEach((segment) => {
    paragraph.appendChild(
      createTextRun(
        document,
        segment.text,
        segment.bold ? (boldRPr.cloneNode(true) as XmlElement) : (baseRPr.cloneNode(true) as XmlElement)
      )
    );
  });
}

function splitAcrossTextNodes(nextText: string, textElements: XmlElement[]) {
  const cleanText = nextText.replace(/\t/g, "");
  const lengths = textElements.map((element) => Math.max(element.textContent?.length ?? 0, 1));
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  let usedWeight = 0;
  let cursor = 0;

  return lengths.map((length, index) => {
    usedWeight += length;

    if (index === lengths.length - 1) {
      return cleanText.slice(cursor);
    }

    const nextCursor = Math.round((usedWeight / totalLength) * cleanText.length);
    const chunk = cleanText.slice(cursor, nextCursor);
    cursor = nextCursor;
    return chunk;
  });
}

function replaceParagraphText(paragraph: XmlElement, nextText: string) {
  const textElements = collectTextElements(paragraph);
  if (!textElements.length) {
    return;
  }

  const chunks = splitAcrossTextNodes(nextText, textElements);
  textElements.forEach((element, index) => {
    setElementText(element, chunks[index] ?? "");
  });
}

function visibleParagraphs(paragraphs: XmlElement[]) {
  return paragraphs.filter((paragraph) =>
    normalizeDocxComparableLine(extractWordParagraphText(paragraph)).length > 0
  );
}

function resolvePatchTargets(
  paragraphs: XmlElement[],
  originalText: string | undefined,
  exportText: string,
  lineDiffs: LineDiffInput[] = [],
  aggressiveCompression = false
) {
  const templateLines = paragraphs.map((paragraph) => extractWordParagraphText(paragraph));
  const nextLines = splitDocumentLines(exportText);
  const replacementMap = new Map<string, string[]>();

  lineDiffs.forEach((diff) => {
    const original = typeof diff.original === "string" ? diff.original : "";
    const improved = typeof diff.improved === "string" ? diff.improved : "";
    if (!original || !improved) {
      return;
    }
    if (normalizeDocxComparableLine(original) === normalizeDocxComparableLine(improved)) {
      return;
    }

    const key = normalizeDocxComparableLine(original);
    const replacements = replacementMap.get(key) ?? [];
    replacements.push(compressLineForLayout(original, improved, aggressiveCompression));
    replacementMap.set(key, replacements);
  });

  if (originalText) {
    const originalLines = splitDocumentLines(originalText);

    originalLines.forEach((originalLine, index) => {
      const nextLine = nextLines[index];
      if (typeof nextLine !== "string") {
        return;
      }

      if (
        normalizeDocxComparableLine(originalLine) === normalizeDocxComparableLine(nextLine)
      ) {
        return;
      }

      const key = normalizeDocxComparableLine(originalLine);
      if (!key) {
        return;
      }

      if (replacementMap.has(key)) {
        return;
      }

      const replacements = replacementMap.get(key) ?? [];
      replacements.push(compressLineForLayout(originalLine, nextLine, aggressiveCompression));
      replacementMap.set(key, replacements);
    });
  }

  if (replacementMap.size > 0) {
    const targets: XmlElement[] = [];
    const currentLines: string[] = [];
    const mappedNextLines: string[] = [];

    visibleParagraphs(paragraphs).forEach((paragraph) => {
      const currentLine = extractWordParagraphText(paragraph);
      const key = normalizeDocxComparableLine(currentLine);
      const replacement = replacementMap.get(key)?.shift();

      if (!replacement) {
        return;
      }

      targets.push(paragraph);
      currentLines.push(currentLine);
      mappedNextLines.push(replacement);
    });

    if (targets.length > 0) {
      return {
        targets,
        currentLines,
        nextLines: mappedNextLines
      };
    }
  }

  // If the lengths match exactly, we assume a direct mapping
  if (templateLines.length === nextLines.length) {
    return {
      targets: paragraphs,
      currentLines: templateLines,
      nextLines
    };
  }

  // Best effort: find visible paragraphs and map them to visible export lines
  const textParagraphs = visibleParagraphs(paragraphs);
  const templateVisibleLines = textParagraphs.map((paragraph) => extractWordParagraphText(paragraph));
  const nextVisibleLines = nextLines.filter((line) => normalizeDocxComparableLine(line).length > 0);

  if (textParagraphs.length === nextVisibleLines.length) {
    return {
      targets: textParagraphs,
      currentLines: templateVisibleLines,
      nextLines: nextVisibleLines
    };
  }

  // If still no match, try to find specific bullets by content similarity
  // We use a simple fuzzy matching or "contains" check
  const mappedNextLines = templateVisibleLines.map(templateLine => {
    const normalizedTemplate = normalizeDocxComparableLine(templateLine);
    
    // Find the best match in nextVisibleLines
    let bestMatch = templateLine;
    let maxSimilarity = -1;

    nextVisibleLines.forEach(nextLine => {
        const normalizedNext = normalizeDocxComparableLine(nextLine);
        // Simple similarity: common words
        const wordsT = new Set(normalizedTemplate.split(" "));
        const wordsN = new Set(normalizedNext.split(" "));
        const intersection = [...wordsT].filter(w => wordsN.has(w));
        const similarity = intersection.length / Math.max(wordsT.size, wordsN.size);

        if (similarity > maxSimilarity && similarity > 0.4) {
            maxSimilarity = similarity;
            bestMatch = nextLine;
        }
    });

    return bestMatch;
  });

  return {
    targets: textParagraphs,
    currentLines: templateVisibleLines,
    nextLines: mappedNextLines
  };
}

function collectElementsByLocalName(root: XmlNode, localName: string) {
  const elements: XmlElement[] = [];
  walkElements(root, (element) => {
    if (getLocalName(element) === localName) {
      elements.push(element);
    }
  });
  return elements;
}

function directChildElementsByLocalName(element: XmlElement, localName: string) {
  const children: XmlElement[] = [];
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const child = element.childNodes[index];
    if (child.nodeType === child.ELEMENT_NODE && getLocalName(child) === localName) {
      children.push(child as XmlElement);
    }
  }
  return children;
}

function removeTrailingBlankRows(document: XmlDocument, enabled: boolean) {
  if (!enabled) {
    return 0;
  }

  let removed = 0;

  collectElementsByLocalName(document, "tbl").forEach((table) => {
    const rows = directChildElementsByLocalName(table, "tr");

    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index];
      const text = extractWordParagraphText(row).replace(/\s+/g, "").trim();

      if (text.length > 0) {
        break;
      }

      table.removeChild(row);
      removed += 1;
    }
  });

  return removed;
}

function buildQa(input: {
  patchedLines: number;
  trailingBlankRowsRemoved: number;
  visibleParagraphsBefore: number;
  visibleParagraphsAfter: number;
  renderVerification?: RenderVerificationStatus;
  compressedLines: number;
}): DocxExportQa {
  return {
    patchedLines: input.patchedLines,
    trailingBlankRowsRemoved: input.trailingBlankRowsRemoved,
    visibleParagraphsBefore: input.visibleParagraphsBefore,
    visibleParagraphsAfter: input.visibleParagraphsAfter,
    renderVerification: input.renderVerification ?? "unavailable",
    compressedLines: input.compressedLines
  };
}

async function applyTemplatePatch(input: {
  templateBuffer: Buffer;
  originalText?: string;
  exportText: string;
  lineDiffs?: LineDiffInput[];
  onePage: boolean;
  aggressiveCompression?: boolean;
}) {
  const zip = await JSZip.loadAsync(input.templateBuffer);
  const documentXmlFile = zip.file("word/document.xml");

  if (!documentXmlFile) {
    throw new Error("The uploaded DOCX is missing word/document.xml.");
  }

  const documentXml = await documentXmlFile.async("string");
  const document = parseWordDocumentXml(documentXml);
  const paragraphs = collectWordParagraphs(document);
  const visibleParagraphsBefore = visibleParagraphs(paragraphs).length;
  const patchTargets = resolvePatchTargets(
    paragraphs,
    input.originalText,
    input.exportText,
    input.lineDiffs,
    input.aggressiveCompression
  );

  if (!patchTargets) {
    return null;
  }

  let changed = false;
  let patchedLines = 0;
  let compressedLines = 0;
  patchTargets.targets.forEach((paragraph, index) => {
    const currentLine = patchTargets.currentLines[index] ?? "";
    const nextLine = patchTargets.nextLines[index] ?? currentLine;

    if (normalizeDocxComparableLine(currentLine) === normalizeDocxComparableLine(nextLine)) {
      return;
    }

    if (nextLine.length <= TARGET_LINE_MAX_CHARS) {
      compressedLines += 1;
    }

    changed = true;
    patchedLines += 1;
    replaceParagraphWithStyledRuns(paragraph, nextLine);
  });

  const trailingBlankRowsRemoved = removeTrailingBlankRows(document, input.onePage);
  changed = changed || trailingBlankRowsRemoved > 0;
  const visibleParagraphsAfter = visibleParagraphs(collectWordParagraphs(document)).length;

  if (!changed) {
    return {
      buffer: input.templateBuffer,
      qa: buildQa({
        patchedLines,
        trailingBlankRowsRemoved,
        visibleParagraphsBefore,
        visibleParagraphsAfter,
        compressedLines
      })
    };
  }

  zip.file("word/document.xml", serializeWordDocumentXml(document));

  return {
    buffer: await zip.generateAsync({ type: "nodebuffer" }),
    qa: buildQa({
      patchedLines,
      trailingBlankRowsRemoved,
      visibleParagraphsBefore,
      visibleParagraphsAfter,
      compressedLines
    })
  };
}

export async function patchDocxTemplate(input: {
  templateBuffer?: Buffer;
  originalText?: string;
  exportText: string;
  lineDiffs?: LineDiffInput[];
  onePage?: boolean;
  candidateName: string;
  companyName: string;
}) {
  if (!input.templateBuffer) {
    return buildStyledDocxFromLayout({
      exportText: input.exportText,
      candidateName: input.candidateName,
      companyName: input.companyName
    });
  }

  const onePage = input.onePage ?? true;
  const firstPass = await applyTemplatePatch({
    templateBuffer: input.templateBuffer,
    originalText: input.originalText,
    exportText: input.exportText,
    lineDiffs: input.lineDiffs,
    onePage
  });

  if (!firstPass) {
    return buildStyledDocxFromLayout({
      exportText: input.exportText,
      candidateName: input.candidateName,
      companyName: input.companyName
    });
  }

  const firstVerification = await verifyDocxRender({
    buffer: firstPass.buffer,
    onePage
  });

  if (firstVerification === "failed-multiple-pages" && onePage) {
    const retry = await applyTemplatePatch({
      templateBuffer: input.templateBuffer,
      originalText: input.originalText,
      exportText: input.exportText,
      lineDiffs: input.lineDiffs,
      onePage,
      aggressiveCompression: true
    });

    if (retry) {
      const retryVerification = await verifyDocxRender({
        buffer: retry.buffer,
        onePage
      });

      return {
        buffer: retry.buffer,
        fileName: `${buildExportBaseName(input.candidateName, input.companyName)}.docx`,
        preservedTemplate: true,
        qa: {
          ...retry.qa,
          renderVerification: retryVerification
        }
      };
    }
  }

  return {
    buffer: firstPass.buffer,
    fileName: `${buildExportBaseName(input.candidateName, input.companyName)}.docx`,
    preservedTemplate: true,
    qa: {
      ...firstPass.qa,
      renderVerification: firstVerification
    }
  };
}
