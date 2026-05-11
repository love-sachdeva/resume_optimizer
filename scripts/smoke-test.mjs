import {
  genericKeywordRegressionFixtures,
  rolePackRegressionFixtures,
  universalBlueprintRegressionFixtures
} from "./fixtures/role-pack-regression-fixtures.mjs";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const ilovePdfSitePublicKey = "project_public_c905dd1c01e9fd776983ca40d0a9d2f3";
const ilovePdfPublicKey = process.env.ILOVEPDF_PUBLIC_KEY || process.env.ILOVEAPI_PUBLIC_KEY || "";
const hasValidIlovePdfConfig = Boolean(ilovePdfPublicKey && ilovePdfPublicKey !== ilovePdfSitePublicKey);

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
  if (!improved?.rewritePlan?.targetCharRange || !Array.isArray(improved.rewritePlan.safeKeywords)) {
    throw new Error("Improve response did not include the rewrite plan QA contract.");
  }
  if (!improved?.layoutInventory?.candidateLines?.length) {
    throw new Error("Improve response did not include a usable layout inventory.");
  }
  console.log(`OK improve lineDiffs=${improved.lineDiffs.length}`);

  for (const fixture of rolePackRegressionFixtures) {
    const fixtureResponse = await fetch(`${baseUrl}/api/improve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        resumeText: sampleResume,
        jobText: fixture.job,
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
    await expectOk(fixtureResponse, `/api/improve fixture ${fixture.name}`);
    const fixtureImproved = await fixtureResponse.json();
    if (fixtureImproved?.rewritePlan?.rolePack !== fixture.expectedRolePack) {
      throw new Error(
        `${fixture.name} expected role pack ${fixture.expectedRolePack}, got ${fixtureImproved?.rewritePlan?.rolePack}`
      );
    }
  }
  console.log(`OK improve role-pack booster fixtures=${rolePackRegressionFixtures.length}`);

  for (const fixture of genericKeywordRegressionFixtures) {
    const fixtureResponse = await fetch(`${baseUrl}/api/improve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        resumeText: sampleResume,
        jobText: fixture.job,
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
    await expectOk(fixtureResponse, `/api/improve generic fixture ${fixture.name}`);
    const fixtureImproved = await fixtureResponse.json();
    if (fixtureImproved?.rewritePlan?.rolePack !== fixture.expectedRolePack) {
      throw new Error(
        `${fixture.name} should stay on the generic dynamic keyword path, got ${fixtureImproved?.rewritePlan?.rolePack}`
      );
    }
    const safeKeywords = fixtureImproved?.rewritePlan?.safeKeywords ?? [];
    if (
      !fixture.expectedKeywordSignals.some((signal) =>
        safeKeywords.some((keyword) => keyword.toLowerCase().includes(signal))
      )
    ) {
      throw new Error(`${fixture.name} did not retain dynamic JD keyword signals.`);
    }
  }
  console.log(`OK improve generic dynamic fixtures=${genericKeywordRegressionFixtures.length}`);

  for (const fixture of universalBlueprintRegressionFixtures) {
    const fixtureResponse = await fetch(`${baseUrl}/api/improve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        resumeText: sampleResume,
        jobText: fixture.job,
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
    await expectOk(fixtureResponse, `/api/improve universal fixture ${fixture.name}`);
    const fixtureImproved = await fixtureResponse.json();
    const rewritePlan = fixtureImproved?.rewritePlan ?? {};
    if (rewritePlan.positioningArchetype !== fixture.expectedArchetype) {
      throw new Error(
        `${fixture.name} expected archetype ${fixture.expectedArchetype}, got ${rewritePlan.positioningArchetype}`
      );
    }
    if (!Array.isArray(rewritePlan.evidenceMap) || rewritePlan.evidenceMap.length === 0) {
      throw new Error(`${fixture.name} did not include an evidence map.`);
    }
    const priorityKeywords = rewritePlan.jdPriorityKeywords ?? [];
    if (
      !fixture.expectedSignals.some((signal) =>
        priorityKeywords.some((keyword) => keyword.toLowerCase().includes(signal.toLowerCase()))
      )
    ) {
      throw new Error(`${fixture.name} did not surface expected JD priority signals.`);
    }
    if (!["target-90", "best-effort", "capped"].includes(rewritePlan.scoreReachability)) {
      throw new Error(`${fixture.name} did not set score reachability.`);
    }
  }
  console.log(`OK improve universal blueprint fixtures=${universalBlueprintRegressionFixtures.length}`);

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

  const [{ Document, Packer, Paragraph }, JSZipModule] = await Promise.all([
    import("docx"),
    import("jszip")
  ]);
  const templateDoc = new Document({
    sections: [
      {
        children: [
          new Paragraph("NAME"),
          new Paragraph("Education"),
          new Paragraph("Built dashboard for ops teams"),
          new Paragraph("Skills"),
          new Paragraph("SQL, Excel")
        ]
      }
    ]
  });
  const templateBuffer = await Packer.toBuffer(templateDoc);
  const guardedExportForm = new FormData();
  guardedExportForm.set(
    "templateFile",
    new File([templateBuffer], "template.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    })
  );
  guardedExportForm.set("originalText", "NAME\nEducation\nBuilt dashboard for ops teams\nSkills\nSQL, Excel");
  guardedExportForm.set("exportText", "EMAIL\nBuilt product dashboard for ops teams\nSkills\nSQL, Excel, Dashboarding");
  guardedExportForm.set(
    "lineDiffs",
    JSON.stringify([
      {
        original: "Built dashboard for ops teams",
        improved: "Built product dashboard for ops teams"
      }
    ])
  );
  guardedExportForm.set(
    "skillsDiff",
    JSON.stringify({
      section: "Skills",
      original: "SQL, Excel",
      improved: "SQL, Excel, Dashboarding",
      accepted: true,
      insertedSkills: ["Dashboarding"]
    })
  );
  guardedExportForm.set("qualityMode", "visual-fit-first");
  guardedExportForm.set("candidateName", "candidate");
  guardedExportForm.set("companyName", "company");

  const guardedDocxResponse = await fetch(`${baseUrl}/api/export/docx`, {
    method: "POST",
    body: guardedExportForm
  });
  await expectOk(guardedDocxResponse, "/api/export/docx guarded template");
  const guardedZip = await JSZipModule.default.loadAsync(
    Buffer.from(await guardedDocxResponse.arrayBuffer())
  );
  const guardedXml = await guardedZip.file("word/document.xml").async("string");
  if (!guardedXml.includes("NAME") || !guardedXml.includes("Education")) {
    throw new Error("Guarded DOCX export overwrote structural resume lines.");
  }
  if (!guardedXml.includes("Built product dashboard for ops teams")) {
    throw new Error("Guarded DOCX export did not apply the explicit line diff.");
  }
  if (!guardedXml.includes("SQL, Excel, Dashboarding")) {
    throw new Error("Guarded DOCX export did not apply the explicit skills diff.");
  }
  console.log("OK export/docx guarded structural and skills lines");

  const pdfResponse = await fetch(`${baseUrl}/api/export/pdf`, {
    method: "POST",
    body: (() => {
      const pdfForm = new FormData();
      pdfForm.set("originalText", analysis.resumeProfile.rawText);
      pdfForm.set("exportText", improved.exportText);
      pdfForm.set("lineDiffs", JSON.stringify(improved.lineDiffs ?? []));
      pdfForm.set("skillsDiff", JSON.stringify(improved.rewritePlan?.skillsDiff ?? null));
      pdfForm.set("candidateName", analysis.resumeProfile.identity.name || "candidate");
      pdfForm.set(
        "companyName",
        analysis.jobDescriptionProfile.company || analysis.jobDescriptionProfile.roleTitle || "company"
      );
      return pdfForm;
    })()
  });
  if (pdfResponse.status === 409 && !hasValidIlovePdfConfig) {
    const payload = await pdfResponse.json().catch(() => ({}));
    if (!/ILOVEPDF_PUBLIC_KEY|ILOVEAPI_PUBLIC_KEY|valid iLoveAPI project key/i.test(String(payload.error || ""))) {
      throw new Error("/api/export/pdf returned 409 for an unexpected reason.");
    }
    console.log("SKIP export/pdf exact conversion (valid iLoveAPI key not configured)");
  } else {
    await expectOk(pdfResponse, "/api/export/pdf");
    const pdfType = pdfResponse.headers.get("Content-Type") || "";
    if (!pdfType.includes("application/pdf")) {
      throw new Error(`/api/export/pdf should return application/pdf, got ${pdfType}`);
    }
    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    if (
      pdfBytes.length < 500 ||
      String.fromCharCode(pdfBytes[0], pdfBytes[1], pdfBytes[2], pdfBytes[3]) !== "%PDF"
    ) {
      throw new Error("/api/export/pdf returned a body that does not look like a PDF.");
    }
    console.log("OK export/pdf");
  }

  console.log("Smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
