const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

const pageRoutes = [
  "/",
  "/upload",
  "/account",
  "/settings",
  "/jobs",
  "/profile",
  "/profiles",
  "/dashboard",
  "/improve",
  "/questionnaire",
  "/export",
  "/debug"
];

const sampleResume = `Aarav Malhotra
Bengaluru, India | aarav.malhotra@email.com | +91 98765 43210

SUMMARY
Analytical operator with experience across fintech products, GTM coordination, user research, and automation-led workflows.

EXPERIENCE
Founder's Office Associate | LedgerLoop | Jul 2023 - Present | Bengaluru
- Worked with product, ops, and engineering to launch merchant onboarding improvements for an SME payments product.
- Built SQL and spreadsheet dashboards tracking activation, drop-off, and support turnaround time.
- Spoke with merchants and internal teams to identify onboarding friction and suggested changes to reduce document rejection.

SKILLS
SQL, Excel, Notion, Jira, Figma, Customer Research, GTM`;

const sampleJob = `Associate Product Manager
NimbusPay | Bengaluru

Responsibilities
- Partner with engineering, design, compliance, and operations to drive onboarding improvements.
- Run user research, synthesize customer feedback, and prioritize product requirements.
- Define MVP scope, success metrics, PRDs, and launch plans for new payments experiences.
- Analyze funnel conversion, drop-offs, and operational metrics using SQL or BI tools.`;

async function expectOk(response, label) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${label} failed with ${response.status}: ${text.slice(0, 300)}`);
  }
}

async function main() {
  console.log(`Smoke testing ${baseUrl}`);

  for (const route of pageRoutes) {
    const response = await fetch(`${baseUrl}${route}`);
    await expectOk(response, route);
    console.log(`OK page ${route}`);
  }

  const analyzeForm = new URLSearchParams();
  analyzeForm.set("resumeText", sampleResume);
  analyzeForm.set("jobText", sampleJob);
  analyzeForm.set("answers", JSON.stringify({}));
  analyzeForm.set(
    "preferences",
    JSON.stringify({
      keepSameFormat: true,
      onePage: true,
      tone: "balanced",
      formatMode: "same-format"
    })
  );
  analyzeForm.set(
    "providerConfig",
    JSON.stringify({
      enabled: false,
      provider: "openai",
      apiKey: "",
      model: ""
    })
  );

  const analyzeResponse = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    body: analyzeForm
  });
  await expectOk(analyzeResponse, "/api/analyze");
  const analysis = await analyzeResponse.json();
  if (!analysis?.improvedResume?.exportText) {
    throw new Error("Analyze response did not include improved resume export text.");
  }
  console.log(
    `OK analyze ${Math.round(analysis.matchAnalysis.overallScore)} -> ${Math.round(
      analysis.improvedResume.estimatedScore
    )}`
  );

  const improveResponse = await fetch(`${baseUrl}/api/improve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      resumeText: analysis.resumeProfile.rawText,
      jobText: analysis.jobDescriptionProfile.rawText,
      answers: {},
      preferences: {
        keepSameFormat: true,
        onePage: true,
        tone: "balanced",
        formatMode: "same-format"
      },
      providerConfig: {
        enabled: false,
        provider: "openai",
        apiKey: "",
        model: ""
      }
    })
  });
  await expectOk(improveResponse, "/api/improve");
  const improved = await improveResponse.json();
  if (!Array.isArray(improved?.lineDiffs)) {
    throw new Error("Improve response did not include line diffs.");
  }
  console.log(`OK improve lineDiffs=${improved.lineDiffs.length}`);

  const exportForm = new FormData();
  exportForm.set("originalText", analysis.resumeProfile.rawText);
  exportForm.set("exportText", improved.exportText);
  exportForm.set("candidateName", analysis.resumeProfile.identity.name || "candidate");
  exportForm.set(
    "companyName",
    analysis.jobDescriptionProfile.company || analysis.jobDescriptionProfile.roleTitle || "company"
  );
  const docxResponse = await fetch(`${baseUrl}/api/export/docx`, {
    method: "POST",
    body: exportForm
  });
  await expectOk(docxResponse, "/api/export/docx");
  const docxBuffer = Buffer.from(await docxResponse.arrayBuffer());
  if (docxBuffer.length < 1000) {
    throw new Error("DOCX export response is unexpectedly small.");
  }
  console.log(
    `OK export/docx bytes=${docxBuffer.length} preserved=${docxResponse.headers.get("X-Template-Preserved")}`
  );

  const pdfResponse = await fetch(`${baseUrl}/api/export/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      exportText: improved.exportText,
      candidateName: analysis.resumeProfile.identity.name || "candidate",
      companyName:
        analysis.jobDescriptionProfile.company || analysis.jobDescriptionProfile.roleTitle || "company"
    })
  });
  if (pdfResponse.status !== 409) {
    throw new Error(`/api/export/pdf should return 409 while PDF export is disabled.`);
  }
  console.log("OK export/pdf disabled-state");

  console.log("Smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
