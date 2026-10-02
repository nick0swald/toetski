import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cesuurPunten, formuleTekst } from "./cijfer";
import { bouwMatrijs, normaliseer, somVerdeling, totaalPunten } from "./rtti";
import { bijschavenInputSchema, bijschavenPayloadSchema, extraQuestionsInputSchema, extraQuestionsPayloadSchema, generateInputSchema, generatedPayloadSchema, matrijsInputSchema, matrijsPayloadSchema } from "./schema";
import { bouwSystemPrompt, stuurdocumentTekst } from "./stuurdocument";
import { wilGemengdeOfOpenEerst } from "./vraag-volgorde";
import { annoteerMcAandeel, mcShareDoelTekst, wilHogeMcShare } from "./mc-aandeel";
import { CONTROLE_SYSTEM, REPAIR_SYSTEM, werkVragenAf } from "./afwerken";
import { extractParagrafen } from "./leerdoelen";
import { kritiseerBouwplan, maakBouwplan, maakQuota, type PlanItem, type PlanQuota } from "./bouwplan.ts";
import { herstelBouwplan, openHard } from "./bouwplan-check.ts";
import { ontdubbelNamen, planStukken, schrijfOpdracht, voegStukkenSamen } from "./plan-schrijven.ts";
import { annoteerLeerdoelen, herstelLeerdoelen, leerdoelenPrompt, maakLeerdoelPlan, novaDoelenPerParagraaf, zonderDoelJargon } from "./leerdoelen-plan";
import { bouwKwaliteit } from "./kwaliteit-check";
import { LIMIETEN, PLAN, TIJD, metRttiDoel, tokensVoorAantalVragen } from "./config";
import { CACHE_GRENS, berichten, nieuweKosten, vraagJson, vriendelijkeAiFout, xaiChat, type Kosten } from "./llm";
import type { GegenereerdeToets, NakijkItem, Vraag } from "./types";
import {
  annoteerKalibratie,
  isExamenNiveau,
  isNaskVak,
  kalibratie,
  kalibratiePrompt,
  normaliseerVraagtypen,
  novaParagrafen,
  novaPrompt,
  vraagtypenPrompt,
  type Kalibratie,
  lengteDoelVoor,
} from "./kalibratie";
import { CSE_CONTEXTEN } from "./cse-contexten";
import { herstelGroepen } from "./context-groepen";
import { deelKalibratie, deelOpdracht, deelPlan, trimOverschot, voegDelenSamen } from "./delen";
import {
  aantalExamenContexten,
  examenvragenPrompt,
  kiesExamenContexten,
  magExamenvragen,
  markeerExamenvragen,
  wilGeenExamenvragen,
} from "./examenvragen";

/** NaSk-kalibratie voor deze aanvraag (null bij andere vakken). */
function kalibratieVoor(data: { vak?: string; titel?: string; extraEisen?: string; leerjaar: number; leerweg: "BB" | "KB" | "GT"; duurMinuten: number; moeilijkheid?: string }, bron: string): Kalibratie | null {
  if (!isNaskVak(data.vak, bron)) return null;
  const examen = isExamenNiveau(`${data.titel ?? ""} ${data.extraEisen ?? ""}`);
  return kalibratie(data.leerjaar, data.leerweg, data.duurMinuten, {
    examen,
    moeilijkheid: data.moeilijkheid === "makkelijk" || data.moeilijkheid === "moeilijk" ? data.moeilijkheid : "normaal",
  });
}

/** Zette de docent niets vast, dan volgen aantal vragen en punten de kalibratie (alleen NaSk). */
const metKalibratieLengte = lengteDoelVoor;

