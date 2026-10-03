/**
 * Stap-0-pilot, alleen server-side:
 *  - vlag STAP0_RENDERER: "uit" (standaard) | "pilot" (alleen gebruikers uit STAP0_USERS) | "aan" (iedereen met NaSk);
 *  - STAP0_USERS: komma-gescheiden "<label>:<pilotcode>" (bijv. "nick:k3…"; label vrij te kiezen, liefst neutraal).
 *    De app heeft (nog) geen login; de pilotcode identificeert de gebruiker (één keer via toetski.nl/#pilot=<code> in
 *    de browser gezet). Het label blijft op de server: het gaat nooit naar de client, en in de logs staat alleen een
 *    pseudoniem (`gebruikerTag`); e-mailadressen worden uit elke logregel gefilterd;
 *  - toestand tussen de stappen wordt met HMAC ondertekend (STAP0_STATE_SECRET, anders afgeleid van XAI_API_KEY), zodat
 *    de client kosten/teller niet kan aanpassen;
 *  - productie-chat via xaiChat (leest XAI_API_KEY; nooit TOETSKI_XAI_API_KEY);
 *  - monitoring als één JSON-regel per stap/toets in de Vercel-logs ("[stap0]"), alarm als "[stap0-alarm]".
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { nieuweKosten, xaiChat } from "../llm.ts";
import type { StapChat, Stap0Staat } from "./stappen.ts";

type Env = Record<string, string | undefined>;
const envVan = (): Env => (typeof process !== "undefined" ? process.env : {});

/**
 * Optioneel lager vangnet via STAP0_VANGNET_USD (bijv. 0.40 voor een testrun); nooit hoger dan het productievangnet ($ 1).
 */
export function stap0VangnetUsd(env: Env = envVan()): number | undefined {
  const v = Number((env.STAP0_VANGNET_USD ?? "").trim());
  return Number.isFinite(v) && v > 0 ? Math.min(v, 1) : undefined;
}

export type Stap0Modus = "uit" | "pilot" | "aan";
export function stap0Modus(env: Env = envVan()): Stap0Modus {
  const v = (env.STAP0_RENDERER ?? "").trim().toLowerCase();
  return v === "aan" || v === "on" || v === "true" ? "aan" : v === "pilot" ? "pilot" : "uit";
}

export function pilotGebruikers(env: Env = envVan()): { label: string; code: string }[] {
  return (env.STAP0_USERS ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const i = x.lastIndexOf(":");
      return i > 0 ? { label: x.slice(0, i).trim(), code: x.slice(i + 1).trim() } : { label: "", code: "" };
    })
    .filter((g) => g.label && g.code.length >= 16);
}

const gelijk = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Wie is deze pilotcode (label) als stap 0 voor hem aan staat; anders null (→ huidige pijplijn). */
export function stap0Voor(code: string | undefined, env: Env = envVan()): { label: string } | null {
  const modus = stap0Modus(env);
  if (modus === "uit") return null;
  const g = code ? pilotGebruikers(env).find((u) => gelijk(u.code, code.trim())) : undefined;
  if (g) return { label: g.label };
  return modus === "aan" ? { label: "iedereen" } : null;
}

function geheim(env: Env = envVan()): string {
  const s = env.STAP0_STATE_SECRET?.trim();
  if (s) return s;
  const k = env.XAI_API_KEY?.trim();
  if (!k) throw new Error("Geen sleutel voor de stap-0-toestand.");
  return createHash("sha256").update(`stap0-toestand:${k}`).digest("hex");
}

export function onderteken(staat: Stap0Staat, env: Env = envVan()): string {
  return createHmac("sha256", geheim(env)).update(JSON.stringify(staat)).digest("base64url");
}

export function controleer(staat: Stap0Staat, mac: string, env: Env = envVan()): boolean {
  return gelijk(onderteken(staat, env), mac);
}

/** Productie-chat: grok-4.5 ("schrijven") met JSON-schema; terugval op json_object als het schema geweigerd wordt. */
export const productieChat: StapChat = async (messages, schema, o) => {
  const k = nieuweKosten();
  try {
    try {
      return { tekst: await xaiChat("schrijven", messages, { maxTokens: o.maxTokens, timeoutMs: o.timeoutMs, kosten: k, jsonSchema: schema }), usd: k.usd };
    } catch (e) {
      if (!/xAI API error 400/.test(String((e as Error)?.message))) throw e;
      const m2 = [...messages.slice(0, -1), { role: "user" as const, content: `${messages.at(-1)!.content}\n\nAntwoord met één JSON-object volgens dit schema:\n${JSON.stringify(schema.schema)}` }];
      return { tekst: await xaiChat("schrijven", m2, { maxTokens: o.maxTokens, timeoutMs: o.timeoutMs, kosten: k }), usd: k.usd };
    }
  } catch (e) {
    // Ook een mislukte aanroep kan iets gekost hebben: meegeven zodat de teller klopt.
    (e as Error & { usd?: number }).usd = k.usd;
    throw e;
  }
};

/** Pseudoniem voor een pilotgebruiker in logs (nooit het label zelf; een label kan een e-mailadres zijn). */
export function gebruikerTag(label: string): string {
  return `u-${createHash("sha256").update(`stap0:${label}`).digest("hex").slice(0, 8)}`;
}

/** Haalt e-mailadressen uit een tekst (vangnet voor logs en antwoorden). */
export function zonderEmail(tekst: string): string {
  return tekst.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[e-mail]");
}

/** Wat de client over de pilot te horen krijgt: alleen aan/uit (geen label, geen code). */
export function pilotAntwoord(code: string | undefined, env: Env = envVan()): { aan: boolean } {
  return { aan: Boolean(stap0Voor(code, env)) };
}

export function logStap0(soort: "stap" | "alarm" | "klaar", data: Record<string, unknown>): void {
  const regel = zonderEmail(JSON.stringify({ stap0: soort, t: new Date().toISOString(), ...data }));
  if (soort === "alarm") console.warn(`[stap0-alarm] ${regel}`);
  else console.log(`[stap0] ${regel}`);
}
