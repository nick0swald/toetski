import { findCorrectOptionIndex } from "./mc-balance.ts";
import type { ItemIssue } from "./item-kwaliteit";
import type { NakijkItem, Rtti, Vraag } from "./types";

/**
 * Onafhankelijke inhoudscontrole (verplicht): een tweede, redenerend model maakt elke vraag zelf,
 * zonder de sleutel te vertrouwen, en beoordeelt oplosbaarheid, realisme, helderheid en rubriek.
 * De app vergelijkt daarna in code (sleutel ↔ gevonden juiste optie) en stuurt alleen afwijkingen
 * naar de reparatie. Lesstof en antwoordenboek zijn de bron van waarheid.
 */
export interface ControleOordeel {
  nummer: number;
  eigenAntwoord: string;
  juisteOpties?: string[];
  oplosbaar: boolean;
  ontbreekt?: string;
  realistisch: boolean;
  realisme?: string;
  helder: boolean;
  helderheid?: string;
  rubriekOk: boolean;
  rubriek?: string;
  rtti?: Rtti;
}

export const CONTROLE_SYSTEM = `Je bent een strenge NaSk-docent en toetscontroleur (vmbo). Je controleert elke vraag ONAFHANKELIJK: los hem eerst zelf op zonder naar het modelantwoord te kijken.
Bron van waarheid: het antwoordenboek en de lesstof hieronder; daarna standaard Binas-waarden (geluidssnelheid in lucht 343 m/s bij 20 °C, in water ongeveer 1500 m/s, in staal ongeveer 5000–6000 m/s; g = 9,8 N/kg; dichtheid water 1,0 g/cm³).
Beoordeel per vraag:
1. eigenAntwoord: jouw eigen korte uitwerking/antwoord.
2. juisteOpties (alleen meerkeuze/juist-onjuist): ALLE letters die volgens de bron juist zijn. Precies één is goed; nul of twee is een fout.
3. oplosbaar: staan ALLE gegevens die nodig zijn in de context, stam, tabel of figuurgegevens (of standaard in Binas)? Zo nee: ontbreekt = welk gegeven. Het modelantwoord mag geen getal gebruiken dat de leerling nergens kan vinden.
4. realistisch: kloppen de getallen met de situatie (afstanden, tijden, snelheden, massa's, temperaturen, prijzen, afmetingen), is de situatie natuurkundig mogelijk en herkenbaar voor een vmbo-leerling, en spreken context, figuurgegevens en antwoord elkaar niet tegen? Voorbeelden van NIET realistisch: een echo van een kaswand op 200 m, de knal van een schrikdraadapparaat horen op 500 m, een fietser met 90 km/h, een kopje thee van 5 kg, 'na 4 seconden hoort ze de knal' zonder dat de leerling weet wanneer de knal begon (een tijdsverschil meet je alleen met een startsignaal: lichtflits, zichtbare slag of eigen roep), een meting die in de praktijk niet zo gaat. Zo nee: realisme = wat er mis is en een realistische waarde.
5. helder: is de vraag eenduidig; wordt elk ding/apparaat eerst genoemd voordat ernaar verwezen wordt ('de installatie', 'dit apparaat' zonder uitleg = niet helder); geen schoolnaam; geen verwijzing naar een figuur als er geen figuurgegevens zijn; 'Het flesje…' of 'De bak…' zonder te zeggen welk flesje/welke situatie = niet helder; juist/onjuist moet een stelling zijn (geen vraagzin); de leerling moet weten hoeveel dingen hij moet noemen. Zo nee: helderheid = wat.
6. rubriekOk: past de puntenverdeling bij het antwoord, zijn deelpunten mogelijk bij rekenvragen (een fout kost 1 punt, niet alles), en noemt de rubriek het juiste begrip? Het aantal punten moet passen bij wat gevraagd wordt: 'noem twee … en leg uit' voor 1 punt = rubriek niet ok. Zo nee: rubriek = wat.
7. rtti: R (reproductie), T1 (getrainde toepassing), T2 (toepassing in nieuwe situatie), I (inzicht).
Antwoord ALLEEN met JSON: { "oordelen": [ { "nummer": number, "eigenAntwoord": string, "juisteOpties": string[], "oplosbaar": boolean, "ontbreekt": string, "realistisch": boolean, "realisme": string, "helder": boolean, "helderheid": string, "rubriekOk": boolean, "rubriek": string, "rtti": "R"|"T1"|"T2"|"I" } ] }`;