/** Trim context/stam; lege context wordt weggelaten. Volgorde (inleiding→vraag) wordt via prompts afgedwongen. */
function normaliseerVraagTekst<T extends { context?: string; stam: string }>(q: T): T {
  const context = (q.context ?? "").trim();
  const stam = (q.stam ?? "").trim();
  return {
    ...q,
    context: context || undefined,
    stam,
  } as T;
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
    headers: { "User-Agent": "Toetski/1.0" },
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

/** Inhoudscontrole (rol "controle", grok-4.5 low, temp 0) met eigen timeout uit config.ts. */
function controleAanroep(kosten: Kosten): (prompt: string) => Promise<string | null> {
  return (prompt) => xaiChat("controle", berichten(CONTROLE_SYSTEM, prompt), { maxTokens: 6000, timeoutMs: TIJD.controleTimeoutMs, kosten }).catch(() => null);
}

/** Reparatie (rol "repareren", grok-4.5 low) met eigen timeout uit config.ts. */
function reparatieAanroep(kosten: Kosten, min = 2000): (prompt: string) => Promise<string | null> {
  return (prompt) =>
    xaiChat("repareren", berichten(REPAIR_SYSTEM, prompt), {
      maxTokens: Math.min(8000, Math.max(min, Math.ceil(prompt.length / 3))) + LIMIETEN.redeneerMarge,
      timeoutMs: TIJD.reparatieTimeoutMs,
      kosten,
    }).catch(() => null);
}

/** Plaatjeskeuze uit de invoer (oude invoer: metPlaatjes=false → zonder). */
export function plaatjesModus(input: { plaatjes?: "auto" | "met" | "zonder"; metPlaatjes?: boolean }): "auto" | "met" | "zonder" {
  return input.plaatjes ?? (input.metPlaatjes === false ? "zonder" : "auto");
}

const FIGUUR_BASIS =
  "Pictogramvraag: veld pictogram (GHS-symbool voor stoffen, of een veiligheidsbord zoals gebod-gehoorbescherming) en beschrijf het symbool niet. Onderdompelen: veld maatcilinder met af te lezen standen. Figuren passen bij Nova NaSk (VMBO): spanningsmeter parallel over een lampje/weerstand, nooit over de bron; stroommeter in serie.";

/** Figuurregel in de prompt: automatisch (terughoudend), verplicht met plaatjes, of helemaal zonder. */
export function figuurRegel(modus: boolean | "auto" | "met" | "zonder"): string {
  const m = modus === true ? "auto" : modus === false ? "zonder" : modus;
  if (m === "zonder")
    return "ZONDER PLAATJES: maak GEEN figuren — geen velden grafiek, schemaFiguur, pictogram of maatcilinder. Verwijs in geen enkele vraag naar een figuur, grafiek, afbeelding, plaatje, tekening of schema. Alle gegevens die nodig zijn staan in de tekst of in een tabel (veld tabel).";
  if (m === "met")
    return `MET PLAATJES (keuze van de docent, verplicht): maak minstens 3 vragen waarbij de leerling een figuur echt nodig heeft — bijv. een grafiek aflezen (veld grafiek met exacte punten), een schakeling (veld schemaFiguur), krachten/hefboom, een maatcilinder aflezen of een gevarensymbool (pictogram) — passend bij de lesstof. ${FIGUUR_BASIS}`;
  return `Figuren: volg wat de docent in de instructies/extra eisen vraagt; anders alleen als een figuur echt iets toevoegt (aflezen, herkennen, schakeling, krachten). 0 figuren is prima. ${FIGUUR_BASIS}`;
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
    metPlaatjes?: boolean;
    plaatjes?: "auto" | "met" | "zonder";
  },
  bron: string,
  kal?: { k: Kalibratie; extra: string } | null,
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
    verdelingTekst = kal
      ? `AUTO (~${input.aantalVragen} vragen): volg de vraagvormen uit het KALIBRATIE-blok hieronder (gesloten ≈${Math.round(kal.k.gesloten * 100)}%).`
      : `AUTO (~${input.aantalVragen} vragen): kies MC vs open op basis van de lesstof. Dictee/schrijf/luister/spreek → vooral open, weinig of geen MC. Hoofdstuktoets met voldoende stof → ${mcShareDoelTekst()} Anders gemengd.`;
  }
  // Puntenplan: gesloten vragen zijn 1 punt, dus de open vragen moeten de rest van het totaal dragen.
  const geslotenN = mcN ?? Math.ceil(input.aantalVragen / 2);
  const openPlanN = Math.max(1, (openN ?? input.aantalVragen - geslotenN));
  const openPunten = Math.max(openPlanN, input.doelPunten - geslotenN);
  const puntenPlan = kal ? "" : `Puntenplan (verplicht, tel na): ${geslotenN} gesloten vragen × 1 punt = ${geslotenN} punten; ${openPlanN} open vragen samen ${openPunten} punten (gemiddeld ${(openPunten / openPlanN).toFixed(1).replace(".", ",")} per open vraag: 2–4 punten, met een rubriek van 1 punt per onderdeel). Totaal ${geslotenN + openPunten}.`;
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

Lesstof is leidend.
Vak: ${input.vak?.trim() || "(leid af uit de lesstof)"}
Niveau: ${input.leerweg}
Leerjaar: ${input.leerjaar}
Titel: ${input.titel?.trim() || "(leid af uit de lesstof)"}
Toetsduur: ${input.duurMinuten} minuten
Aantal vragen: ${input.aantalVragen} (lever er echt zoveel; de toets moet de toetsduur vullen)
Vraagverdeling: ${verdelingTekst}
Totaal punten: ${input.doelPunten} (± 2; passend bij ${input.duurMinuten} minuten, tenzij de docent anders stuurt)
${puntenPlan}
${paragrafenRegel(bron, input.antwoordenmateriaal)}
${kal ? `${kalibratiePrompt(kal.k)}\n${kal.extra}` : ""}
Context-eisen (verplicht): realistische getallen en situaties (een echo in een lokaal of hal: tientallen meters, niet honderden; geluid van een klein apparaat hoor je niet op 500 m); alle gegevens die nodig zijn staan in de vraag; noem een ding eerst concreet voordat je 'de/dit' gebruikt; nooit een schoolnaam; verzonnen bedrijven mogen grappig zijn (bijv. 'Frituur De Vette Hap'); personen hebben Nederlandse voornamen (Sanne, Daan, Lotte, Bram). Staat er een figuur of tabel bij, zet de getallen die nodig zijn ÓÓK in de vraagtekst (de figuur kan wegvallen). Een tijdsverschil (echo, onweer) meet je alleen met een startsignaal (flits, zichtbare klap, eigen roep). Juist/onjuist is altijd een stelling, nooit een vraagzin. Elke context is een echte zin (geen los woord als 'pictogram').
Juist/onjuist: opties altijd in de volgorde A. Juist, B. Onjuist.
Rekenvragen: 1 punt per stap: 2p = gebruik van de formule (grootheid benoemd) + rest van de berekening juist (uitkomst met eenheid); 3p = omrekenen/aflezen + formule + rest. Geen punt voor 'gegevens en gevraagde'. Een reken- en eenheidsfout kosten samen hooguit 1 punt; significantie kost geen punten.
Puntenregels: MC/juist-onjuist max 1p (tenzij stam een extra opdracht stelt); eenvoudige open 1–2p; overige open/berekening = 1p per nakijkstap; 'noem twee' = 2p, 'noem … en leg uit' = 2p. Haal het totaal met genoeg open meerpuntsvragen (uitleg, berekening), niet met extra 1-punts meerkeuze.
MC-sleutel: het juiste antwoord mag op A, B, C of D staan (niet steeds dezelfde letter). De app husselt de opties daarna en zet de rubriek op "Juiste keuze <letter>". modelantwoord = letter + tekst (bijv. "C. 12 N"). Schrijf in puntenverdeling geen letter.
Vraagstam-volgorde (Cito): EERST situatieschets/inleiding, DAARNA de vraagzin. NOOIT andersom. Optioneel veld context = inleiding vóór stam, alleen als die iets toevoegt.
Volgorde vragen (standaard): EERST alle meerkeuze/juist-onjuist, DAARNA open/berekening/invul/bron. Vragen met dezelfde contextTitel staan aaneen. Alleen afwijken als Extra eisen of het KALIBRATIE-blok dat vragen.
${figuurRegel(plaatjesModus(input))}
Kwaliteit in JSON: alleen een korte kwalitatieve opmerking. Verzin geen puntentotaal, RTTI-percentages, figuuraantal of "dekt alle leerdoelen" — de app rekent die zelf uit.
Domein = paragraaf uit de leerdoelen (bijv. "2.1 Stoffen herkennen"), niet een losse deelvaardigheid. Zet PLUS in het leerdoel als het leerdoel PLUS is. Spelling: stofeigenschap.
Versie: ${input.versie ?? "A"}
Moeilijkheid: ${moeTekst}
RTTI-doel: R ${rtti.R}% · T1 ${rtti.T1}% · T2 ${rtti.T2}% · I ${rtti.I}%
${somVerdeling(input.rttiDoel) === 100 ? "" : "(Verdeling is genormaliseerd naar 100%.)"}
Cijfernorm: ${input.cijferNorm?.model ?? "lineair"}

