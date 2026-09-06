import { createServerFn } from "@tanstack/react-start";
import { SCHOOL } from "./constants";
import { cesuurPunten, cesuurZin, formuleTekst, instructiesMetCesuur } from "./cijfer";
import { verzekerBronFiguren } from "./bron-figuren";
import { bouwMatrijs, normaliseer, somVerdeling, totaalPunten } from "./rtti";
import { generateInputSchema, generatedPayloadSchema, matrijsInputSchema, matrijsPayloadSchema } from "./schema";
import type { GegenereerdeToets } from "./types";

const SYSTEM_PROMPT = `Je bent toetsconstructeur voor Aeres VMBO Leeuwarden (groen vmbo: BB, KB en GT).
Je maakt schooltoetsen die voldoen aan SLO-kwaliteitscriteria en Cito-conventies, met RTTI-codering (Docentplus: R, T1, T2, I).

RTTI
- R Reproductie: letterlijk kennen (begrip, feit, formule, stappenplan).
- T1 Toepassing bekend: getrainde procedure in een geoefende context.
- T2 Toepassing nieuw: combineren in een context die niet geoefend is.
- I Inzicht: analyseren, verklaren, verbanden, een oplossing construeren.

SLO / Cito
- Validiteit: elke vraag dekt een leerdoel; geen triviale of off-topic items.
- Betrouwbaarheid: eenduidige vragen + nakijkmodel waarmee twee docenten tot dezelfde score komen.
- Specificiteit: toetst de bedoelde stof, geen leestrucs of algemene intelligentie.
- Transparantie: punten per vraag, duidelijke instructie, cesuur.
- Taal: VMBO-passend. BB = korte zinnen, eenvoudige woorden. KB = iets meer context. GT (gemengd/theoretisch, ook HGL) = zelfstandiger lezen.
- Geen dubbele ontkenningen, geen strikvragen, één opdracht per deelvraag.
- Lesstof is leidend. Als titel of vak ontbreekt, leid die af uit het bronmateriaal. Verzin geen extra hoofdstukken die niet in de stof zitten.
- Meerkeuze: 4 opties A–D, één beste antwoord, afleiders aannemelijk, geen "allemaal" / "geen van bovenstaande".
- Open vragen: commando's als Noem, Geef, Leg uit, Bereken, Verklaar.
- Punten: R vaak 1–2, T1 2–3, T2 3–4, I 3–4. Totaal dicht bij het gevraagde maximum.
- Opmaak in de stam: deelvragen a/b/c met punten tussen haakjes.
- Waar het vak het toelaat: groene, Friese, praktijkgerichte context (kas, stal, erf, voeding, water, leerbedrijf Aeres). Forceer dit niet bij puur talige of rekenkundige items.
- Tabel of grafiek: als de lesstof een tabel of grafiek noemt, lever die als velden "tabel" of "grafiek" bij de vraag. Geen alleen tekstverwijzing ("zie de grafiek").

Nakijkmodel
- Per vraag een modelantwoord én een puntenverdeelsleutel (wat scoort 1 punt).
- Noteer wat níét scoort bij open vragen (veelgemaakte halve antwoorden).
- Cesuur: schooltoets. Gebruik ALLEEN de cijfernorm van de docent. Vermeld de formule. Verzin geen andere cesuur (geen 55% als de norm lineair is: bij lineair ligt 5,5 op 50% van de punten).

Kwaliteit
- Wees eerlijk in de kwaliteitscheck. Als RTTI meer dan 8 procentpunt afwijkt van het doel, oordeel "aandacht".
- Criteria minstens: Validiteit, Betrouwbaarheid, RTTI-spreiding, Taal, Transparantie, Cito-opmaak.

Antwoord ALLEEN met één JSON-object, geen markdown, geen toelichting erbuiten. Schema:
{
  "meta": {
    "titel": string,
    "vak": string,
    "leerweg": "BB"|"KB"|"GT",
    "leerjaar": 1|2|3|4,
    "duurMinuten": number,
    "hulpmiddelen": string[],
    "instructies": string[],
    "onderwerp": string
  },
  "vragen": [{
    "nummer": number,
    "type": "meerkeuze"|"juist-onjuist"|"open"|"invul"|"berekening"|"bronvraag",
    "rtti": "R"|"T1"|"T2"|"I",
    "domein": string,
    "leerdoel": string,
    "punten": number,
    "context": string,
    "stam": string,
    "opties": [{"letter":"A","tekst": string}],
    "tabel": {"koppen": [string], "rijen": [[string]]},
    "grafiek": {"titel": string, "xLabel": string, "yLabel": string, "punten": [{"x": number, "y": number}]}
  }],
  "nakijkmodel": [{
    "nummer": number,
    "modelantwoord": string,
    "puntenverdeling": [{"punt": number, "criterium": string}],
    "nietToekennen": string[]
  }],
  "cesuur": {
    "nTerm": 1,
    "cesuurPunten": number,
    "toelichting": string,
    "formule": string
  },
  "kwaliteit": {
    "samenvatting": string,
    "punten": [{"criterium": string, "oordeel": "voldoet"|"aandacht"|"ontbreekt", "toelichting": string}]
  }
}}`;

