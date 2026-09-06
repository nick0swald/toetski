import { createServerFn } from "@tanstack/react-start";
import { SCHOOL } from "./constants";
import { cesuurPunten, formuleTekst } from "./cijfer";
import { bouwMatrijs, normaliseer, somVerdeling, totaalPunten } from "./rtti";
import { generateInputSchema, generatedPayloadSchema, matrijsInputSchema, matrijsPayloadSchema } from "./schema";
import { bouwSystemPrompt } from "./stuurdocument";
import type { GegenereerdeToets } from "./types";

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

/** Grotere toetsen (veel MC) knappen anders midden in JSON af. */
function tokensVoorAantalVragen(n: number): number {
  const aantal = Math.max(4, Math.min(80, Math.floor(n || 10)));
  return Math.min(16000, Math.max(5000, 3000 + aantal * 450));
}

function parseAiJson(raw: string): unknown {
  try {
    return JSON.parse(stripJsonFence(raw));
  } catch {
    throw new Error(
      "De AI-respons was onvolledig of geen geldige JSON (vaak bij heel veel vragen). Probeer opnieuw, of zet tijdelijk iets minder MC/open.",
    );
  }
}

function vriendelijkeAiFout(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (/JSON|Expected ','|Unexpected token|position \d+/i.test(raw)) {
    return "De AI-respons was onvolledig (vaak bij heel veel vragen). Probeer opnieuw, of zet tijdelijk iets minder MC/open.";
  }
  return raw || "Het maken van de toets is mislukt.";
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host === "0.0.0.0" || host === "[::1]" || host === "::1") return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

async function fetchBronUrl(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Die link is geen geldige URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Alleen http- en https-links zijn toegestaan.");
  if (isPrivateHost(parsed.hostname)) throw new Error("Die link kan niet worden opgehaald.");
  const res = await fetch(parsed.toString(), {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
    headers: { "User-Agent": "Ares058Toetsmaker/1.0" },
  });
  if (!res.ok) throw new Error(`De link gaf een fout (${res.status}).`);
  const type = res.headers.get("content-type") ?? "";
  if (!/text|json|xml|markdown|html/i.test(type) && type) {
    throw new Error("Die link is geen tekstbestand dat ik kan inlezen.");
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 120_000) throw new Error("Het bestand achter de link is te groot.");
  let text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  if (/html/i.test(type) || /<html/i.test(text)) {
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
  }
  return text.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim().slice(0, 12000);
}

async function callGrok(messages: { role: string; content: string }[], maxTokens = 4000): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("AI is in deze omgeving niet beschikbaar.");
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(180000),
    body: JSON.stringify({
      model: "grok-4.20-0309-non-reasoning",
      temperature: 0.4,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`xAI API error ${res.status}${errText ? `: ${errText.slice(0, 180)}` : ""}`);
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Lege AI-respons.");
  return content;
}