Extra eisen van de docent:
${input.extraEisen?.trim() || "(geen)"}
${feedbackBlok}
Leerlingboek / lesstof (KADER: leerdoelen/begrippen/formules én vraagSTIJL ter inspiratie — maak vergelijkbare maar NOOIT 1:1 of near-copy; namen/getallen/én context altijd aanpassen; klassieke modellen zoals cv/pomp → andere praktijkcontext; geen "zoals in het boek"; kopieer geen antwoorden naar de leerlingtoets):
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

/** Paragrafen uit de koppen van lesstof/antwoordenboek → dekkingseis in de prompt. */
function paragrafenRegel(bron: string, antwoorden?: string): string {
  const pars = extractParagrafen(bron, antwoorden);
  if (pars.length < 2) return "";
  return `Paragrafen (dekking verplicht): ${pars.map((p) => `${p.code} ${p.titel}`).join("; ")}. Minstens één vraag per paragraaf, verdeeld naar de hoeveelheid stof; domein = paragraafnummer + titel (bijv. "${pars[0]!.code} ${pars[0]!.titel}").`;
}

type GenerateData = z.infer<typeof generateInputSchema>;

/** Officiële leerdoelen (NaSk): deterministisch uit hoofdstuk/onderwerp/lesstof; zelfde invoer → zelfde plan. */
function leerdoelPlanVoor(data: GenerateData, k: Kalibratie | null, bron: string) {
  if (!k) return null;
  return maakLeerdoelPlan({
    titel: data.titel ?? "",
    bron,
    antwoorden: data.antwoordenmateriaal ?? "",
    leerjaar: k.leerjaar,
    leerweg: k.leerweg,
    doelPunten: data.doelPunten,
    aantalVragen: data.aantalVragen,
  });
}
type GeneratedPayload = z.infer<typeof generatedPayloadSchema>;

class GebruikersFout extends Error {}

/**
 * Voorbereiding van stap 1 (zonder modelaanroep): lesstof, kalibratie, examencontexten, leerdoelen en het
 * volledige toetsvoorvoegsel. Ook gebruikt door de plan-first-route en de offline eval (scripts/eval).
 */
export async function bereidVoor(data: GenerateData) {
  data = metRttiDoel(data);
  let bron = data.bronmateriaal ?? "";
  if (data.bronUrl?.trim()) {
    const extra = await fetchBronUrl(data.bronUrl.trim());
    bron = [bron, extra].filter(Boolean).join("\n\n");
  }
  bron = bron.slice(0, LIMIETEN.bronMax);
  const antwoorden = (data.antwoordenmateriaal ?? "").slice(0, LIMIETEN.bronMax);
  if (!bron.trim()) throw new GebruikersFout("Plak lesstof, lever het leerlingboek in, of zet een openbare link.");
  const k = kalibratieVoor(data, bron);
  data = metKalibratieLengte(data, k);
  // Klas 4 / examenniveau: blok 'Examenvragen' met echte CSE-contexten (klas 1–3 nooit).
  const examen =
    k && magExamenvragen(k.leerjaar, k.examen) && data.examenvragen !== false && !wilGeenExamenvragen(`${data.extraEisen ?? ""}\n${data.feedback ?? ""}`)
      ? kiesExamenContexten(bron, k.leerweg, aantalExamenContexten(k.leerweg, k.items))
      : [];
  const plan = leerdoelPlanVoor({ ...data, antwoordenmateriaal: antwoorden }, k, bron);
  const kal = k
    ? {
        k,
        extra: [
          leerdoelenPrompt(plan),
          vraagtypenPrompt(bron, k.leerjaar, k.leerweg),
          novaPrompt(data.titel ?? "", bron, k.leerjaar, k.leerweg, extractParagrafen(bron, antwoorden).length >= 2),
          examenvragenPrompt(examen),
        ]
          .filter(Boolean)
          .join("\n"),
      }
    : null;
  const system = bouwSystemPrompt(data.stuurdocument);
  const basisPrompt = userPrompt({ ...data, antwoordenmateriaal: antwoorden }, bron, kal);
  return { data, bron, antwoorden, k, examen, plan, kal, system, basisPrompt };
}

/** Quota voor plan-first (alleen NaSk met kalibratie, genoeg vragen, geen feedbackronde); anders null. */
export function planQuotaVoor(v: Awaited<ReturnType<typeof bereidVoor>>): PlanQuota | null {
  const { data, bron, antwoorden, k } = v;
  if (!PLAN.aan || !k || data.feedback?.trim() || data.aantalVragen < PLAN.minVragen) return null;
  const koppen = extractParagrafen(bron, antwoorden);
  const paragrafen = koppen.length >= 2 ? koppen : novaParagrafen(data.titel ?? "", bron, k.leerjaar, k.leerweg);
  const quota = maakQuota({ bron, paragrafen, aantalVragen: data.aantalVragen, doelPunten: data.doelPunten, rttiDoel: normaliseer(data.rttiDoel), kal: k });
  const doelen = novaDoelenPerParagraaf(paragrafen, { titel: data.titel, bron, leerjaar: k.leerjaar, leerweg: k.leerweg });
  return Object.keys(doelen).length ? { ...quota, doelen } : quota;
}

