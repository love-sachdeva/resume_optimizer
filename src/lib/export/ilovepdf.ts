import { createHmac } from "node:crypto";

const ILOVEPDF_AUTH_URL = "https://api.ilovepdf.com/v1/auth";
const ILOVEPDF_START_URL = "https://api.ilovepdf.com/v1/start/officepdf";
const SITE_PUBLIC_KEY = "project_public_c905dd1c01e9fd776983ca40d0a9d2f3";

type IloveStartResponse = {
  server: string;
  task: string;
};

type IloveUploadResponse = {
  server_filename: string;
};

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(publicKey: string, secretKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: publicKey,
      iat: now,
      nbf: now - 10,
      exp: now + 55 * 60
    })
  );
  const signature = base64Url(createHmac("sha256", secretKey).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${signature}`;
}

function getIlovePdfConfig() {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY || process.env.ILOVEAPI_PUBLIC_KEY || "";
  const secretKey = process.env.ILOVEPDF_SECRET_KEY || process.env.ILOVEAPI_SECRET_KEY || "";
  const staticJwt =
    process.env.ILOVEPDF_JWT ||
    process.env.ILOVEAPI_JWT ||
    process.env.ILOVEPDF_TOKEN ||
    process.env.ILOVEAPI_TOKEN ||
    "";
  return { publicKey, secretKey, staticJwt };
}

async function readApiError(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) {
    return `${response.status} ${response.statusText}`;
  }

  try {
    const payload = JSON.parse(text) as { error?: { message?: string; type?: string; code?: string | number } };
    const message = payload.error?.message || text;
    const type = payload.error?.type ? `${payload.error.type}: ` : "";
    const code = payload.error?.code ? ` (${payload.error.code})` : "";
    return `${type}${message}${code}`;
  } catch {
    return text.slice(0, 500);
  }
}

async function expectJson<T>(response: Response, step: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${step} failed: ${await readApiError(response)}`);
  }
  return (await response.json()) as T;
}

async function getBearerToken() {
  const { publicKey, secretKey, staticJwt } = getIlovePdfConfig();

  if (staticJwt.trim()) {
    return staticJwt.trim().replace(/^Bearer\s+/i, "");
  }

  if (publicKey && secretKey) {
    return signJwt(publicKey, secretKey);
  }

  if (!publicKey || publicKey === SITE_PUBLIC_KEY) {
    throw new Error(
      "Exact PDF conversion requires ILOVEPDF_JWT/ILOVEAPI_JWT or a valid iLoveAPI project key. The bundled public site key is not accepted by the official API."
    );
  }

  const authResponse = await fetch(ILOVEPDF_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_key: publicKey })
  });
  const authPayload = await expectJson<{ token?: string }>(authResponse, "iLovePDF auth");
  if (!authPayload.token) {
    throw new Error("iLovePDF auth failed: response did not include a token.");
  }
  return authPayload.token;
}

function normalizeServerUrl(server: string) {
  return server.startsWith("http") ? server : `https://${server}`;
}

export async function convertDocxToPdfWithIlovePdf(input: {
  docxBuffer: Buffer;
  fileName: string;
}) {
  const token = await getBearerToken();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const startResponse = await fetch(ILOVEPDF_START_URL, {
    method: "GET",
    headers: authHeaders
  });
  const start = await expectJson<IloveStartResponse>(startResponse, "iLovePDF start officepdf");
  if (!start.server || !start.task) {
    throw new Error("iLovePDF start failed: missing server or task.");
  }

  const server = normalizeServerUrl(start.server);
  const uploadForm = new FormData();
  uploadForm.set("task", start.task);
  uploadForm.set(
    "file",
    new Blob([new Uint8Array(input.docxBuffer)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }),
    input.fileName
  );

  const uploadResponse = await fetch(`${server}/v1/upload`, {
    method: "POST",
    headers: authHeaders,
    body: uploadForm
  });
  const upload = await expectJson<IloveUploadResponse>(uploadResponse, "iLovePDF upload DOCX");
  if (!upload.server_filename) {
    throw new Error("iLovePDF upload failed: missing server filename.");
  }

  const processResponse = await fetch(`${server}/v1/process`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      task: start.task,
      tool: "officepdf",
      files: [
        {
          server_filename: upload.server_filename,
          filename: input.fileName
        }
      ]
    })
  });
  await expectJson<unknown>(processResponse, "iLovePDF process officepdf");

  const downloadResponse = await fetch(`${server}/v1/download/${start.task}`, {
    method: "GET",
    headers: authHeaders
  });
  if (!downloadResponse.ok) {
    throw new Error(`iLovePDF download failed: ${await readApiError(downloadResponse)}`);
  }

  const pdfBuffer = Buffer.from(await downloadResponse.arrayBuffer());
  if (pdfBuffer.length < 500 || pdfBuffer.subarray(0, 4).toString("latin1") !== "%PDF") {
    throw new Error("iLovePDF download did not return a valid PDF file.");
  }
  return pdfBuffer;
}