function userPrompt(
  input: {
    titel?: string;
    vak?: string;
    leerweg: string;
    leerjaar: number;
    duurMinuten: number;
    doelPunten: number;
    aantalVragen: number;
    mcVragen?: number;
    openVragen?: number;
    rttiDoel: { R: number; T1: number; T2: number; I: number };
    extraEisen?: string;
    antwoordenmateriaal?: string;
    versie?: string;
    moeilijkheid?: string;
    cijferNorm?: { model: string; cesuurPct: number; exponent: number };
    feedback?: string;
    vorigeSamenvatting?: string;
    ronde?: number;
  },
  bron: string,
): string {
  const rtti = normaliseer(input.rttiDoel);
  const moe = input.moeilijkheid ?? "normaal";
  const moeTekst =
    moe === "makkelijk"
      ? "MAKKELIJK: korte zinnen, meer steun, meer R/T1."
      : moe === "moeilijk"
        ? "MOEILIJK: meer T2/I, grotere denkstappen."
        : "NORMAAL: passend bij leerjaar en leerweg.";
  const mcN = input.mcVragen;
  const openN = input.openVragen;
  let verdelingTekst: string;
  if (mcN != null && openN != null) {
    verdelingTekst = `VAST: ${mcN} meerkeuze + ${openN} open/andere (totaal ${mcN + openN}).`;
  } else if (mcN != null) {
    verdelingTekst = `VAST: ${mcN} meerkeuze; vul aan met open/andere tot ongeveer ${input.aantalVragen} vragen totaal (of passend bij de stof).`;
  } else if (openN != null) {
    verdelingTekst = `VAST: ${openN} open/andere; vul aan met meerkeuze tot ongeveer ${input.aantalVragen} vragen totaal waar passend.`;
  } else {
    verdelingTekst = `AUTO (~${input.aantalVragen} vragen): kies MC vs open op basis van de lesstof. Dictee/schrijf/luister/spreek → vooral open, weinig of geen MC. Hoofdstuktoets met voldoende stof → relatief veel MC (≥ helft). Anders gemengd.`;
  }
  let feedbackBlok = "";
  if (input.feedback?.trim() || input.vorigeSamenvatting?.trim()) {
    feedbackBlok = `
Dit is ronde ${input.ronde ?? 1} (docentfeedback op de vorige versie).
Behoud wat de docent niet bekritiseert.

Feedback van de docent:
${input.feedback?.trim() || "(geen vrije tekst)"}

Vorige versie (samenvatting):
${input.vorigeSamenvatting?.trim() || "(niet meegeleverd)"}
`;
  }
  return `Maak een complete VMBO-toets plus nakijkmodel.

School: ${SCHOOL}
Lesstof is leidend.
Vak: ${input.vak?.trim() || "(leid af uit de lesstof)"}
Niveau: ${input.leerweg}
Leerjaar: ${input.leerjaar}
Titel: ${input.titel?.trim() || "(leid af uit de lesstof)"}
Toetsduur: ${input.duurMinuten} minuten
Aantal vragen (richtlijn): ${input.aantalVragen}
Vraagverdeling: ${verdelingTekst}
Streefmaximum: ${input.doelPunten} punten (richtlijn; passend bij toetsduur en moeilijkheid, tenzij de docent anders stuurt)
Puntenregels: MC/juist-onjuist max 1p (tenzij stam een extra opdracht stelt); eenvoudige open 1–2p; overige open/berekening = 1p per nakijkstap.
Versie: ${input.versie ?? "A"}
Moeilijkheid: ${moeTekst}
RTTI-doel: R ${rtti.R}% · T1 ${rtti.T1}% · T2 ${rtti.T2}% · I ${rtti.I}%
${somVerdeling(input.rttiDoel) === 100 ? "" : "(Verdeling is genormaliseerd naar 100%.)"}
Cijfernorm: ${input.cijferNorm?.model ?? "lineair"}

Extra eisen van de docent:
${input.extraEisen?.trim() || "(geen)"}
${feedbackBlok}
Leerlingboek / lesstof (KADER: leerdoelen/begrippen/formules én vraagSTIJL ter inspiratie — maak vergelijkbare maar NOOIT 1:1 dezelfde vragen; namen/getallen/situaties altijd aanpassen; geen "zoals in het boek"; kopieer geen antwoorden naar de leerlingtoets):
${bron.trim() || "(geen bron)"}
${
  input.antwoordenmateriaal?.trim()
    ? `
Antwoordenboek (alleen voor het nakijkmodel; bron van waarheid):
${input.antwoordenmateriaal.trim()}
`
    : ""
}`;
}

