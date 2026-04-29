export function extractJsonObject(raw: string) {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? raw.match(/```\s*([\s\S]*?)```/i)?.[1];
  const source = (fenced ?? raw).trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in provider response.");
  }

  return source.slice(start, end + 1);
}

export function parseJsonObject<T>(raw: string) {
  return JSON.parse(extractJsonObject(raw)) as T;
}