/** Stap 1: lesstof ophalen + modelaanroep → ruwe vragen (nog niet afgewerkt). */
async function genereerRuw(invoer: GenerateData, kosten: Kosten = nieuweKosten()): Promise<{ bron: string; payload: GeneratedPayload }> {
  const deadline = Date.now() + TIJD.vragenDeadlineMs;
  const voor = await bereidVoor(invoer);
  const { data, bron, antwoorden, k, examen, plan, kal, system, basisPrompt } = voor;
  // Plan-first: bouwplan → controle/herstel → parallel schrijven met het hele plan. Lukt het plan niet
  // (fout, time-out, harde planfout), dan de oude route hieronder.
  const quota = planQuotaVoor(voor);
  if (quota) {
    const viaPlan = await schrijfViaPlan({ system, basisPrompt, quota, deadline, kosten }).catch((e) => {
      console.warn("[generate] plan-first mislukt, oude route:", e instanceof Error ? e.message.slice(0, 200) : e);
      return null;
    });
    if (viaPlan) {
      if (examen.length) viaPlan.examenContexten = examen.map((c) => c.id);
      return { bron, payload: viaPlan };
    }
  }
  // Lange NaSk-toetsen: gesloten en open deel parallel (samen binnen TIJD.vragenDeadlineMs).
  const delen = k && !data.feedback?.trim() ? deelPlan(k, data.aantalVragen, data.doelPunten) : null;
  let payload: GeneratedPayload;
  if (delen) {
    const [a, b] = await Promise.all(
      delen.map((d, i) => {
        // Elk deel krijgt zijn eigen aantallen en vormmix, zodat het model niet de hele toets maakt.
        const kd = deelKalibratie(k!, d, data.aantalVragen);
        const deelData = { ...data, aantalVragen: d.aantal, doelPunten: d.punten, antwoordenmateriaal: antwoorden };
        const deelKal = { k: kd, extra: d.soort === "gesloten" ? [leerdoelenPrompt(plan, true), vraagtypenPrompt(bron, kd.leerjaar, kd.leerweg)].filter(Boolean).join("\n") : kal!.extra };
        const opdracht = deelOpdracht(d, delen[1 - i]!);
        return vraagPayload(system, `${opdracht}\n\n${userPrompt(deelData, bron, deelKal)}\n\n${opdracht}`, d.aantal, deadline, kosten).catch((e) => {
          console.warn(`[generate] deel ${d.soort} mislukt:`, e instanceof Error ? e.message.slice(0, 200) : e);
          return null;
        });
      }),
    );
    if (!b && (a?.vragen.length ?? 0) < 8) throw new Error("De AI-respons was onvolledig. Probeer opnieuw.");
    payload = voegDelenSamen(a, b);
  } else {
    payload = await vraagPayload(system, basisPrompt, data.aantalVragen, deadline, kosten);
  }
  // Ruim meer vragen dan het doel (model negeerde het aantal): overschot eraf vóór het afwerken.
  if (k && data.lengteAuto && payload.vragen.length > data.aantalVragen + 3) {
    const t = trimOverschot(payload.vragen, payload.nakijkmodel, data.aantalVragen, data.doelPunten, Math.round(k.gesloten * data.aantalVragen));
    payload = { ...payload, vragen: t.vragen, nakijkmodel: t.nakijkmodel };
  }
  if (examen.length) payload.examenContexten = examen.map((c) => c.id);
  return { bron, payload };
}

/** Plan-first route (zie bouwplan.ts, bouwplan-check.ts, plan-schrijven.ts). */
async function schrijfViaPlan(o: { system: string; basisPrompt: string; quota: PlanQuota; deadline: number; kosten: Kosten }): Promise<GeneratedPayload | null> {
  const ruwPlan = await maakBouwplan({ system: o.system, voorvoegsel: o.basisPrompt, quota: o.quota, rest: () => o.deadline - Date.now(), kosten: o.kosten });
  let { plan, issues } = herstelBouwplan(ruwPlan, o.quota);
  if (PLAN.kritiek && o.deadline - Date.now() > 100_000) {
    const k = await kritiseerBouwplan({ system: o.system, voorvoegsel: o.basisPrompt, plan, rest: () => o.deadline - Date.now(), kosten: o.kosten });
    if (k.vervangen.length) {
      console.info("[generate] bouwplan-kritiek:", k.vervangen.join("; "));
      ({ plan, issues } = herstelBouwplan(k.plan, o.quota));
    }
  }
  const hard = openHard(issues);
  if (hard.length) {
    console.warn("[generate] bouwplan heeft harde fouten:", hard.map((h) => h.detail).join("; "));
    return null;
  }
  const stukken = planStukken(plan.items);
  const schrijf = (stuk: PlanItem[]) =>
    vraagPayload(o.system, `${o.basisPrompt}${CACHE_GRENS}${schrijfOpdracht(plan, stuk, o.quota)}`, stuk.length, o.deadline, o.kosten).catch((e) => {
      console.warn(`[generate] schrijfstuk ${stuk[0]!.n}–${stuk[stuk.length - 1]!.n} mislukt:`, e instanceof Error ? e.message.slice(0, 200) : e);
      return null;
    });
  const res = await Promise.all(stukken.map(schrijf));
  // Eén herkansing voor mislukte stukken als er nog genoeg tijd is.
  if (res.some((r) => !r) && o.deadline - Date.now() > TIJD.herkansingMinRestMs) {
    await Promise.all(res.map(async (r, i) => (r ? r : (res[i] = await schrijf(stukken[i]!)))));
  }
  const geschreven = res.reduce((s, r) => s + (r?.vragen.length ?? 0), 0);
  if (geschreven < Math.ceil(plan.items.length * 0.7)) throw new Error(`plan-first: maar ${geschreven} van ${plan.items.length} vragen geschreven`);
  const samen = voegStukkenSamen(res, stukken, o.quota);
  const namen = ontdubbelNamen(samen.vragen, samen.nakijkmodel);
  if (namen.vervangen.length) console.info("[generate] namen ontdubbeld:", namen.vervangen.join("; "));
  return { ...samen, vragen: namen.vragen, nakijkmodel: namen.nakijkmodel, bouwplan: { ...plan, issues } };
}

