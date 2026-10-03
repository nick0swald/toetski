/**
 * Eén xAI-client voor alle tekstaanroepen van de toetspipeline (schrijven, controle, reparatie,
 * extra vragen, bijschaven, matrijs). Model, redeneerinspanning en temperatuur komen per ROL uit
 * config.ts; elke aanroep telt tokens en kosten op in een Kosten-object per verzoek.
 *
 * Gecachet voorvoegsel: een user-prompt met CACHE_GRENS wordt in twee berichten gesplitst
 * (vast deel = lesstof/antwoordenboek, daarna het wisselende deel). Met x-grok-conv-id per lesstof
 * landen de parallelle stukjes op dezelfde server en wordt de lesstof uit de cache gelezen.
 */
import type { ToetsKosten } from "./types";
import { MODELLEN, PRIJZEN, REDENEREN, TEMPERATUUR, XAI_BASE, type ModelRol } from "./config.ts";

export const CACHE_GRENS = "\n\n§§VRAGEN§§\n\n";

export type Kosten = ToetsKosten;

export function nieuweKosten(): Kosten {
  return { usd: 0, tokensIn: 0, tokensCache: 0, tokensUit: 0, tokensRedeneren: 0, aanroepen: 0, mislukt: 0, perRol: {} };
}

/** Twee kostenoverzichten samenvoegen (stap 1 + stap 2). */
export function telOp(a: Kosten | undefined, b: Kosten | undefined): Kosten {
  const out = nieuweKosten();
  for (const k of [a, b]) {
    if (!k) continue;
    out.usd += k.usd;
    out.tokensIn += k.tokensIn;
    out.tokensCache += k.tokensCache;
    out.tokensUit += k.tokensUit;
    out.tokensRedeneren += k.tokensRedeneren;
    out.aanroepen += k.aanroepen;
    out.mislukt += k.mislukt ?? 0;
    for (const [rol, r] of Object.entries(k.perRol ?? {})) {
      const o = (out.perRol[rol] ??= { usd: 0, aanroepen: 0, tokensIn: 0, tokensUit: 0, ms: 0 });
      o.usd += r.usd;
      o.aanroepen += r.aanroepen;
      o.tokensIn += r.tokensIn;
      o.tokensUit += r.tokensUit;
      o.ms += r.ms;
    }
  }
  out.usd = Math.round(out.usd * 1e6) / 1e6;
  return out;
}

export type Bericht = { role: "system" | "user" | "assistant"; content: string };

/** System + user; een user-prompt met CACHE_GRENS wordt [vast deel, wisselend deel]. */
export function berichten(system: string, user: string): Bericht[] {
  const i = user.indexOf(CACHE_GRENS);
  if (i < 0) return [{ role: "system", content: system }, { role: "user", content: user }];
  return [
    { role: "system", content: system },
    { role: "user", content: user.slice(0, i) },
    { role: "user", content: user.slice(i + CACHE_GRENS.length) },
  ];
}

/** Stabiele conversatie-id per vast voorvoegsel (zelfde lesstof → zelfde server → cache). */
function convId(messages: Bericht[]): string | undefined {
  if (messages.length < 3) return undefined;
  let h = 0x811c9dc5;
  const s = messages[0]!.content + messages[1]!.content;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `toetski-${h.toString(16)}`;
}

interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
  cost_in_usd_ticks?: number;
}

function kostenVan(model: string, u: Usage): number {
  // xAI meldt de kosten zelf in ticks van 1e-10 USD; anders rekenen met de prijstabel.
  if (typeof u.cost_in_usd_ticks === "number" && u.cost_in_usd_ticks > 0) return u.cost_in_usd_ticks / 1e10;
  const p = PRIJZEN[model];
  if (!p) return 0;
  const cache = u.prompt_tokens_details?.cached_tokens ?? 0;
  const vers = Math.max(0, (u.prompt_tokens ?? 0) - cache);
  return (vers * p.in + cache * p.cache + (u.completion_tokens ?? 0) * p.uit) / 1e6;
}

function boek(kosten: Kosten | undefined, rol: ModelRol, model: string, u: Usage | undefined, ms: number): void {
  if (!kosten) return;
  const usd = u ? kostenVan(model, u) : 0;
  kosten.usd += usd;
  kosten.aanroepen += 1;
  kosten.tokensIn += u?.prompt_tokens ?? 0;
  kosten.tokensCache += u?.prompt_tokens_details?.cached_tokens ?? 0;
  kosten.tokensUit += u?.completion_tokens ?? 0;
  kosten.tokensRedeneren += u?.completion_tokens_details?.reasoning_tokens ?? 0;
  const r = (kosten.perRol[rol] ??= { usd: 0, aanroepen: 0, tokensIn: 0, tokensUit: 0, ms: 0 });
  r.usd += usd;
  r.aanroepen += 1;
  r.tokensIn += u?.prompt_tokens ?? 0;
  r.tokensUit += u?.completion_tokens ?? 0;
  r.ms += ms;
}