export const generateToets = createServerFn({ method: "POST" })
  .validator((input: unknown) => generateInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; toets: GegenereerdeToets } | { ok: false; error: string }> => {
    try {
      let bron = data.bronmateriaal ?? "";
      if (data.bronUrl?.trim()) {
        const extra = await fetchBronUrl(data.bronUrl.trim());
        bron = [bron, extra].filter(Boolean).join("\n\n");
      }
      bron = bron.slice(0, 100000);
      const antwoorden = (data.antwoordenmateriaal ?? "").slice(0, 100000);
      if (!bron.trim()) {
        return { ok: false, error: "Plak lesstof, lever het leerlingboek in, of zet een openbare link." };
      }
      const messages = [
        { role: "system", content: bouwSystemPrompt(data.stuurdocument) },
        { role: "user", content: userPrompt({ ...data, antwoordenmateriaal: antwoorden }, bron) },
      ];
      const maxTok = tokensVoorAantalVragen(data.aantalVragen);
      let raw = await callGrok(messages, maxTok);
      let parsed: unknown;
      try {
        parsed = parseAiJson(raw);
      } catch {
        raw = await callGrok(
          [
            ...messages,
            { role: "assistant", content: raw.slice(0, Math.min(raw.length, maxTok)) },
            {
              role: "user",
              content:
                "Stuur hetzelfde resultaat opnieuw als één compleet puur JSON-object, zonder markdown. Kap niet af.",
            },
          ],
          maxTok,
        );
        parsed = parseAiJson(raw);
      }
      const payload = generatedPayloadSchema.parse(parsed);
      const rttiDoel = normaliseer(data.rttiDoel);
      const vragen = payload.vragen.map((q, i) => ({
        ...q,
        nummer: q.nummer || i + 1,
        context: q.context || undefined,
        opties: q.opties?.length ? q.opties : undefined,
      }));
      const max = totaalPunten(vragen);
      const cijferNorm = data.cijferNorm;
      const cesuurP = cesuurPunten(max, cijferNorm);
      const toets: GegenereerdeToets = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        bronmateriaal: bron,
        extraEisen: data.extraEisen ?? "",
        ronde: data.ronde ?? 1,
        parentId: data.parentId,
        feedback: data.feedback || undefined,
        cijferNorm,
        meta: {
          ...payload.meta,
          titel: data.titel?.trim() || payload.meta.titel || "Toets",
          vak: data.vak?.trim() || payload.meta.vak || "Algemeen",
          leerweg: payload.meta.leerweg ?? data.leerweg,
          leerjaar: (Math.min(4, Math.max(1, Math.round(payload.meta.leerjaar ?? data.leerjaar))) || 2) as 1 | 2 | 3 | 4,
          duurMinuten: payload.meta.duurMinuten || data.duurMinuten,
          school: SCHOOL,
          hulpmiddelen: payload.meta.hulpmiddelen,
          instructies: payload.meta.instructies,
          onderwerp: payload.meta.onderwerp || data.titel || payload.meta.titel,
          versie: data.versie,
          moeilijkheid: data.moeilijkheid,
        },
        vragen,
        nakijkmodel: payload.nakijkmodel,
        cesuur: {
          nTerm: 1,
          cesuurPunten: cesuurP,
          toelichting: payload.cesuur.toelichting,
          formule: formuleTekst(cijferNorm, max),
        },
        matrijs: bouwMatrijs(vragen, rttiDoel),
        kwaliteit: payload.kwaliteit,
      };
      return { ok: true, toets };
    } catch (err) {
      return { ok: false, error: vriendelijkeAiFout(err) };
    }
  });

const MATRIJS_SYSTEM = `Je bent toetsconstructeur voor Ares058 VMBO Leeuwarden.
De docent levert een BESTAANDE toets. Jij maakt daar een toetsmatrijs van. Je herschrijft de toets niet.
Haal elke vraag eruit. Ken RTTI toe. Verzin geen extra vragen en geen nakijkmodel.
Antwoord ALLEEN met één JSON-object:
{
  "meta": { "titel": string, "vak": string, "leerweg": "BB"|"KB"|"GT", "leerjaar": 1|2|3|4, "onderwerp": string },
  "vragen": [{ "nummer": number, "type": "meerkeuze"|"juist-onjuist"|"open"|"invul"|"berekening"|"bronvraag", "rtti": "R"|"T1"|"T2"|"I", "domein": string, "leerdoel": string, "punten": number, "stam": string }],
  "kwaliteit": { "samenvatting": string, "punten": [{"criterium": string, "oordeel": "voldoet"|"aandacht"|"ontbreekt", "toelichting": string}] }
}
Als geen feedback is gevraagd: laat "kwaliteit" weg.`;

