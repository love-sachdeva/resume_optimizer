import {
  DOMParser,
  XMLSerializer,
  type Document as XmlDocument,
  type Element as XmlElement,
  type Node as XmlNode
} from "@xmldom/xmldom";
import JSZip from "jszip";

function getLocalName(node: XmlNode) {
  if ("localName" in node && typeof node.localName === "string" && node.localName) {
    return node.localName;
  }

  return node.nodeName.split(":").pop() ?? node.nodeName;
}

function walkElements(node: XmlNode, visitor: (element: XmlElement) => void) {
  if (node.nodeType === node.ELEMENT_NODE) {
    visitor(node as XmlElement);
  }

  for (let index = 0; index < node.childNodes.length; index += 1) {
    walkElements(node.childNodes[index], visitor);
  }
}

export function splitDocumentLines(text: string) {
  return text.replace(/\r/g, "").split("\n");
}

export function normalizeDocxComparableLine(value: string) {
  return value
    .replace(/^[-*•]\s*/, "")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function parseWordDocumentXml(documentXml: string): XmlDocument {
  return new DOMParser().parseFromString(documentXml, "application/xml");
}

export function serializeWordDocumentXml(document: XmlDocument) {
  return new XMLSerializer().serializeToString(document);
}

export function collectWordParagraphs(root: XmlNode) {
  const paragraphs: XmlElement[] = [];

  walkElements(root, (element) => {
    if (getLocalName(element) === "p") {
      paragraphs.push(element);
    }
  });

  return paragraphs;
}

export function extractWordParagraphText(paragraph: XmlNode) {
  let text = "";

  walkElements(paragraph, (element) => {
    const localName = getLocalName(element);

    if (localName === "instrText") {
      return;
    }

    if (localName === "tab") {
      text += "\t";
      return;
    }

    if (localName === "br" || localName === "cr") {
      text += "\n";
      return;
    }

    if (localName === "t") {
      text += element.textContent ?? "";
    }
  });

  return text;
}

export async function extractDocxParagraphLinesFromBuffer(
  buffer: Buffer | Uint8Array | ArrayBuffer
) {
  const normalizedBuffer =
    buffer instanceof ArrayBuffer ? Buffer.from(buffer) : Buffer.from(buffer);
  const zip = await JSZip.loadAsync(normalizedBuffer);
  const documentXmlFile = zip.file("word/document.xml");

  if (!documentXmlFile) {
    throw new Error("The uploaded DOCX is missing word/document.xml.");
  }

  const documentXml = await documentXmlFile.async("string");
  const document = parseWordDocumentXml(documentXml);
  return collectWordParagraphs(document).map((paragraph) => extractWordParagraphText(paragraph));
}

export async function extractDocxTextFromBuffer(buffer: Buffer | Uint8Array | ArrayBuffer) {
  return (await extractDocxParagraphLinesFromBuffer(buffer)).join("\n");
}