/** Eén schrijf-aanroep (rol "schrijven") met één herkansing voor kapotte JSON, binnen de deadline. */
function vraagPayload(system: string, prompt: string, aantal: number, deadline: number, kosten: Kosten): Promise<GeneratedPayload> {
  return vraagJson("schrijven", berichten(system, prompt), (u) => generatedPayloadSchema.parse(u), {
    maxTokens: tokensVoorAantalVragen(aantal),
    rest: () => deadline - Date.now(),
    kosten,
    herkansingMinRestMs: TIJD.herkansingMinRestMs,
  });
}


/** Ruwe vragen uit de payload (genormaliseerd) — ook de basis voor de vroege beeldpijplijn. */
export function ruweVragen(payload: Pick<GeneratedPayload, "vragen">): Vraag[] {
  return payload.vragen.map((q, i) =>
    normaliseerVraagTekst({
      ...q,
      nummer: q.nummer || i + 1,
      opties: q.opties?.length ? q.opties : undefined,
    }),
  );
}

/** Stap 2: afwerken (reparatie, punten, MC-hussel, kwaliteit) → complete toets. */
async function rondAf(data: GenerateData, bron: string, payload: GeneratedPayload, budgetMs: number = TIJD.afwerkBudgetMs, kosten: Kosten = nieuweKosten()): Promise<GegenereerdeToets> {
  data = metRttiDoel(data);
  const kal = kalibratieVoor(data, bron);
  data = metKalibratieLengte(data, kal);
  const examenCtx = CSE_CONTEXTEN.filter((c) => payload.examenContexten?.includes(c.id));
  const rttiDoel = normaliseer(data.rttiDoel);
  // Examencontexten vóór de controle herkennen (groep + intro), zodat controle en volgorde ze als blok zien.
  const vragenRaw = herstelGroepen(markeerExamenvragen(ruweVragen(payload), examenCtx));
  const vakNaam = data.vak?.trim() || payload.meta.vak || "";
  const skipMcEerst = wilGemengdeOfOpenEerst(`${data.extraEisen ?? ""}\n${data.feedback ?? ""}`);
  const af = await werkVragenAf({
    vragen: vragenRaw,
    nakijkmodel: payload.nakijkmodel,
    bron,
    vak: vakNaam,
    skipOrder: skipMcEerst,
    figuren: plaatjesModus(data) === "zonder" ? "geen" : "nodig",
    antwoorden: data.antwoordenmateriaal ?? "",
    rttiDoel,
    doelPunten: data.doelPunten,
    budgetMs,
    ...(kal
      ? {
          volgorde: skipMcEerst ? undefined : kal.opbouw === "blokken" ? ("blokken" as const) : kal.opbouw === "cse" ? ("behoud" as const) : ("mc-eerst" as const),
          paragrafen: novaParagrafen(data.titel ?? "", bron, kal.leerjaar, kal.leerweg),
          minGesloten: Math.max(0, kal.gesloten - 0.05),
        }
      : {}),
    controleer: controleAanroep(kosten),
    repair: reparatieAanroep(kosten),
  });
  const leerdoelPlan = leerdoelPlanVoor(data, kal, bron);
  const gelabeld = kal ? herstelLeerdoelen(zonderDoelJargon(markeerExamenvragen(normaliseerVraagtypen(af.vragen), examenCtx)), leerdoelPlan) : { vragen: af.vragen, hersteld: [] };
  const vragen = gelabeld.vragen;
  if (leerdoelPlan && gelabeld.hersteld.length) leerdoelPlan.hersteld = gelabeld.hersteld;
  const nakijkmodel = af.nakijkmodel;
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
      school: "",
      hulpmiddelen: payload.meta.hulpmiddelen,
      instructies: payload.meta.instructies,
      onderwerp: payload.meta.onderwerp || data.titel || payload.meta.titel,
      versie: data.versie,
      moeilijkheid: data.moeilijkheid,
      ...(data.rttiHandmatig ? { rttiHandmatig: true } : {}),
      extraTijd: payload.meta.extraTijd?.trim() || undefined,
    },
    vragen,
    nakijkmodel,
    cesuur: {
      nTerm: 1,
      cesuurPunten: cesuurP,
      toelichting: payload.cesuur.toelichting,
      formule: formuleTekst(cijferNorm, max),
    },
    matrijs: bouwMatrijs(vragen, rttiDoel),
    kwaliteit: (kal ? (kw: GegenereerdeToets["kwaliteit"]) => annoteerLeerdoelen(annoteerKalibratie(kw, vragen, kal, bron), vragen, leerdoelPlan) : (kw: GegenereerdeToets["kwaliteit"]) => kw)(annoteerMcAandeel(
      bouwKwaliteit({
        vragen,
        nakijkmodel,
        bron,
        vak: vakNaam,
        rttiDoel,
        llm: payload.kwaliteit,
        issues: af.issues,
        controle: af.controle,
      }),
      vragen,
      // NaSk: het gekalibreerde gesloten aandeel (zie KALIBRATIE) vervangt de algemene ≥50%-regel.
      !kal &&
        wilHogeMcShare({
          bron,
          extraEisen: data.extraEisen,
          titel: data.titel || payload.meta.titel,
          vak: data.vak || payload.meta.vak,
          mcVragen: data.mcVragen,
          openVragen: data.openVragen,
        }),
    )),
  };
  if (af.controle) toets.controle = af.controle;
  toets.kosten = kosten;
  if (leerdoelPlan) toets.leerdoelen = leerdoelPlan;
  const modus = plaatjesModus(data);
  toets.plaatjes = modus;
  if (modus === "zonder") toets.metPlaatjes = false;
  return toets;
}

