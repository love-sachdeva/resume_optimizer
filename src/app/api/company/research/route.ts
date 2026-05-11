import { NextResponse } from "next/server";

import { clamp } from "@/lib/utils";

export const runtime = "nodejs";

type Citation = {
  title: string;
  url: string;
  source: string;
};

type ResearchSignal = {
  title: string;
  url: string;
  source: string;
  text: string;
};

const NEGATIVE_CULTURE = [
  "toxic",
  "burnout",
  "overwork",
  "long hours",
  "bad management",
  "poor work life",
  "work-life balance issues",
  "salary delay",
  "delayed salary",
  "underpaid",
  "pip",
  "harassment"
];

const NEGATIVE_STABILITY = [
  "layoff",
  "laid off",
  "fired",
  "shutdown",
  "shut down",
  "bankruptcy",
  "insolvency",
  "losses",
  "funding crunch",
  "down round",
  "restructuring"
];

const POSITIVE_STABILITY = [
  "funding",
  "raised",
  "profitable",
  "profit",
  "growth",
  "expands",
  "hiring",
  "acquisition",
  "ipo",
  "revenue"
];

const POSITIVE_CULTURE = [
  "best workplace",
  "great place to work",
  "work life balance",
  "flexible",
  "employee friendly",
  "positive culture"
];

function timeoutSignal(ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout)
  };
}