const NASK_PROMPT = `
VAKPROFIEL NASK
- Hulpmiddelen: rekenmachine alleen waar nodig; geen boek.
- Neem formules, eenheden, significantie, tabel/grafiek-bronnen, meetonzekerheid en eenvoudige labcontext mee waar de lesstof dat toelaat.
- Als de lesstof een grafiek, diagram, figuur of tabel noemt: minstens één vraag krijgt een ECHTE tabel (veld tabel: koppen + rijen) of grafiek (veld grafiek: punten). Geen alleen tekstverwijzing.
- Formules schrijf je in de stam, met eenheden. Significantie past bij schoolmetingen (vaak 1 decimaal voor °C).
- Context mag de kas, het erf, water of een schoolopstelling zijn.
`;

function naskHulpmiddelen(h: string[]): string[] {
  const rest = h.filter((x) => !/rekenmachine|boek/i.test(x));
  return ["Rekenmachine alleen waar nodig", "Geen boek", ...rest];
}

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (host === "0.0.0.0" || host === "[::1]" || host === "::1") return true;
  if (
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return true;
  }
  return false;
}

async function fetchBronUrl(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Die link is geen geldige URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Alleen http- en https-links zijn toegestaan.");
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error("Die link kan niet worden opgehaald.");
  }

  const res = await fetch(parsed.toString(), {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
    headers: { "User-Agent": "AeresToetsmaker/1.0" },
  });
  if (!res.ok) throw new Error(`De link gaf een fout (${res.status}).`);
  const type = res.headers.get("content-type") ?? "";
  if (!/text|json|xml|markdown|html/i.test(type) && type) {
    throw new Error("Die link is geen tekstbestand dat ik kan inlezen.");
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 120_000) {
    throw new Error("Het bestand achter de link is te groot (max. 100 kB tekst).");
  }
  let text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  if (/html/i.test(type) || /<html/i.test(text)) {
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">");
  }
  return text.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim().slice(0, 12000);
}

