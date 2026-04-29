import { NextResponse } from "next/server";

function decodeHtmlEntities(value: string) {
  const entities: Record<string, string> = {
    nbsp: " ",
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
    ndash: "-",
    mdash: "-"
  };

  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, key) => entities[key.toLowerCase()] ?? match);
}

function cleanJobText(value: unknown) {
  if (!value) {
    return "";
  }

  return decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, " ")
    .replace(/[Â�]/g, "")
    .replace(/[●•]\s*/g, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function buildCompanyScore(job: any, cleanDesc: string) {
  let score = 52;

  if (job.isEligible) score += 12;
  if (job.ctcDetails || job.ctc) score += 10;
  if (cleanDesc.length > 700) score += 10;
  if (cleanJobText(job.Company?.companydesc).length > 120) score += 8;
  if (job.categoriesAndLocation?.location?.length) score += 5;
  if (job.deadline || job.applicationDeadline) score += 3;

  return Math.max(0, Math.min(100, score));
}

export async function POST(request: Request) {
  try {
    const token = process.env.COACH_API_TOKEN;
    const uuid = process.env.COACH_USER_UUID;

    if (!token || !uuid) {
      return NextResponse.json({ error: "Missing Coach LMS credentials in environment variables." }, { status: 401 });
    }

    const apiUrl = `https://api.mastersunion.in/api/v1/placement/job/getJobsForStudent/${uuid}?pageSize=100&pageNo=1`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from Coach LMS API: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.IsSuccess || !data.Data || !data.Data.jobs) {
      return NextResponse.json({ jobs: [] });
    }

    const rawJobs = data.Data.jobs;
    const mappedJobs = rawJobs.map((job: any) => {
      // location logic
      let locationStr = "Remote / Flexible";
      if (job.categoriesAndLocation?.location?.length > 0) {
         locationStr = job.categoriesAndLocation.location.map((l: any) => l.city).filter(Boolean).join(", ");
      }
      if (!locationStr) locationStr = "Remote / Flexible";

      // ctc logic
      let ctcStr = "Competitive";
      if (job.ctcDetails) {
         const min = job.ctcDetails.minCtc?.replace(/,00,000/g, "L");
         const max = job.ctcDetails.maxCtc?.replace(/,00,000/g, "L");
         if (min && max) ctcStr = `₹${min} - ₹${max}`;
         else if (min) ctcStr = `₹${min}`;
         else if (max) ctcStr = `₹${max}`;
      } else if (job.ctc) {
         ctcStr = `₹${(parseInt(job.ctc)/100000).toFixed(1)}L`;
      }
      
      const cleanDesc = cleanJobText(job.description);
      let cultureInfo = "Dynamic and fast-paced work environment.";
      if (job.Company?.companydesc) {
         cultureInfo = cleanJobText(job.Company.companydesc).substring(0, 220);
      }

      const companyScore = buildCompanyScore(job, cleanDesc);
      const fitStatus = job.isEligible ? "high" : "medium";

      return {
        id: job.uuid || job.id?.toString() || Math.random().toString(),
        title: job.title || "Untitled Role",
        company: job.companyName || "Confidential",
        location: locationStr,
        ctc: ctcStr,
        domain: job.categoriesAndLocation?.category || "General Management",
        date: job.createdAt ? new Date(job.createdAt).toLocaleDateString() : "Recently",
        description: cleanDesc,
        atsScore: null,
        companyScore,
        cultureScore: Number((companyScore / 20).toFixed(1)),
        cultureDetails: cultureInfo,
        source: "coach",
        fitStatus,
        eligible: Boolean(job.isEligible)
      };
    });

    return NextResponse.json({ jobs: mappedJobs });

  } catch (error: any) {
    console.error("Coach API Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