/** Eén chat-aanroep met JSON-antwoord voor een rol uit config.ts. Gooit bij fouten. */
export async function xaiChat(
  rol: ModelRol,
  messages: Bericht[],
  opts: {
    maxTokens: number;
    timeoutMs: number;
    kosten?: Kosten;
    /** Structured output: het antwoord moet aan dit JSON-schema voldoen (xAI json_schema, strict). Standaard json_object. */
    jsonSchema?: { naam: string; schema: Record<string, unknown> };
  },
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("AI is in deze omgeving niet beschikbaar.");
  const model = MODELLEN[rol];
  const redeneer = REDENEREN[rol];
  const conv = convId(messages);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${XAI_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...(conv ? { "x-grok-conv-id": conv } : {}) },
      signal: AbortSignal.timeout(Math.max(5_000, opts.timeoutMs)),
      body: JSON.stringify({
        model,
        ...(redeneer ? { reasoning_effort: redeneer } : {}),
        temperature: TEMPERATUUR[rol] ?? 0.4,
        max_tokens: opts.maxTokens,
        response_format: opts.jsonSchema
          ? { type: "json_schema", json_schema: { name: opts.jsonSchema.naam, schema: opts.jsonSchema.schema, strict: true } }
          : { type: "json_object" },
        messages,
      }),
    });
  } catch (err) {
    if (opts.kosten) opts.kosten.mislukt += 1;
    throw err;
  }
  if (!res.ok) {
    if (opts.kosten) opts.kosten.mislukt += 1;
    const errText = await res.text().catch(() => "");
    throw new Error(`xAI API error ${res.status}${errText ? `: ${errText.slice(0, 180)}` : ""}`);
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: Usage };
  boek(opts.kosten, rol, model, body.usage, Date.now() - t0);
  const content = body.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Lege AI-respons.");
  return content;
}

export function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export function parseAiJson(raw: string): unknown {
  try {
    return JSON.parse(stripJsonFence(raw));
  } catch {
    throw new Error(
      "De AI-respons was onvolledig of geen geldige JSON (vaak bij heel veel vragen). Probeer opnieuw, of zet tijdelijk iets minder MC/open.",
    );
  }
}

export function vriendelijkeAiFout(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (/JSON|Expected ','|Unexpected token|position \d+/i.test(raw)) {
    return "De AI-respons was onvolledig (vaak bij heel veel vragen). Probeer opnieuw, of zet tijdelijk iets minder MC/open.";
  }
  if (/TimeoutError|aborted|timeout/i.test(raw)) return "De AI deed er te lang over. Probeer het opnieuw.";
  return raw || "Het maken van de toets is mislukt.";
}

/**
 * Gedeelde aanroep + JSON-parse + validatie met één herkansing (voorheen 4× gekopieerd).
 * De herkansing gebeurt alleen als er nog `herkansingMinRestMs` over is.
 */
export async function vraagJson<T>(
  rol: ModelRol,
  messages: Bericht[],
  parse: (u: unknown) => T,
  opts: {
    maxTokens: number;
    /** Resterende tijd (ms) op het moment van aanroepen. */
    rest: () => number;
    kosten?: Kosten;
    herkansingMinRestMs?: number;
    herkansingTekst?: string;
  },
): Promise<T> {
  let raw = await xaiChat(rol, messages, { maxTokens: opts.maxTokens, timeoutMs: opts.rest(), kosten: opts.kosten });
  try {
    return parse(parseAiJson(raw));
  } catch (err) {
    if (opts.rest() < (opts.herkansingMinRestMs ?? 25_000)) throw err;
    raw = await xaiChat(
      rol,
      [
        ...messages,
        { role: "assistant", content: raw.slice(0, Math.min(raw.length, opts.maxTokens)) },
        { role: "user", content: opts.herkansingTekst ?? "Stuur hetzelfde resultaat opnieuw als één compleet puur JSON-object, zonder markdown. Kap niet af." },
      ],
      { maxTokens: opts.maxTokens, timeoutMs: opts.rest(), kosten: opts.kosten },
    );
    return parse(parseAiJson(raw));
  }
}