/** Alleen voor de offline eval (scripts/eval): dezelfde stappen als de server-functies, zonder HTTP. */
export const _intern = { genereerRuw, rondAf };

/** Stap 1 los (voor de snelle route: figuren starten zodra de vragen er zijn). */
export const generateVragenRuw = createServerFn({ method: "POST" })
  .validator((input: unknown) => generateInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; bron: string; payload: GeneratedPayload; kosten: Kosten; duurMs: number } | { ok: false; error: string }> => {
    const kosten = nieuweKosten();
    const t0 = Date.now();
    try {
      return { ok: true, ...(await genereerRuw(data, kosten)), kosten, duurMs: Date.now() - t0 };
    } catch (err) {
      return { ok: false, error: err instanceof GebruikersFout ? err.message : vriendelijkeAiFout(err) };
    }
  });

const afwerkInputSchema = z.object({
  input: generateInputSchema,
  bron: z.string().max(210000),
  payload: z.unknown(),
  /** Tijd sinds de start (client-klok). Alleen informatief: het afwerkbudget is vast (config.TIJD), want stap 2 is een eigen Vercel-aanroep. */
  verstrekenMs: z.number().min(0).max(300_000).optional(),
});


/** Stap 2 los: afwerken + kwaliteit. Payload wordt opnieuw gevalideerd (komt van de client). */
export const afwerkToets = createServerFn({ method: "POST" })
  .validator((input: unknown) => afwerkInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; toets: GegenereerdeToets } | { ok: false; error: string }> => {
    try {
      const payload = generatedPayloadSchema.parse(data.payload);
      const t0 = Date.now();
      const toets = await rondAf(data.input, data.bron, payload, TIJD.afwerkBudgetMs);
      if (toets.kosten) toets.kosten.duurAfwerkenMs = Date.now() - t0;
      return { ok: true, toets };
    } catch (err) {
      return { ok: false, error: vriendelijkeAiFout(err) };
    }
  });

const MATRIJS_SYSTEM = `Je bent toetsconstructeur voor het vmbo. Noem in vragen nooit een schoolnaam.
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

Vak: ${data.vak?.trim() || "(leid af)"}
Niveau: ${data.leerweg}
Leerjaar: ${data.leerjaar}
RTTI-doel: R ${rtti.R}% · T1 ${rtti.T1}% · T2 ${rtti.T2}% · I ${rtti.I}%
${feedback}
Notities van de docent:
${data.extraEisen?.trim() || "(geen)"}

Bestaande toets:
${bron}`;
      const t0 = Date.now();
      const payload = await vraagJson("snel", berichten(MATRIJS_SYSTEM, user), (u) => matrijsPayloadSchema.parse(u), {
        maxTokens: 8000,
        rest: () => TIJD.losseAanroepMs - (Date.now() - t0),
        herkansingTekst: "Stuur hetzelfde resultaat opnieuw als één puur JSON-object.",
      });
      const vragen = payload.vragen.map((q, i) =>
        normaliseerVraagTekst({
          ...q,
          nummer: q.nummer || i + 1,
          stam: q.stam || q.leerdoel || `Vraag ${q.nummer || i + 1}`,
          opties: q.opties?.length ? q.opties : undefined,
        }),
      );
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
          school: "",
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


function tokensVoorExtraVragen(n: number): number {
  const aantal = Math.max(1, Math.min(8, Math.floor(n || 1)));
  return Math.min(8000, Math.max(1800, 900 + aantal * 450));
}

const EXTRA_JSON_SCHEMA = `Antwoord ALLEEN met één JSON-object, geen markdown. Schema:
{
  "vragen": [{ "nummer": number, "type": "meerkeuze"|"juist-onjuist"|"open"|"invul"|"berekening"|"bronvraag", "rtti": "R"|"T1"|"T2"|"I", "domein": string, "leerdoel": string, "punten": number, "context": string, "stam": string, "opties": [{"letter":"A","tekst": string}], "tabel": { "koppen": string[], "rijen": string[][] }, "grafiek": { "titel": string, "xLabel": string, "yLabel": string, "punten": [{"x": number, "y": number}] }, "schemaFiguur": { "soort": "circuit"|"krachten"|"blokken", "titel": string, "labels": string[] }, "pictogram": "ontvlambaar"|"giftig"|"bijtend"|"milieu"|"schadelijk"|"explosief"|"oxiderend"|"gas-onder-druk"|"gezondheidsgevaar", "maatcilinder": { "titel": string, "maxMl": number, "standen": [{"label": string, "ml": number}] } }],
  "nakijkmodel": [{ "nummer": number, "modelantwoord": string, "puntenverdeling": [{"punt": number, "criterium": string}], "nietToekennen": string[] }]
}
Geef precies het gevraagde aantal vragen. Nummers starten bij het opgegeven startnummer. Figuren alleen als nuttig. Geen meta, cesuur of kwaliteit.
`;