export function controlePrompt(
  vragen: Vraag[],
  nakijk: NakijkItem[],
  bron: { lesstof: string; antwoorden?: string },
): string {
  const items = vragen.map((q) => {
    const n = nakijk.find((x) => x.nummer === q.nummer);
    const figuur = figuurGegevens(q);
    return {
      nummer: q.nummer,
      type: q.type,
      context: q.context || undefined,
      stam: q.stam,
      opties: q.opties?.map((o) => `${o.letter}. ${o.tekst}`),
      tabel: q.tabel ?? undefined,
      figuurgegevens: figuur || undefined,
      punten: q.punten,
      rtti: q.rtti,
      modelantwoord: n?.modelantwoord,
      puntenverdeling: n?.puntenverdeling?.map((p) => `${p.punt}p ${p.criterium}`),
      nietToekennen: n?.nietToekennen,
    };
  });
  const antw = bron.antwoorden?.trim() ? `\n\nANTWOORDENBOEK (bron van waarheid):\n${bron.antwoorden.trim().slice(0, 16000)}` : "";
  return `LESSTOF (bron van waarheid):\n${bron.lesstof.trim().slice(0, 20000) || "(geen)"}${antw}\n\nVRAGEN:\n${JSON.stringify(items)}`;
}

/** Beschrijving van de figuurgegevens die de leerling ziet (geen beelddata). */
function figuurGegevens(q: Vraag): string {
  if (q.figuur) return `figuur (${q.figuur.soort}): ${q.figuur.alt ?? ""}`.slice(0, 400);
  if (q.grafiek?.punten?.length) return `grafiek ${q.grafiek.xLabel} tegen ${q.grafiek.yLabel}: ${q.grafiek.punten.map((p) => `(${p.x}; ${p.y})`).join(" ")}`;
  if (q.maatcilinder) return `maatcilinder max ${q.maatcilinder.maxMl} mL, standen ${q.maatcilinder.standen.join(", ")}`;
  if (q.pictogram) return `pictogram: ${q.pictogram}`;
  if (q.schemaFiguur) return `schema (${q.schemaFiguur.soort}): ${(q.schemaFiguur.labels ?? []).join(", ")}`;
  return "";
}

const ja = (v: unknown, standaard = true): boolean => (typeof v === "boolean" ? v : typeof v === "string" ? !/^(false|nee|no|0)$/i.test(v.trim()) : standaard);
const tekstOf = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : undefined);

export function parseControle(raw: string | null | undefined): ControleOordeel[] {
  if (!raw) return [];
  let data: unknown;
  try {
    const t = raw.trim();
    const s = t.indexOf("{");
    const e = t.lastIndexOf("}");
    data = JSON.parse(s >= 0 && e > s ? t.slice(s, e + 1) : t);
  } catch {
    return [];
  }
  const lijst = (data as { oordelen?: unknown[] })?.oordelen;
  if (!Array.isArray(lijst)) return [];
  const out: ControleOordeel[] = [];
  for (const o of lijst) {
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    const nummer = Number(r.nummer);
    if (!Number.isFinite(nummer)) continue;
    const rtti = typeof r.rtti === "string" && /^(R|T1|T2|I)$/.test(r.rtti.trim()) ? (r.rtti.trim() as Rtti) : undefined;
    out.push({
      nummer,
      eigenAntwoord: tekstOf(r.eigenAntwoord) ?? "",
      juisteOpties: Array.isArray(r.juisteOpties)
        ? [...new Set(r.juisteOpties.map((x) => String(x).trim().toUpperCase().replace(/[^A-F]/g, "").slice(0, 1)).filter(Boolean))]
        : undefined,
      oplosbaar: ja(r.oplosbaar),
      ontbreekt: tekstOf(r.ontbreekt),
      realistisch: ja(r.realistisch),
      realisme: tekstOf(r.realisme),
      helder: ja(r.helder),
      helderheid: tekstOf(r.helderheid),
      rubriekOk: ja(r.rubriekOk),
      rubriek: tekstOf(r.rubriek),
      rtti,
    });
  }
  return out;
}