export const generateMatrijs = createServerFn({ method: "POST" })
  .validator((input: unknown) => matrijsInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; toets: GegenereerdeToets } | { ok: false; error: string }> => {
    try {
      let bron = data.bronmateriaal ?? "";
      if (data.bronUrl?.trim()) {
        const extra = await fetchBronUrl(data.bronUrl.trim());
        bron = [bron, extra].filter(Boolean).join("\n\n");
      }
      bron = bron.slice(0, 14000);
      if (!bron.trim()) return { ok: false, error: "Lever de bestaande toets in (bestand of tekst)." };
      const rtti = normaliseer(data.rttiDoel);
      const feedback = data.feedbackGewenst
        ? "Geef WEL feedback (veld kwaliteit)."
        : "Geef GEEN feedback. Laat het veld kwaliteit weg.";
      const user = `Maak een toetsmatrijs bij deze BESTAANDE toets.

School: ${SCHOOL}
Vak: ${data.vak?.trim() || "(leid af)"}
Niveau: ${data.leerweg}
Leerjaar: ${data.leerjaar}
RTTI-doel: R ${rtti.R}% · T1 ${rtti.T1}% · T2 ${rtti.T2}% · I ${rtti.I}%
${feedback}

Bestaande toets:
${bron}`;
      const messages = [
        { role: "system", content: MATRIJS_SYSTEM },
        { role: "user", content: user },
      ];
      let raw = await callGrok(messages, 8000);
      let parsed: unknown;
      try {
        parsed = parseAiJson(raw);
      } catch {
        raw = await callGrok(
          [
            ...messages,
            { role: "assistant", content: raw.slice(0, 4000) },
            { role: "user", content: "Stuur hetzelfde resultaat opnieuw als één puur JSON-object." },
          ],
          6000,
        );
        parsed = parseAiJson(raw);
      }
      const payload = matrijsPayloadSchema.parse(parsed);
      const vragen = payload.vragen.map((q, i) => ({
        ...q,
        nummer: q.nummer || i + 1,
        stam: q.stam || q.leerdoel || `Vraag ${q.nummer || i + 1}`,
        context: q.context || undefined,
        opties: q.opties?.length ? q.opties : undefined,
      }));
      const max = totaalPunten(vragen);
      const cijferNorm = { model: "lineair" as const, cesuurPct: 55, exponent: 1 };
      const kwaliteit = data.feedbackGewenst
        ? payload.kwaliteit ?? { samenvatting: "Er kwam geen feedback terug.", punten: [] }
        : { samenvatting: "Geen feedback gevraagd.", punten: [] };
      const toets: GegenereerdeToets = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        bronmateriaal: bron,
        extraEisen: data.extraEisen ?? "",
        ronde: 1,
        cijferNorm,
        soort: "matrijs",
        feedbackGewenst: data.feedbackGewenst,
        meta: {
          titel: data.titel?.trim() || payload.meta.titel || "Toetsmatrijs",
          vak: data.vak?.trim() || payload.meta.vak || "Algemeen",
          leerweg: payload.meta.leerweg ?? data.leerweg,
          leerjaar: (Math.min(4, Math.max(1, Math.round(payload.meta.leerjaar ?? data.leerjaar))) || 2) as 1 | 2 | 3 | 4,
          duurMinuten: 50,
          school: SCHOOL,
          hulpmiddelen: [],
          instructies: [],
          onderwerp: payload.meta.onderwerp || payload.meta.titel,
          versie: "A",
          moeilijkheid: "normaal",
        },
        vragen,
        nakijkmodel: [],
        cesuur: {
          nTerm: 1,
          cesuurPunten: cesuurPunten(max, cijferNorm),
          toelichting: "Matrijs bij bestaande toets.",
          formule: formuleTekst(cijferNorm, max),
        },
        matrijs: bouwMatrijs(vragen, rtti),
        kwaliteit,
      };
      return { ok: true, toets };
    } catch (err) {
      return { ok: false, error: vriendelijkeAiFout(err).replace("toets", "matrijs") };
    }
  });
