import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CoachQuestionAnswer = {
  question: string;
  answer?: string | string[];
  answerType?: string;
  options?: string[];
  mandatory?: boolean;
  fileName?: string;
};

const COACH_BASE_URL = "https://api.mastersunion.in/api/v1/placement";
const FILESTACK_API_KEY = "ANQWcFDQRUiGfBqjfgINQz";
const MAX_COACH_RESUME_BYTES = 1024 * 1024;

function jsonHeaders(token: string) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

async function readJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function fetchCoachProfile(token: string, userUuid: string) {
  const response = await fetch(`https://api.mastersunion.in/api/v1/users/${userUuid}/userProfile`, {
    headers: jsonHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`Coach profile fetch failed: ${response.status}`);
  }

  const payload = await readJsonSafe(response);
  return payload?.generalData ?? payload?.Data?.generalData ?? payload?.Data ?? {};
}

async function fetchCoachJob(token: string, userUuid: string, jobId: string) {
  const response = await fetch(`${COACH_BASE_URL}/job/getJobById/${jobId}?userId=${userUuid}`, {
    headers: jsonHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`Coach job fetch failed: ${response.status}`);
  }

  const payload = await readJsonSafe(response);
  return payload?.Data?.job ?? payload?.Data ?? {};
}

async function uploadToFilestack(file: File) {
  if (file.size > MAX_COACH_RESUME_BYTES) {
    throw new Error("Coach accepts resumes up to 1MB. Export a smaller DOCX before applying.");
  }

  const key = process.env.FILESTACK_API_KEY || FILESTACK_API_KEY;
  const uploadData = new FormData();
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  uploadData.append(
    "fileUpload",
    new Blob([fileBytes], { type: file.type || "application/octet-stream" }),
    file.name
  );

  const response = await fetch(`https://www.filestackapi.com/api/store/S3?key=${key}`, {
    method: "POST",
    body: uploadData
  });
  const payload = await readJsonSafe(response);

  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error || payload?.message || "Resume upload to Filestack failed.");
  }

  return {
    url: String(payload.url),
    fileName: String(payload.filename || file.name),
    size: Number(payload.size || file.size),
    mimeType: String(payload.type || file.type || "")
  };
}

async function saveManualResumeToCoach(
  token: string,
  userUuid: string,
  uploaded: { url: string; fileName: string }
) {
  const manualResumePayload = [
    {
      id: Date.now().toString(),
      link: uploaded.url,
      fileName: uploaded.fileName,
      isDeleted: false
    }
  ];

  const response = await fetch(`${COACH_BASE_URL}/application/updateManuallyUploadedResume/${userUuid}`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(manualResumePayload)
  });

  if (!response.ok) {
    const payload = await readJsonSafe(response);
    return payload?.message || `Manual resume library update failed: ${response.status}`;
  }

  return "";
}

function findExistingApplication(job: any, userUuid: string) {
  const applications = Array.isArray(job?.Applications) ? job.Applications : [];
  return applications.find((application: any) => application?.userId === userUuid && !application?.withDrawApplication);
}

