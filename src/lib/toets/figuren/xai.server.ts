/**
 * Dunne xAI-client voor de beeldpijplijn. Elke aanroep heeft een eigen, korte timeout
 * zodat een figuur nooit de hele Vercel-functie opvreet. Fouten gooien; de pijplijn
 * vangt ze op en valt terug op "geen figuur".
 */
import { BEELD_MODEL, TEKST_MODEL, VISIE_MODEL, XAI_BASE } from "./modellen.ts";

function key(): string {
  const k = process.env.XAI_API_KEY;
  if (!k) throw new Error("XAI_API_KEY ontbreekt");
  return k;
}

async function post(path: string, body: unknown, timeoutMs: number): Promise<any> {
  const res = await fetch(`${XAI_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`xAI ${path} ${res.status}${t ? `: ${t.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

export function stripJson(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

/** Tekstmodel met JSON-antwoord. */
export async function vraagJson(system: string, user: string, opts: { maxTokens?: number; timeoutMs: number }): Promise<unknown> {
  const body = await post(
    "/chat/completions",
    {
      model: TEKST_MODEL,
      temperature: 0.3,
      max_tokens: opts.maxTokens ?? 2500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    opts.timeoutMs,
  );
  const content = body?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Lege AI-respons");
  return JSON.parse(stripJson(content));
}

/** Grok Imagine: één beeld, als base64 (JPEG). */
export async function genereerBeeld(prompt: string, opts: { timeoutMs: number }): Promise<{ bytes: Uint8Array; mime: string }> {
  const body = await post(
    "/images/generations",
    {
      model: BEELD_MODEL,
      prompt: prompt.slice(0, 3800),
      n: 1,
      response_format: "b64_json",
      aspect_ratio: "4:3",
    },
    opts.timeoutMs,
  );
  const item = body?.data?.[0];
  const b64: string | undefined = item?.b64_json;
  if (!b64) throw new Error("Beeldmodel gaf geen afbeelding terug");
  return { bytes: new Uint8Array(Buffer.from(b64, "base64")), mime: item?.mime_type || "image/jpeg" };
}

/** Vision-keuring: beeld + tekst → JSON. */
export async function keurMetVisie(
  system: string,
  user: string,
  beeld: { mime: string; base64: string },
  opts: { timeoutMs: number; reasoningEffort?: "low" | "medium" | "high" },
): Promise<unknown> {
  const body = await post(
    "/chat/completions",
    {
      model: VISIE_MODEL,
      temperature: 0,
      max_tokens: 1500,
      ...(opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {}),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${beeld.mime};base64,${beeld.base64}`, detail: "high" } },
            { type: "text", text: user },
          ],
        },
      ],
    },
    opts.timeoutMs,
  );
  const content = body?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Lege keuringsrespons");
  return JSON.parse(stripJson(content));
}