function extraUserPrompt(input: {
  count: number;
  mcVragen?: number;
  openVragen?: number;
  vak?: string;
  leerweg: string;
  leerjaar: number;
  moeilijkheid?: string;
  rttiDoel: { R: number; T1: number; T2: number; I: number };
  extraEisen?: string;
  startNummer: number;
  bestaandeVragen: { nummer: number; type: string; stam: string; rtti?: string }[];
}, bron: string): string {
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
    verdelingTekst = `VAST: ${mcN} meerkeuze; vul aan met open/andere tot ${input.count} vragen.`;
  } else if (openN != null) {
    verdelingTekst = `VAST: ${openN} open/andere; vul aan met meerkeuze tot ${input.count} vragen waar passend.`;
  } else {
    verdelingTekst = `AUTO: kies MC vs open passend bij de bestaande toets en de lesstof (totaal precies ${input.count}).`;
  }
  const bestaande = input.bestaandeVragen
    .map((q) => `${q.nummer}. [${q.type}${q.rtti ? `/${q.rtti}` : ""}] ${q.stam.slice(0, 220)}`)
    .join("\n");
  return `Voeg ${input.count} NIEUWE originele vraag/vragen toe aan een BESTAANDE VMBO-toets.
Je maakt GEEN volledige toets opnieuw. Alleen de extra vragen + nakijkmodel daarvoor.

Vak: ${input.vak?.trim() || "(leid af uit de lesstof)"}
Niveau: ${input.leerweg}
Leerjaar: ${input.leerjaar}
Moeilijkheid: ${moeTekst}
RTTI-doel (richtlijn voor de nieuwe vragen): R ${rtti.R}% · T1 ${rtti.T1}% · T2 ${rtti.T2}% · I ${rtti.I}%
Vraagverdeling: ${verdelingTekst}
Startnummer: ${input.startNummer} (nummer de nieuwe vragen opeenvolgend vanaf hier)
Puntenregels: MC/juist-onjuist max 1p (tenzij stam een extra opdracht stelt); eenvoudige open 1–2p; overige open/berekening = 1p per nakijkstap; 'noem twee' = 2p, 'noem … en leg uit' = 2p. Haal het totaal met genoeg open meerpuntsvragen (uitleg, berekening), niet met extra 1-punts meerkeuze.
MC-sleutel: het juiste antwoord mag op A, B, C of D staan (niet steeds dezelfde letter). De app husselt de opties daarna en zet de rubriek op "Juiste keuze <letter>". modelantwoord = letter + tekst (bijv. "C. 12 N"). Schrijf in puntenverdeling geen letter.
Vraagstam-volgorde (Cito): EERST situatieschets/inleiding, DAARNA de vraagzin. NOOIT andersom. Optioneel veld context = inleiding vóór stam.
Volgorde vragen (standaard): EERST alle meerkeuze/juist-onjuist, DAARNA open/berekening/invul/bron. Alleen afwijken als Extra eisen dat expliciet vragen (open eerst / gemengde volgorde).

Bestaande vragen (NIET herhalen, niet parafraseren; maak iets anders met andere namen/getallen/situaties):
${bestaande || "(geen)"}

Extra eisen van de docent:
${input.extraEisen?.trim() || "(geen)"}

Leerlingboek / lesstof (KADER: leerdoelen/begrippen/formules én vraagSTIJL ter inspiratie — NOOIT 1:1 dezelfde vragen; geen "zoals in het boek"):
${bron.trim() || "(geen bron)"}`;
}

/**
 * Genereert 1–N extra vragen voor een bestaande toets (zonder de hele toets opnieuw te maken).
 * Client voegt resultaat toe en hernummert/herbouw matrijs via de store.
 */
export const generateExtraQuestions = createServerFn({ method: "POST" })
  .validator((input: unknown) => extraQuestionsInputSchema.parse(input))
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; vragen: Vraag[]; nakijkmodel: NakijkItem[] } | { ok: false; error: string }
    > => {
      try {
        const bron = (data.bronmateriaal ?? "").slice(0, 100000);
        if (!bron.trim()) {
          return { ok: false, error: "Geen lesstof bij deze toets; extra vragen maken lukt dan niet." };
        }
        if (data.mcVragen != null && data.openVragen != null && data.mcVragen + data.openVragen !== data.count) {
          return { ok: false, error: "MC + open moet gelijk zijn aan het aantal extra vragen." };
        }
        const stuur = data.stuurdocument?.trim() || stuurdocumentTekst();
        const system = `Je bent toetsconstructeur voor het vmbo (BB, KB en GT). Noem in vragen nooit een schoolnaam.
Je volgt dit stuurdocument. Je voegt alleen extra vragen toe aan een bestaande toets.

${stuur}

${EXTRA_JSON_SCHEMA}`;
        const kosten = nieuweKosten();
        const t0 = Date.now();
        const rest = () => TIJD.losseAanroepMs - (Date.now() - t0);
        const payload = await vraagJson("schrijven", berichten(system, extraUserPrompt(data, bron)), (u) => extraQuestionsPayloadSchema.parse(u), {
          maxTokens: tokensVoorExtraVragen(data.count) + LIMIETEN.redeneerMarge,
          rest,
          kosten,
          herkansingTekst: "Stuur hetzelfde resultaat opnieuw als één compleet puur JSON-object met alleen vragen en nakijkmodel, zonder markdown. Kap niet af.",
        });
        const start = data.startNummer;
        const vragenRaw = payload.vragen.slice(0, data.count).map((q, i) =>
          normaliseerVraagTekst({
            ...q,
            nummer: start + i,
            opties: q.opties?.length ? q.opties : undefined,
          }),
        );
        const nakijkRaw = payload.nakijkmodel.slice(0, data.count).map((n, i) => ({
          ...n,
          nummer: vragenRaw[i]?.nummer ?? start + i,
        }));
        // Vul ontbrekende nakijkregels bij zodat balance/merge stabiel blijft.
        if (nakijkRaw.length < vragenRaw.length) {
          const have = new Set(nakijkRaw.map((n) => n.nummer));
          for (const q of vragenRaw) {
            if (!have.has(q.nummer)) {
              nakijkRaw.push({
                nummer: q.nummer,
                modelantwoord: "",
                puntenverdeling: [{ punt: q.punten || 1, criterium: "Correct antwoord" }],
                nietToekennen: [],
              });
            }
          }
        }
        const af = await werkVragenAf({
          vragen: vragenRaw,
          nakijkmodel: nakijkRaw,
          bron: data.bronmateriaal || "",
          vak: data.vak?.trim() || "",
          skipOrder: true,
          budgetMs: Math.max(20_000, rest()),
          repair: reparatieAanroep(kosten, 1800),
        });
        const vragen = af.vragen;
        const nakijkmodel = af.nakijkmodel;
        if (vragen.length < 1) {
          return { ok: false, error: "De AI leverde geen bruikbare extra vragen." };
        }
        return { ok: true, vragen, nakijkmodel };
      } catch (err) {
        return { ok: false, error: vriendelijkeAiFout(err) };
      }
    },
  );