async function callGrok(
  messages: { role: string; content: string }[],
  maxTokens = 8000,
): Promise<string> {
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
      model: "grok-4.5",
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

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
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
    rttiDoel: { R: number; T1: number; T2: number; I: number };
    extraEisen?: string;
    versie?: string;
    moeilijkheid?: string;
    cijferNorm?: { model: string; cesuurPct: number; exponent: number };
    feedback?: string;
    vorigeSamenvatting?: string;
    ronde?: number;
    vakProfiel?: string;
  },
  bron: string,
): string {
  const rtti = normaliseer(input.rttiDoel);
  const moe = input.moeilijkheid ?? "normaal";
  const moeTekst =
    moe === "makkelijk"
      ? "MAKKELIJK: korte zinnen, meer steun, meer R/T1, bekende context, geen extra stappen."
      : moe === "moeilijk"
        ? "MOEILIJK: meer T2/I, grotere denkstappen, minder steun in de stam, nieuwe context."
        : "NORMAAL: passend bij leerjaar en leerweg.";
  const versieTekst =
    input.versie === "B"
      ? "Dit is VERSIE B: zelfde leerdoelen, RTTI en puntenopbouw als een parallelle toets, maar andere getallen, namen, contexten en afleiders. Niet dezelfde antwoorden als versie A."
      : "Dit is VERSIE A (eerste afname).";

  let feedbackBlok = "";
  if (input.feedback?.trim() || input.vorigeSamenvatting?.trim()) {
    feedbackBlok = `
Dit is ronde ${(input.ronde ?? 1)} (docentfeedback op de vorige versie).
Behoud wat de docent niet bekritiseert. Pas gericht aan op de feedback. Geen volledig willekeurige herschrijving.

Feedback van de docent:
${input.feedback?.trim() || "(geen vrije tekst)"}

Vorige versie (samenvatting):
${input.vorigeSamenvatting?.trim() || "(niet meegeleverd)"}
`;
  }

  return `Maak een complete VMBO-toets plus nakijkmodel.

School: ${SCHOOL}
Lesstof is leidend. Als titel of vak ontbreekt, leid die af uit de lesstof. Als de lesstof een ander vak, leerjaar of leerweg duidelijk noemt, volg de lesstof.
Vak: ${input.vak?.trim() || "(leid af uit de lesstof)"}
Niveau / leerweg (voorinstelling): ${input.leerweg}
Leerjaar (voorinstelling): ${input.leerjaar}
Titel/onderwerp: ${input.titel?.trim() || "(leid af uit de lesstof)"}
Toetsduur: ${input.duurMinuten} minuten
Aantal vragen: ${input.aantalVragen}
Streefmaximum: ${input.doelPunten} punten
Versie: ${input.versie ?? "A"}
Moeilijkheid: ${moeTekst}
${versieTekst}
RTTI-doelverdeling (procent van de punten): R ${rtti.R}% · T1 ${rtti.T1}% · T2 ${rtti.T2}% · I ${rtti.I}%
${somVerdeling(input.rttiDoel) === 100 ? "" : "(Verdeling is genormaliseerd naar 100%.)"}
Cijfernorm: ${input.cijferNorm?.model ?? "lineair"}. Bij lineair: cijfer = 1 + 9 × (score / max), 5,5 bij 50% van de punten. Geen N-term. Vermeld in de instructie alleen deze schoolnorm.

${input.vakProfiel === "nask" ? NASK_PROMPT : ""}
${
  input.vakProfiel === "nask" && /grafiek|diagram|figuur|tabel/i.test(bron)
    ? "De lesstof noemt een tabel of grafiek. Verplicht: minstens één vraag met veld tabel of grafiek ingevuld."
    : ""
}
Extra eisen van de docent:
${input.extraEisen?.trim() || "(geen)"}
${feedbackBlok}
Bronmateriaal / lesstof / bestaande vragen (gebruik dit als inhoud; verzin geen stof die hiermee botst; als het alleen een onderwerp is, gebruik passende SLO-kerndoelen):
${bron.trim() || "(geen bron — construeer op basis van typische SLO-kerndoelen voor dit vak, leerjaar en leerweg)"}`;
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
      bron = bron.slice(0, 14000);
      if (!bron.trim()) {
        return {
          ok: false,
          error: "Plak lesstof, of zet een openbare link. Dat is genoeg om een toets te maken.",
        };
      }

      const messages = [
        {
          role: "system",
          content: SYSTEM_PROMPT + (data.vakProfiel === "nask" ? NASK_PROMPT : ""),
        },
        { role: "user", content: userPrompt(data, bron) },
      ];

      let raw = await callGrok(messages);
      let parsed: unknown;
      try {
        parsed = JSON.parse(stripJsonFence(raw));
      } catch {
        raw = await callGrok([
          ...messages,
          { role: "assistant", content: raw.slice(0, 4000) },
          {
            role: "user",
            content:
              "De vorige output was geen geldige JSON. Stuur hetzelfde resultaat opnieuw als één puur JSON-object, zonder markdown.",
          },
        ]);
        parsed = JSON.parse(stripJsonFence(raw));
      }

      const payload = generatedPayloadSchema.parse(parsed);
      const rttiDoel = normaliseer(data.rttiDoel);
      const vragen = verzekerBronFiguren(
        payload.vragen.map((q, i) => ({
          ...q,
          nummer: q.nummer || i + 1,
          context: q.context || undefined,
          opties: q.opties?.length ? q.opties : undefined,
          tabel: q.tabel,
          grafiek: q.grafiek,
        })),
        bron,
        data.vakProfiel,
      );
      const max = totaalPunten(vragen);
      const cijferNorm = data.cijferNorm;
      const cesuurP = cesuurPunten(max, cijferNorm);
      const cesuurTekst = cesuurZin(max, cijferNorm);
      let hulpmiddelen = payload.meta.hulpmiddelen;
      if (data.vakProfiel === "nask") hulpmiddelen = naskHulpmiddelen(hulpmiddelen);
      const instructies = instructiesMetCesuur(
        payload.meta.instructies,
        max,
        cijferNorm,
      );

      const toets: GegenereerdeToets = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        bronmateriaal: bron,
        extraEisen: data.extraEisen ?? "",
        ronde: data.ronde ?? 1,
        parentId: data.parentId,
        feedback: data.feedback || undefined,
        cijferNorm,
        vakProfiel: data.vakProfiel,
        meta: {
          ...payload.meta,
          titel: data.titel?.trim() || payload.meta.titel || "Toets",
          vak:
            data.vak?.trim() ||
            payload.meta.vak ||
            (data.vakProfiel === "nask" ? "NaSk" : "Algemeen"),
          leerweg: payload.meta.leerweg ?? data.leerweg,
          leerjaar: (Math.min(
            4,
            Math.max(1, Math.round(payload.meta.leerjaar ?? data.leerjaar)),
          ) || 2) as 1 | 2 | 3 | 4,
          duurMinuten: payload.meta.duurMinuten || data.duurMinuten,
          school: SCHOOL,
          hulpmiddelen,
          instructies,
          onderwerp: payload.meta.onderwerp || data.titel || payload.meta.titel,
          versie: data.versie,
          moeilijkheid: data.moeilijkheid,
        },
        vragen,
        nakijkmodel: payload.nakijkmodel,
        cesuur: {
          nTerm: 1,
          cesuurPunten: cesuurP,
          toelichting: cesuurTekst,
          formule: formuleTekst(cijferNorm, max),
        },
        matrijs: bouwMatrijs(vragen, rttiDoel),
        kwaliteit: payload.kwaliteit,
      };

      return { ok: true, toets };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Het maken van de toets is mislukt.";
      return { ok: false, error: message };
    }
  });