function missingMandatoryQuestions(job: any, answers: CoachQuestionAnswer[]) {
  const answerMap = new Map(answers.map((answer) => [answer.question, answer.answer]));
  return (Array.isArray(job?.additionalQuestions) ? job.additionalQuestions : []).filter((question: any) => {
    if (!question?.mandatory || !question?.question) return false;
    const answer = answerMap.get(question.question);
    return Array.isArray(answer) ? answer.length === 0 : !String(answer ?? "").trim();
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const allowEnvFallback =
      process.env.COACH_ALLOW_ENV_FALLBACK === "true" || process.env.NODE_ENV !== "production";
    const token =
      String(formData.get("coachApiToken") ?? "").trim() ||
      (allowEnvFallback ? process.env.COACH_API_TOKEN : "");
    const userUuid =
      String(formData.get("coachUserUuid") ?? "").trim() ||
      (allowEnvFallback ? process.env.COACH_USER_UUID : "");
    const confirmApply = String(formData.get("confirmApply") ?? "") === "true";
    const jobId = String(formData.get("jobId") ?? "");
    const resumeFile = formData.get("resumeFile");
    const portfolio = String(formData.get("portfolio") ?? "");
    const linkedIn = String(formData.get("linkedIn") ?? "");
    const candidateName = String(formData.get("candidateName") ?? "");
    const candidateEmail = String(formData.get("candidateEmail") ?? "");
    const additionalAnswersRaw = String(formData.get("additionalAnswers") ?? "[]");

    if (!token || !userUuid) {
      return NextResponse.json(
        { error: "Connect your Coach LMS API token and user UUID in Account before applying." },
        { status: 401 }
      );
    }

    if (!confirmApply) {
      return NextResponse.json({ error: "Final apply confirmation is required." }, { status: 400 });
    }
    if (!jobId) {
      return NextResponse.json({ error: "Missing Coach job id." }, { status: 400 });
    }
    if (!(resumeFile instanceof File)) {
      return NextResponse.json({ error: "Missing selected resume file." }, { status: 400 });
    }

    let additionalAnswers: CoachQuestionAnswer[] = [];
    try {
      const parsed = JSON.parse(additionalAnswersRaw);
      additionalAnswers = Array.isArray(parsed) ? parsed : [];
    } catch {
      additionalAnswers = [];
    }

    const [profile, job] = await Promise.all([
      fetchCoachProfile(token, userUuid),
      fetchCoachJob(token, userUuid, jobId)
    ]);

    const mandatoryMisses = missingMandatoryQuestions(job, additionalAnswers);
    if (mandatoryMisses.length) {
      return NextResponse.json(
        {
          error: `Answer mandatory Coach question before applying: ${mandatoryMisses[0].question}`
        },
        { status: 400 }
      );
    }

    if (process.env.COACH_APPLY_DRY_RUN === "true") {
      const existingApplication = findExistingApplication(job, userUuid);
      return NextResponse.json({
        message: "Dry run: Coach application validated but no upload or submission was performed.",
        mode: existingApplication?.uuid ? "update" : "create",
        resumeFile: {
          name: resumeFile.name,
          size: resumeFile.size,
          type: resumeFile.type
        },
        links: {
          portfolioUrl: portfolio,
          linkedInUrl: linkedIn
        },
        requiredQuestions: Array.isArray(job?.additionalQuestions)
          ? job.additionalQuestions.filter((question: any) => question?.mandatory).length
          : 0
      });
    }

    const uploaded = await uploadToFilestack(resumeFile);
    const manualResumeWarning = await saveManualResumeToCoach(token, userUuid, uploaded);
    const existingApplication = findExistingApplication(job, userUuid);
    const profileName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
    const applicationPayload = {
      name: candidateName || profileName,
      email: candidateEmail || profile.officialEmail || profile.email || "",
      phoneNumber: profile.mobileNumber || "",
      image: profile.image || null,
      job_id: jobId,
      userId: userUuid,
      status: "Applied",
      shareInterest: false,
      applicationDate: existingApplication?.applicationDate || new Date().toISOString(),
      Links: {
        linkedInUrl: linkedIn,
        portfolioUrl: portfolio,
        resumes: [
          {
            resume: uploaded.url,
            resumeFileName: uploaded.fileName,
            resumeType: "manual"
          }
        ]
      },
      Additional_information: job.Additional_information || "",
      AdditionalQuestionsAndAnswer: additionalAnswers,
      ...(existingApplication?.uuid ? { uuid: existingApplication.uuid } : {})
    };

    const applyResponse = existingApplication?.uuid
      ? await fetch(`${COACH_BASE_URL}/application/applications/${existingApplication.uuid}`, {
          method: "PUT",
          headers: jsonHeaders(token),
          body: JSON.stringify(applicationPayload)
        })
      : await fetch(`${COACH_BASE_URL}/application/insertNewApplication`, {
          method: "POST",
          headers: jsonHeaders(token),
          body: JSON.stringify([applicationPayload])
        });
    const applyPayload = await readJsonSafe(applyResponse);

    if (!applyResponse.ok) {
      throw new Error(applyPayload?.message || `Coach application API failed: ${applyResponse.status}`);
    }

    return NextResponse.json({
      message: existingApplication?.uuid
        ? "Coach application updated with selected resume."
        : "Coach application submitted with selected resume.",
      mode: existingApplication?.uuid ? "update" : "create",
      uploadedResume: uploaded,
      warning: manualResumeWarning || undefined,
      coachResponse: applyPayload
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Coach application failed."
      },
      { status: 400 }
    );
  }
}