const BIJSCHAVEN_JSON = `Antwoord ALLEEN met één JSON-object, geen markdown. Schema:
{
  "vragen": [ /* ALLE vragen van de toets, eventueel aangepast */ ],
  "nakijkmodel": [ /* ALLE nakijkregels, nummers synchroon met vragen */ ],
  "toelichting": string
}
Behoud hetzelfde aantal vragen tenzij de instructie expliciet vraagt om te schrappen of te splitsen.
Nummers 1…n opeenvolgend. Figuurvelden (tabel/grafiek/schemaFiguur) behouden tenzij de instructie die wijzigt.
Vragen met "figuurId" hebben een vastgezette, goedgekeurde figuur: neem "figuurId" exact over, voeg bij die vraag GEEN figuurvelden toe, en houd de vraag passend bij die figuur (de figuur zelf verandert nooit).
Geen meta, cesuur of kwaliteit.
`;

/**
 * Gericht bijschaven: herschikken, punten, of één/enkele vraag — géén volledige regeneratie.
 */
export const bijschavenToets = createServerFn({ method: "POST" })
  .validator((input: unknown) => bijschavenInputSchema.parse(input))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; vragen: Vraag[]; nakijkmodel: NakijkItem[]; toelichting: string }
      | { ok: false; error: string }
    > => {
      try {
        const instructie = data.instructie.trim();
        if (!instructie) return { ok: false, error: "Typ een korte instructie voor het bijschaven." };
        const stuur = data.stuurdocument?.trim() || stuurdocumentTekst();
        const system = `Je bent toetsconstructeur voor het vmbo. Noem in vragen nooit een schoolnaam.
Je BIJSCHAAFT een bestaande toets op basis van een korte docentinstructie.
Je maakt GEEN nieuwe toets van scratch. Wijzig alleen wat nodig is (volgorde/punten/één of enkele vragen/nakijk).
Houd nakijkmodel synchroon met vraagnummers. RTTI/domein/leerdoel behouden tenzij de instructie die raakt.
Meerkeuze: het juiste antwoord mag op elke letter staan. De software husselt de opties daarna. Verwijs in uitleg naar de inhoud, niet naar de letter.

${stuur}

${BIJSCHAVEN_JSON}`;

        const bestaande = data.vragen
          .map((q) => {
            const opt =
              q.opties?.length ? ` | opties: ${q.opties.map((o) => `${o.letter}:${o.tekst}`).join("; ")}` : "";
            const fig = q.figuurId ? `\nfiguurId: ${q.figuurId} (vastgezette figuur onder de stam; niet wijzigen)` : "";
            return `${q.nummer}. [${q.type}/${q.rtti}] ${q.punten}p · ${q.domein} · ${q.leerdoel}\ncontext: ${q.context || "—"}\nstam: ${q.stam}${opt}${fig}`;
          })
          .join("\n\n");
        const nakijk = data.nakijkmodel
          .map(
            (n) =>
              `v${n.nummer}: ${n.modelantwoord} | ${n.puntenverdeling.map((p) => `${p.punt}p:${p.criterium}`).join("; ")}`,
          )
          .join("\n");

        const user = `Bijschaaf-instructie van de docent:
${instructie}

Vak: ${data.vak?.trim() || "(onbekend)"} · ${data.leerweg} klas ${data.leerjaar}

Huidige vragen:
${bestaande}

Huidig nakijkmodel:
${nakijk || "(leeg)"}

Lesstof (alleen raadplegen bij inhoudelijke wijziging van een vraag; niet alles herschrijven):
${(data.bronmateriaal ?? "").trim().slice(0, 12000) || "(geen)"}

Lever ALLE vragen + nakijkmodel terug (aangepast of ongewijzigd).`;

        const kosten = nieuweKosten();
        const t0 = Date.now();
        const rest = () => TIJD.losseAanroepMs - (Date.now() - t0);
        const payload = await vraagJson("schrijven", berichten(system, user), (u) => bijschavenPayloadSchema.parse(u), {
          maxTokens: Math.min(14000, Math.max(4000, 2000 + data.vragen.length * 400)) + LIMIETEN.redeneerMarge,
          rest,
          kosten,
          herkansingTekst: "Stuur hetzelfde resultaat opnieuw als één compleet puur JSON-object met vragen, nakijkmodel en toelichting. Kap niet af.",
        });
        const vragenRaw = payload.vragen.map((q, i) =>
          normaliseerVraagTekst({
            ...q,
            nummer: q.nummer || i + 1,
            opties: q.opties?.length ? q.opties : undefined,
          }),
        );
        const nakijkRaw = payload.nakijkmodel.map((n, i) => ({
          ...n,
          nummer: n.nummer || vragenRaw[i]?.nummer || i + 1,
        }));
        if (nakijkRaw.length < vragenRaw.length) {
          const have = new Set(nakijkRaw.map((n) => n.nummer));
          for (const q of vragenRaw) {
            if (!have.has(q.nummer)) {
              const old = data.nakijkmodel.find((n) => n.nummer === q.nummer);
              nakijkRaw.push(
                old ?? {
                  nummer: q.nummer,
                  modelantwoord: "",
                  puntenverdeling: [{ punt: q.punten || 1, criterium: "Correct antwoord" }],
                  nietToekennen: [],
                },
              );
            }
          }
        }
        const skipMcEerst = wilGemengdeOfOpenEerst(instructie);
        const af = await werkVragenAf({
          vragen: vragenRaw,
          nakijkmodel: nakijkRaw,
          bron: data.bronmateriaal ?? "",
          vak: data.vak?.trim() || "",
          skipOrder: skipMcEerst,
          budgetMs: Math.max(20_000, rest()),
          repair: reparatieAanroep(kosten, 1800),
        });
        return {
          ok: true,
          vragen: af.vragen,
          nakijkmodel: af.nakijkmodel,
          toelichting: payload.toelichting?.trim() || "Bijgeschaafd.",
        };
      } catch (err) {
        return { ok: false, error: vriendelijkeAiFout(err) };
      }
    },
  );