const MATRIJS_SYSTEM = `Je bent toetsconstructeur voor Aeres VMBO Leeuwarden.
De docent levert een BESTAANDE toets. Jij maakt daar een toetsmatrijs van. Je herschrijft de toets niet.

Werkwijze
- Haal elke vraag eruit: nummer, type, stam (kort: opdrachtzin), punten, domein/leerdoelcluster, leerdoel.
- RTTI (Docentplus): R reproductie, T1 toepassing bekend, T2 toepassing nieuw, I inzicht.
- Staat RTTI al bij de vraag, behoud die. Anders ken je RTTI toe op basis van de denkstap, niet op vraagtype alleen.
- Punten: gebruik de punten uit de toets. Ontbreken ze, schat passend (R 1–2, T1 2–3, T2/I 3–4).
- Groepeer in inhoudelijke domeinen (niet één bak "Algemeen" als de toets duidelijk meerdere clusters heeft).
- Verzin geen extra vragen en geen nakijkmodel.

Feedback (alleen als gevraagd)
- Beoordeel DÉZE toets, niet een ideale toets.
- Criteria minstens: Validiteit, RTTI-spreiding t.o.v. het doel, Taal (passend bij leerweg), Transparantie (punten/instructie), Cito-opmaak.
- Wees eerlijk. Afwijking > 8 procentpunt op een RTTI-cel = "aandacht".

Antwoord ALLEEN met één JSON-object:
{
  "meta": { "titel": string, "vak": string, "leerweg": "BB"|"KB"|"GT", "leerjaar": 1|2|3|4, "onderwerp": string },
  "vragen": [{
    "nummer": number,
    "type": "meerkeuze"|"juist-onjuist"|"open"|"invul"|"berekening"|"bronvraag",
    "rtti": "R"|"T1"|"T2"|"I",
    "domein": string,
    "leerdoel": string,
    "punten": number,
    "stam": string
  }],
  "kwaliteit": {
    "samenvatting": string,
    "punten": [{"criterium": string, "oordeel": "voldoet"|"aandacht"|"ontbreekt", "toelichting": string}]
  }
}
Als geen feedback is gevraagd: laat "kwaliteit" weg of zet punten op [].`;

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
      if (!bron.trim()) {
        return {
          ok: false,
          error: "Lever de bestaande toets in (bestand of tekst).",
        };
      }

      const rtti = normaliseer(data.rttiDoel);
      const feedback = data.feedbackGewenst
        ? "Geef WEL feedback (veld kwaliteit): beoordeel deze bestaande toets eerlijk."
        : "Geef GEEN feedback. Laat het veld kwaliteit weg.";

      const user = `Maak een toetsmatrijs bij deze BESTAANDE toets. Herschrijf niets.

School: ${SCHOOL}
Vak: ${data.vak?.trim() || "(leid af uit de toets)"}
Niveau / leerweg: ${data.leerweg}
Leerjaar: ${data.leerjaar}
Titel: ${data.titel?.trim() || "(leid af uit de toets)"}
RTTI-doelverdeling (procent van de punten, ter vergelijking): R ${rtti.R}% · T1 ${rtti.T1}% · T2 ${rtti.T2}% · I ${rtti.I}%
${feedback}

Extra van de docent:
${data.extraEisen?.trim() || "(geen)"}

Bestaande toets / vragen:
${bron}`;

      const messages = [
        { role: "system", content: MATRIJS_SYSTEM },
        { role: "user", content: user },
      ];

      let raw = await callGrok(messages, 6000);
      let parsed: unknown;
      try {
        parsed = JSON.parse(stripJsonFence(raw));
      } catch {
        raw = await callGrok(
          [
            ...messages,
            { role: "assistant", content: raw.slice(0, 4000) },
            {
              role: "user",
              content:
                "De vorige output was geen geldige JSON. Stuur hetzelfde resultaat opnieuw als één puur JSON-object, zonder markdown.",
            },
          ],
          6000,
        );
        parsed = JSON.parse(stripJsonFence(raw));
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
      const cesuurP = cesuurPunten(max, cijferNorm);
      const kwaliteit = data.feedbackGewenst
        ? payload.kwaliteit ?? {
            samenvatting: "Er kwam geen feedback terug. Open de toets opnieuw of vink feedback aan.",
            punten: [],
          }
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
          leerjaar: (Math.min(
            4,
            Math.max(1, Math.round(payload.meta.leerjaar ?? data.leerjaar)),
          ) || 2) as 1 | 2 | 3 | 4,
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
          cesuurPunten: cesuurP,
          toelichting: "Matrijs bij bestaande toets; cijfernorm is niet opnieuw vastgesteld.",
          formule: formuleTekst(cijferNorm, max),
        },
        matrijs: bouwMatrijs(vragen, rtti),
        kwaliteit,
      };

      return { ok: true, toets };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Het maken van de matrijs is mislukt.";
      return { ok: false, error: message };
    }
  });