/** Sleutelletter uit het modelantwoord (na normalisatie op opties). */
export function sleutelLetter(q: Vraag, n: NakijkItem | undefined): string {
  if (!q.opties?.length || !n) return "";
  const i = findCorrectOptionIndex(q.opties, n.modelantwoord ?? "");
  return i >= 0 ? (q.opties[i]!.letter ?? "").toUpperCase().replace(/[^A-F]/g, "").slice(0, 1) : "";
}

/** Code-vergelijking van de oordelen → reparatie-issues (met concrete instructie). */
export function controleIssues(vragen: Vraag[], nakijk: NakijkItem[], oordelen: ControleOordeel[]): ItemIssue[] {
  const issues: ItemIssue[] = [];
  for (const o of oordelen) {
    const q = vragen.find((v) => v.nummer === o.nummer);
    if (!q) continue;
    const n = nakijk.find((x) => x.nummer === q.nummer);
    if (q.opties && q.opties.length >= 2 && o.juisteOpties) {
      const sleutel = sleutelLetter(q, n);
      if (o.juisteOpties.length === 0) {
        issues.push({ nummer: q.nummer, code: "geen-juiste-optie", uitleg: `Onafhankelijke controle: geen enkele optie is juist (eigen antwoord: ${o.eigenAntwoord || "?"}). Maak precies één optie juist volgens de lesstof en zet de sleutel daarop.` });
      } else if (o.juisteOpties.length > 1) {
        issues.push({ nummer: q.nummer, code: "meer-juiste-opties", uitleg: `Onafhankelijke controle: opties ${o.juisteOpties.join(" en ")} zijn allebei juist. Maak precies één optie juist.` });
      } else if (sleutel && o.juisteOpties[0] !== sleutel) {
        issues.push({ nummer: q.nummer, code: "sleutel-fout", uitleg: `Onafhankelijke controle: juiste optie is ${o.juisteOpties[0]}, de sleutel zegt ${sleutel} (eigen antwoord: ${o.eigenAntwoord || "?"}). Controleer met de lesstof en herstel de sleutel of de opties.` });
      }
    }
    if (!o.oplosbaar) issues.push({ nummer: q.nummer, code: "gegeven-ontbreekt", uitleg: `Niet oplosbaar: ${o.ontbreekt || "een benodigd gegeven ontbreekt"}. Zet het gegeven in de context/stam (of haal het uit het modelantwoord).` });
    if (!o.realistisch) issues.push({ nummer: q.nummer, code: "realisme", uitleg: `Niet realistisch: ${o.realisme || "getallen of situatie kloppen niet"}. Maak de situatie en getallen realistisch en pas het antwoord aan.` });
    if (!o.helder) issues.push({ nummer: q.nummer, code: "onhelder", uitleg: `Niet helder: ${o.helderheid || "vraag is niet eenduidig"}.` });
    if (!o.rubriekOk) issues.push({ nummer: q.nummer, code: "rubriek", uitleg: `Rubriek: ${o.rubriek || "past niet bij het antwoord"}. Rekenvragen: deelpunten per stap; één fout kost 1 punt.` });
  }
  return issues;
}

/** Codes die tellen als inhoudelijk probleem voor de feedback. */
export const CONTROLE_CODES: Record<string, string> = {
  "geen-juiste-optie": "geen juiste optie",
  "meer-juiste-opties": "meer juiste opties",
  "sleutel-fout": "sleutel klopte niet",
  "gegeven-ontbreekt": "gegeven ontbrak",
  realisme: "niet realistisch",
  onhelder: "onduidelijk",
  rubriek: "rubriek",
  "vage-verwijzing": "vage verwijzing",
  schoolnaam: "schoolnaam",
  "figuur-ontbreekt": "verwijzing naar ontbrekende figuur",
  dekking: "paragraafdekking",
  rtti: "RTTI-balans",
};