async function fetchJson(url: string) {
  const timeout = timeoutSignal(4500);
  try {
    const response = await fetch(url, {
      signal: timeout.signal,
      headers: {
        "User-Agent": "ThankYouLoveCompanyResearch/1.0"
      }
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  } finally {
    timeout.clear();
  }
}

function compact(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, values: string[]) {
  const lower = text.toLowerCase();
  return values.filter((value) => lower.includes(value));
}

function extractLpaValues(...values: string[]) {
  const joined = values.join(" ");
  const matches = [...joined.matchAll(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lakhs|lac|lacs|l\b)/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0 && value < 200);

  const rangeNearComp = joined.match(/(?:ctc|package|compensation|salary)[^\d]{0,40}(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/i);
  if (rangeNearComp) {
    matches.push(Number(rangeNearComp[1]), Number(rangeNearComp[2]));
  }

  return matches;
}

function scoreCompensation(ctc: string, description: string) {
  const values = extractLpaValues(ctc, description);
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;

  if (!max) {
    return { score: 60, min, max, label: "Compensation unavailable" };
  }
  if (max >= 25) return { score: 94, min, max, label: "Strong package" };
  if (max >= 23) return { score: 88, min, max, label: "Good package" };
  if (max >= 18) return { score: 74, min, max, label: "Acceptable package" };
  if (max >= 12) return { score: 58, min, max, label: "Below preferred package" };
  return { score: 40, min, max, label: "Low package" };
}

function hasAnySignal(...groups: ResearchSignal[][]) {
  return groups.some((group) => group.length > 0);
}

function inferRoleLevel(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();
  if (/\b(intern|trainee)\b/.test(text)) return "intern";
  if (/\b(senior|lead|principal|head|director)\b/.test(text)) return "senior";
  if (/\b(manager|specialist|consultant|associate)\b/.test(text)) return "mid";
  return "entry";
}

function scoreRolePay(title: string, description: string, maxLpa: number) {
  if (!maxLpa) return 62;
  const level = inferRoleLevel(title, description);
  const expected = level === "senior" ? 35 : level === "mid" ? 23 : level === "intern" ? 8 : 14;
  return clamp((maxLpa / expected) * 86, 35, 98);
}

function dimensionFlag(label: string, score: number, positive: string, negative: string) {
  if (score >= 72) {
    return { tone: "green" as const, text: `${label}: ${positive}` };
  }
  if (score <= 58) {
    return { tone: "red" as const, text: `${label}: ${negative}` };
  }
  return { tone: "neutral" as const, text: `${label}: mixed or insufficient signal` };
}

async function fetchGdeltSignals(company: string) {
  const query = encodeURIComponent(`"${company}" (layoffs OR funding OR culture OR salary OR revenue OR hiring)`);
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=ArtList&format=json&maxrecords=8&sort=HybridRel`;
  const data = await fetchJson(url);
  const articles = Array.isArray(data?.articles) ? data.articles : [];
  return articles.map((article: any): ResearchSignal => ({
    title: compact(article.title),
    url: String(article.url ?? ""),
    source: compact(article.sourceCountry || article.domain || "GDELT"),
    text: compact(`${article.title ?? ""} ${article.seendate ?? ""} ${article.domain ?? ""}`)
  })).filter((signal: ResearchSignal) => signal.title && signal.url);
}

async function fetchHnSignals(company: string) {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(`${company} layoffs funding culture salary`)}&tags=story&hitsPerPage=5`;
  const data = await fetchJson(url);
  const hits = Array.isArray(data?.hits) ? data.hits : [];
  return hits.map((hit: any): ResearchSignal => ({
    title: compact(hit.title || hit.story_title),
    url: String(hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`),
    source: "Hacker News",
    text: compact(`${hit.title || hit.story_title || ""} ${hit.url || ""}`)
  })).filter((signal: ResearchSignal) => signal.title && signal.url);
}

async function fetchRedditSignals(company: string) {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(`"${company}" work culture layoffs salary`)}&limit=5&sort=relevance&t=year`;
  const data = await fetchJson(url);
  const children = Array.isArray(data?.data?.children) ? data.data.children : [];
  return children.map((child: any): ResearchSignal => {
    const post = child.data ?? {};
    return {
      title: compact(post.title),
      url: `https://www.reddit.com${post.permalink ?? ""}`,
      source: "Reddit",
      text: compact(`${post.title ?? ""} ${post.selftext ?? ""}`)
    };
  }).filter((signal: ResearchSignal) => signal.title && signal.url);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const company = compact(body.company);
    const title = compact(body.title);
    const ctc = compact(body.ctc);
    const description = compact(body.description);

    if (!company) {
      return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    }

    const [gdelt, hn, reddit] = await Promise.all([
      fetchGdeltSignals(company),
      fetchHnSignals(company),
      fetchRedditSignals(company)
    ]);
    const hasPublicSignals = hasAnySignal(gdelt, hn, reddit);
    const signals = [...gdelt, ...hn, ...reddit].slice(0, 14);
    const signalText = signals.map((signal) => signal.text).join(" ");
    const negativeCulture = includesAny(signalText, NEGATIVE_CULTURE);
    const negativeStability = includesAny(signalText, NEGATIVE_STABILITY);
    const positiveCulture = includesAny(signalText, POSITIVE_CULTURE);
    const positiveStability = includesAny(signalText, POSITIVE_STABILITY);
    const compensation = scoreCompensation(ctc, description);
    const rolePay = scoreRolePay(title, description, compensation.max);

    if (!hasPublicSignals && !compensation.max) {
      return NextResponse.json(
        {
          error:
            "Company research needs public signals or disclosed compensation. No reliable no-key source returned evidence for this company."
        },
        { status: 424 }
      );
    }

    const culture = hasPublicSignals
      ? clamp(62 + positiveCulture.length * 6 - negativeCulture.length * 14)
      : 55;
    const stability = hasPublicSignals
      ? clamp(62 + positiveStability.length * 6 - negativeStability.length * 18)
      : 55;
    const evidencePenalty = hasPublicSignals ? 0 : 10;
    const score = Math.round(
      compensation.score * 0.35 +
        culture * 0.25 +
        stability * 0.25 +
        rolePay * 0.15 -
        evidencePenalty
    );

    const citations: Citation[] = signals.slice(0, 8).map((signal) => ({
      title: signal.title,
      url: signal.url,
      source: signal.source
    }));
    const dimensionFlags = [
      dimensionFlag(
        "Pay",
        compensation.score,
        compensation.max
          ? `${compensation.label.toLowerCase()} at ${compensation.max} LPA max`
          : "package is not disclosed, so no pay risk was confirmed",
        compensation.max
          ? `package looks low for this audience at ${compensation.max} LPA max`
          : "package is not disclosed"
      ),
      dimensionFlag(
        "Culture",
        culture,
        positiveCulture.length
          ? `positive public signal around ${positiveCulture.slice(0, 2).join(", ")}`
          : "no strong toxic-culture signal found in public no-key sources",
        negativeCulture.length
          ? `risk signal around ${negativeCulture.slice(0, 2).join(", ")}`
          : "weak or missing culture evidence"
      ),
      dimensionFlag(
        "Stability",
        stability,
        positiveStability.length
          ? `positive public signal around ${positiveStability.slice(0, 2).join(", ")}`
          : "no major layoff/funding risk found in public no-key sources",
        negativeStability.length
          ? `risk signal around ${negativeStability.slice(0, 2).join(", ")}`
          : "weak or missing stability evidence"
      ),
      dimensionFlag(
        "Role-pay fit",
        rolePay,
        "pay appears reasonable for the inferred role level",
        "pay may be light for the inferred role level"
      )
    ];
    const greenFlags = dimensionFlags
      .filter((flag) => flag.tone === "green")
      .map((flag) => flag.text);
    const redFlags = dimensionFlags
      .filter((flag) => flag.tone === "red")
      .map((flag) => flag.text);

    const confidence = signals.length >= 5 ? "medium" : signals.length >= 2 ? "low" : "low";

    return NextResponse.json(
      {
        score,
        confidence,
        summary:
          signals.length > 0
            ? `${company} was scored on pay, culture risk, stability risk, and role-pay fit using ${signals.length} public no-key signal(s). Treat this as directional, not a final verdict.`
            : `${company} was scored only on disclosed package and inferred role-pay fit because public culture/stability sources returned no evidence.`,
        breakdown: {
          compensation: Math.round(compensation.score),
          culture: Math.round(culture),
          stability: Math.round(stability),
          rolePay: Math.round(rolePay)
        },
        compensation,
        greenFlags: greenFlags.slice(0, 5),
        redFlags: redFlags.slice(0, 5),
        citations
      },
      {
        headers: {
          "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to research company." },
      { status: 400 }
    );
  }
}
