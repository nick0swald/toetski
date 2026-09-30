import type { Kwaliteitscheck, Leerweg, Moeilijkheid, Vraag } from "./types";
import {
  EXAMEN_PROFIELEN,
  NOVA_HOOFDSTUKKEN,
  NOVA_LEERDOELEN,
  SCHOOL_PROFIELEN,
  VRAAGTYPEN,
  type SchoolProfielData,
} from "./kalibratie-data.ts";

/**
 * Kalibratie NaSk op Nick's eigen toetsen (school-sectie van kalibratie.json v2) als primaire default
 * voor klas 1–4, met de CSE-kalibratie voor klas 4 / examenniveau. Stuurt op minuten per item en
 * punten per item (vervangt de oude 0,75×/0,9×-factoren op examen-punten-per-minuut).
 * Alleen statistiek en geparafraseerde patronen: geen vraag- of examenteksten.
 */

export type Opbouw = "los" | "situaties" | "blokken" | "cse";
export type FormuleRegel = "in-vraag" | "in-vraag-woorden" | "bovenaan-woorden" | "zelf-kiezen" | "niet-gegeven";

export interface Kalibratie {
  sleutel: string;
  leerjaar: 1 | 2 | 3 | 4;
  leerweg: Leerweg;
  examen: boolean;
  minuten: number;
  /** Scoorbare items (in Toetski = vragen; elke juist/onjuist-stelling telt als item). */
  items: number;
  punten: number;
  minPerItem: number;
  puntenPerItem: number;
  pct1p: number;
  /** Aandeel items per vorm (%): jn = juist/onjuist, mc, kort, invul, uitleg, reken, teken. */
  vorm: { jn: number; mc: number; kort: number; invul: number; uitleg: number; reken: number; teken: number };
  /** Gesloten aandeel (MC + juist/onjuist) als fractie. */
  gesloten: number;
  rekenMax: number;
  formule: FormuleRegel;
  opbouw: Opbouw;
  contexten?: { aantal: [number, number]; vragenPer: [number, number]; introWoorden: [number, number] };
  examenvragenBlok: boolean;
  afbeeldingen: number;
  topTypen: string[];
}

const NASK_RE = /\bnask\b|natuur\s*(?:-|en)?\s*scheikunde|natuurkunde|scheikunde|\bnat\s*\/\s*sk\b|\bns\s*1\b/i;
const NASK_BRON_RE = /\b(?:geluid|trilling|frequentie|decibel|kracht|newton|hefboom|dichtheid|stroomkring|spanning|weerstand|vermogen|smeltpunt|kookpunt|fase|snelheid|energie|warmte|magneet|elektri\w*|oscilloscoop)\b/gi;

/** NaSk herkennen aan het vak, of (vak leeg) aan de lesstof. */
export function isNaskVak(vak?: string, bron?: string): boolean {
  if (vak?.trim()) return NASK_RE.test(vak);
  const b = (bron ?? "").slice(0, 20000);
  if (NASK_RE.test(b.slice(0, 3000))) return true;
  const hits = new Set((b.match(NASK_BRON_RE) ?? []).map((x) => x.toLowerCase()));
  return hits.size >= 4;
}

/** Examenniveau: expliciet gevraagd (oefenexamen, CSE, examentraining). */
export function isExamenNiveau(tekst: string): boolean {
  return /\b(?:oefen)?examen(?:niveau|toets|training)?\b|\bcse\b|\bse-toets\b/i.test(tekst);
}

function vormUit(p: Record<string, number>): Kalibratie["vorm"] {
  const g = (k: string) => Math.round(p[k] ?? 0);
  return {
    jn: g("waar/niet waar"),
    mc: g("MC"),
    kort: g("kort antwoord"),
    invul: g("invullen/aankruisen"),
    uitleg: g("uitleggen"),
    reken: g("berekening"),
    teken: g("tekenen"),
  };
}

function formuleRegel(leerjaar: number, leerweg: Leerweg, p: SchoolProfielData, examen: boolean): FormuleRegel {
  if (examen || (leerjaar === 4 && leerweg !== "BB")) return "niet-gegeven";
  if (leerweg === "BB" && leerjaar >= 3) return "bovenaan-woorden";
  if (leerjaar <= 2) return leerweg === "BB" ? "in-vraag-woorden" : "in-vraag";
  return p.formuleGegeven === true ? "in-vraag" : "zelf-kiezen";
}

function opbouwVoor(leerjaar: number, leerweg: Leerweg, examen: boolean): Opbouw {
  if (examen) return "cse";
  if (leerweg === "BB") return "blokken";
  if (leerjaar === 4) return "cse";
  if (leerjaar === 3) return "situaties";
  return "los";
}

const r = (n: number) => Math.round(n);

/** Gekalibreerde defaults voor een NaSk-toets van `minuten` minuten. */
export function kalibratie(
  leerjaar: number,
  leerweg: Leerweg,
  minuten: number,
  opts?: { examen?: boolean; moeilijkheid?: Moeilijkheid },
): Kalibratie {
  const jaar = (Math.min(4, Math.max(1, Math.round(leerjaar || 2))) as 1 | 2 | 3 | 4);
  const m = Math.max(10, Math.min(180, minuten || 45));
  const sp = SCHOOL_PROFIELEN[`${jaar}${leerweg}`]!;
  const examen = Boolean(opts?.examen);
  const ex = EXAMEN_PROFIELEN[leerweg];
  let minPerItem = examen ? ex.minPerItem : sp.minPerItem;
  let puntenPerItem = examen ? ex.puntenPerVraag : sp.puntenPerItem;
  const pct1p = examen ? ex.pct1p : sp.pct1p;
  if (opts?.moeilijkheid === "makkelijk") minPerItem *= 0.93; // meer korte kennisvragen
  if (opts?.moeilijkheid === "moeilijk") {
    minPerItem *= 1.08;
    puntenPerItem *= 1.08;
  }
  const items = Math.max(6, Math.min(45, r(m / minPerItem)));
  const punten = Math.max(10, Math.min(100, r(items * puntenPerItem)));
  const vorm = vormUit(examen ? ex.vormPct : sp.vormPct);
  const opbouw = opbouwVoor(jaar, leerweg, examen);
  let contexten: Kalibratie["contexten"];
  if (opbouw === "cse") {
    const per = (examen ? ex.vragenPerContext : leerweg === "GT" ? [2, 4] : [3, 4]) as [number, number];
    const gem = (per[0] + per[1]) / 2;
    const n = Math.max(2, r(items / gem));
    contexten = { aantal: [Math.max(2, n - 1), n + 1], vragenPer: per, introWoorden: ex.introWoorden as [number, number] };
  } else if (opbouw === "situaties") {
    contexten = { aantal: [2, 4], vragenPer: [2, 3], introWoorden: [15, 35] };
  } else if (opbouw === "blokken" && (sp.examenvragenBlok || jaar === 4)) {
    contexten = { aantal: [1, 2], vragenPer: [3, 4], introWoorden: EXAMEN_PROFIELEN.BB.introWoorden as [number, number] };
  }
  return {
    sleutel: `${jaar}${leerweg}`,
    leerjaar: jaar,
    leerweg,
    examen,
    minuten: m,
    items,
    punten,
    minPerItem: Math.round(minPerItem * 100) / 100,
    puntenPerItem: Math.round(puntenPerItem * 100) / 100,
    pct1p: r(pct1p),
    vorm,
    gesloten: (vorm.jn + vorm.mc) / 100,
    rekenMax: examen ? ex.rekenMax : sp.rekenMax,
    formule: formuleRegel(jaar, leerweg, sp, examen),
    opbouw,
    contexten,
    examenvragenBlok: opbouw === "blokken" && Boolean(contexten),
    afbeeldingen: sp.afbeeldingen,
    topTypen: sp.topTypen,
  };
}

/** Aantallen per vorm (items), afgerond zodat de som klopt. */
export function vormAantallen(k: Kalibratie): Record<keyof Kalibratie["vorm"], number> {
  const keys = Object.keys(k.vorm) as (keyof Kalibratie["vorm"])[];
  const som = keys.reduce((s, x) => s + k.vorm[x], 0) || 100;
  const ruw = keys.map((x) => ({ x, v: (k.vorm[x] / som) * k.items }));
  const out = Object.fromEntries(ruw.map(({ x, v }) => [x, Math.floor(v)])) as Record<keyof Kalibratie["vorm"], number>;
  let tekort = k.items - keys.reduce((s, x) => s + out[x], 0);
  for (const { x } of [...ruw].sort((a, b) => (b.v % 1) - (a.v % 1))) {
    if (tekort <= 0) break;
    out[x] += 1;
    tekort -= 1;
  }
  return out;
}

const FORMULE_TEKST: Record<FormuleRegel, string> = {
  "in-vraag": "Formules: geef bij elke rekenvraag de formule in de vraag (bijv. 'Gebruik de formule: snelheid = afstand : tijd'). Omrekenen alleen eenvoudig en liever als losse vraag.",
  "in-vraag-woorden": "Formules: geef bij elke rekenvraag de formule in woorden in de vraag. Rekenvragen zijn klein (1–2 stappen).",
  "bovenaan-woorden": "Formules: zet ALLE formules die de leerling nodig heeft in woorden in meta.instructies, als één regel die begint met 'Formules:' (die staat bovenaan de toets). Herhaal ze niet in de vragen.",
  "zelf-kiezen": "Formules: NIET geven; de leerling kiest zelf de formule (Binas mag). Hooguit één omrekening per rekenvraag.",
  "niet-gegeven": "Formules: NIET geven (examenniveau); omrekenen hoort bij de vraag.",
};

/** Promptblok met de kalibratie (aantallen, vorm, punten, opbouw, formules, nakijkstijl, opdrachtwoorden). */
export function kalibratiePrompt(k: Kalibratie): string {
  const a = vormAantallen(k);
  const n1 = Math.min(k.items, r((k.items * k.pct1p) / 100));
  const meer = Math.max(1, k.items - n1);
  const meerPunten = Math.max(meer * 2, k.punten - n1);
  const regels: string[] = [];
  regels.push(
    `KALIBRATIE NaSk ${k.sleutel}${k.examen ? " (examenniveau)" : ""} — afgeleid uit echte toetsen van deze school${k.examen || k.leerjaar === 4 ? " en het CSE" : ""}; dit gaat vóór algemene richtlijnen:`,
  );
  regels.push(
    `- Omvang: ${k.items} vragen (±2) in ${k.minuten} min (≈${String(k.minPerItem).replace(".", ",")} min per vraag), samen ${k.punten} punten (±2). Elke juist/onjuist-stelling is een eigen vraag.`,
  );
  const vormen = [
    a.jn && `${a.jn} juist/onjuist-stellingen`,
    a.mc && `${a.mc} meerkeuze`,
    a.kort && `${a.kort} kort antwoord (noteer/noem)`,
    a.invul && `${a.invul} invullen/omcirkelen/aankruisen (type invul)`,
    a.reken && `${a.reken} berekening`,
    a.uitleg && `${a.uitleg} uitleggen`,
    a.teken && `${a.teken} tekenen/aanvullen`,
  ].filter(Boolean);
  regels.push(`- Vraagvormen (ongeveer): ${vormen.join(", ")}.`);
  regels.push(
    `- Punten: ±${n1} vragen van 1 punt (${k.pct1p}%); de overige ${meer} vragen samen ±${meerPunten} punten (2–${k.rekenMax}p, 1 punt per nakijkstap). Een rekenvraag is hooguit ${k.rekenMax} punten.`,
  );
  regels.push(`- ${FORMULE_TEKST[k.formule]}`);
  if (k.opbouw === "los") {
    regels.push("- Opbouw: losse vragen met elk 1–2 korte zinnen situatie; geen doorlopende contexten; hooguit 3–4 voornamen in de hele toets. Korte zinnen (≤12 woorden).");
  } else if (k.opbouw === "situaties") {
    const c = k.contexten!;
    regels.push(
      `- Opbouw: losse vragen plus ${c.aantal[0]}–${c.aantal[1]} kleine situaties met elk ${c.vragenPer[0]}–${c.vragenPer[1]} vragen. Geef de vragen van één situatie hetzelfde veld contextTitel (2–4 woorden) en zet de inleiding (${c.introWoorden[0]}–${c.introWoorden[1]} woorden) alleen in context van de EERSTE vraag van die situatie; de volgende vragen geven alleen hun nieuwe gegevens.`,
    );
  } else if (k.opbouw === "blokken") {
    regels.push(
      `- Opbouw in blokken: EERST alle juist/onjuist-stellingen (1p, korte stellingen), DAN de meerkeuzevragen (1p), DAN de open vragen en berekeningen met een korte situatie.`,
    );
    if (k.contexten) {
      const c = k.contexten;
      regels.push(
        `- Laatste blok 'Examenvragen': ${c.aantal[0]}–${c.aantal[1]} context(en) in examenstijl (≈20% van de punten), elk met contextTitel (2–4 woorden), intro ${c.introWoorden[0]}–${c.introWoorden[1]} woorden in context van de eerste vraag en ${c.vragenPer[0]}–${c.vragenPer[1]} vragen; één voornaam per context.`,
      );
    }
  } else {
    const c = k.contexten!;
    regels.push(
      `- Opbouw als een mini-examen: ${c.aantal[0]}–${c.aantal[1]} contexten, elk met een contextTitel van 2–4 woorden (zelfde contextTitel bij alle vragen van die context) en een intro van ${c.introWoorden[0]}–${c.introWoorden[1]} woorden in context van de EERSTE vraag; ${c.vragenPer[0]}–${c.vragenPer[1]} vragen per context, volgorde herkennen → rekenen → redeneren/tekenen; per vraag 1–2 zinnen nieuwe gegevens. Precies één voornaam per context. Mix categorieën (huis & keuken, verkeer, werk & beroep, techniek, sport & vrije tijd, natuur); schoolsituaties spaarzaam, nooit een schoolnaam.`,
    );
  }
  regels.push(
    "- Nakijkmodel: 1 punt per stap, één regel per scorepunt. Rekenvraag 2p = 'gebruik van de formule … (grootheid benoemd)' + 'rest van de berekening juist (uitkomst met eenheid)'; 3p = 'omrekenen/aflezen van …' + formule + rest. Géén punt voor 'gegevens en gevraagde' of voor overschrijven. Aftrek (examenregel): een rekenfout en een fout/ontbrekende eenheid samen hooguit 1 punt; significantie kost nooit punten.",
  );
  const leg = k.leerjaar <= 2 ? "hooguit 1–2× per toets" : "spaarzaam";
  regels.push(
    `- Opdrachtwoorden: Bereken, Noteer, Omcirkel in elke zin de juiste mogelijkheid, Maak … compleet, Teken, Kruis aan. Meerkeuze als vraagzin ('Wat is juist over …?', 'Welke …?'). 'Leg uit' ${leg}${k.leerweg === "GT" ? "; 'Bepaal' en 'Toon met een berekening aan' mogen" : ""}. Niet: 'Toon aan', 'Beredeneer', 'Schat'.`,
  );
  return regels.join("\n");
}

/** Toetslengte voor het formulier/de server: gekalibreerd bij NaSk, anders null. */
export function gekalibreerdeLengte(
  minuten: number,
  leerweg: Leerweg,
  leerjaar: number,
  moeilijkheid: Moeilijkheid = "normaal",
  examen = false,
): { punten: number; vragen: number } {
  const k = kalibratie(leerjaar, leerweg, minuten, { moeilijkheid, examen });
  return { punten: k.punten, vragen: k.items };
}

// ---------------------------------------------------------------- vraagtypen (taxonomie)

const DOMEIN_RE: Record<string, RegExp> = {
  geluid: /geluid|trilling|frequentie|decibel|\bdb\b|echo|oscilloscoop|gehoor|toonhoogte/i,
  krachten: /kracht|newton|hefboom|moment|katrol|druk\b|vector|zwaartepunt/i,
  bewegen: /snelheid|beweg|remweg|stopafstand|versnelling|botsing|gordel/i,
  elektriciteit: /stroom|spanning|weerstand|schakel|elektri|lampje|batterij|accu|zekering/i,
  stoffen: /stof(?:fen|eigenschap)|dichtheid|mengsel|materiaal|smelt|kook|fase|oploss/i,
  warmte: /warmte|temperatuur|isolat|geleiding|straling|stroming/i,
  energie: /energie|rendement|vermogen|joule|kwh/i,
  verbranden: /verbrand|brandstof|vuur|zuurstof|ontbrand/i,
  magnetisme: /magneet|magnetisch|spoel|transformator|dynamo|elektromotor/i,
  licht: /\blicht|spiegel|lens|schaduw|breking|kleur/i,
  heelal: /heelal|planeet|maan|zon\b|seizoen|ster(?:ren)?\b|zonnestelsel/i,
  weer: /\bweer\b|neerslag|luchtdruk|wind|waterkringloop|wolk/i,
};

export const VRAAGTYPE_IDS = new Set(VRAAGTYPEN.map((t) => t.id));

/** Domeinen die in de lesstof voorkomen (op volgorde van aantal treffers). */
export function domeinenUitBron(bron: string): string[] {
  const t = bron.slice(0, 30000);
  return Object.entries(DOMEIN_RE)
    .map(([d, re]) => [d, (t.match(new RegExp(re.source, "gi")) ?? []).length] as const)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([d]) => d);
}

/** Relevante vraagtypen voor deze lesstof en klas (frequente examentypen eerst vanaf klas 3). */
export function relevanteVraagtypen(bron: string, leerjaar: number, leerweg: Leerweg, max = 18) {
  const dom = new Set([...domeinenUitBron(bron).slice(0, 4), "vaardigheden"]);
  const onderbouw = leerjaar <= 2;
  return VRAAGTYPEN.filter((t) => dom.has(t.domein))
    .filter((t) => (t.onderbouw ? onderbouw : leerweg === "BB" ? (t.niveaus.BB ?? 0) > 0 || t.domein === "vaardigheden" : true))
    .sort((a, b) => (leerjaar >= 3 ? b.freq - a.freq : (b.onderbouw ? 1 : 0) - (a.onderbouw ? 1 : 0) || b.freq - a.freq))
    .slice(0, max);
}

export function vraagtypenPrompt(bron: string, leerjaar: number, leerweg: Leerweg): string {
  const typen = relevanteVraagtypen(bron, leerjaar, leerweg);
  if (!typen.length) return "";
  const lijst = typen.map((t) => `${t.id} (${t.naam.split(/[(:;]/)[0]!.trim().slice(0, 60)})`).join("; ");
  const voorkeur = leerjaar >= 3 ? " Geef de voorkeur aan de eerst genoemde (vaak op het examen) en gebruik minstens 4 verschillende typen." : " Wissel af: minstens 4 verschillende typen.";
  return `Vraagtype (veld vraagtype, verplicht): kies per vraag één id uit: ${lijst}; past niets, gebruik OVERIG.${voorkeur}`;
}

/** Onbekende of ontbrekende vraagtypen → OVERIG. */
export function normaliseerVraagtypen(vragen: Vraag[]): Vraag[] {
  return vragen.map((q) => {
    const id = (q.vraagtype ?? "").trim().toUpperCase();
    return { ...q, vraagtype: VRAAGTYPE_IDS.has(id) ? id : "OVERIG" };
  });
}

/** Feedbackpunten: kalibratie (omvang/punten/vorm) en dekking van vraagtypen. */
export function annoteerKalibratie(kwaliteit: Kwaliteitscheck, vragen: Vraag[], k: Kalibratie, bron: string): Kwaliteitscheck {
  const punten = vragen.reduce((s, q) => s + (q.punten ?? 1), 0);
  const een = vragen.filter((q) => (q.punten ?? 1) === 1).length;
  const gesl = vragen.filter((q) => q.type === "meerkeuze" || q.type === "juist-onjuist").length;
  const pct = (x: number) => Math.round((x / Math.max(1, vragen.length)) * 100);
  const afwijk = Math.abs(vragen.length - k.items) > Math.max(3, k.items * 0.2) || Math.abs(punten - k.punten) > Math.max(4, k.punten * 0.2);
  const kal = {
    criterium: "Kalibratie (schooltoetsen)",
    oordeel: (afwijk ? "aandacht" : "voldoet") as "aandacht" | "voldoet",
    toelichting: `${vragen.length} vragen / ${punten} punten; richtwaarde ${k.sleutel} in ${k.minuten} min: ${k.items} vragen / ${k.punten} punten. 1-puntsvragen ${pct(een)}% (richt ${k.pct1p}%), gesloten ${pct(gesl)}% (richt ${Math.round(k.gesloten * 100)}%).`,
  };
  const telling = new Map<string, number>();
  for (const q of vragen) telling.set(q.vraagtype ?? "OVERIG", (telling.get(q.vraagtype ?? "OVERIG") ?? 0) + 1);
  const gebruikt = [...telling.entries()].sort((a, b) => b[1] - a[1]);
  const ontbrekend =
    k.leerjaar >= 3
      ? relevanteVraagtypen(bron, k.leerjaar, k.leerweg, 6)
          .filter((t) => t.freq >= 20 && !telling.has(t.id))
          .slice(0, 3)
          .map((t) => t.id)
      : [];
  const verschillend = gebruikt.filter(([id]) => id !== "OVERIG").length;
  const typ = {
    criterium: "Vraagtypen",
    oordeel: (verschillend >= 4 && !ontbrekend.length ? "voldoet" : "aandacht") as "aandacht" | "voldoet",
    toelichting: `${verschillend} verschillende typen: ${gebruikt.map(([id, n]) => `${id} ${n}×`).join(", ")}.${ontbrekend.length ? ` Veelvoorkomende examentypen bij deze stof die ontbreken: ${ontbrekend.join(", ")}.` : ""}`,
  };
  const rest = (kwaliteit.punten ?? []).filter((p) => p.criterium !== kal.criterium && p.criterium !== typ.criterium);
  return { samenvatting: kwaliteit.samenvatting, punten: [...rest, kal, typ] };
}

// ---------------------------------------------------------------- Nova (paragrafen + leerdoelen)

export type NovaSerie = "kgt12" | "gt3" | "gt4";

export function novaSerie(leerjaar: number, leerweg: Leerweg): NovaSerie | null {
  if (leerweg === "BB") return null;
  if (leerjaar <= 2) return "kgt12";
  return leerjaar === 3 ? "gt3" : "gt4";
}

function kaal(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Nova-hoofdstuk dat bij de titel/lesstof past (hoofdstuknummer + titel, of ≥2 paragraaftitels). */
export function vindNovaHoofdstuk(titel: string, bron: string, leerjaar: number, leerweg: Leerweg) {
  const serie = novaSerie(leerjaar, leerweg);
  if (!serie) return null;
  const t = kaal(`${titel} ${bron.slice(0, 4000)}`);
  const kop = kaal(titel);
  let beste: { serie: NovaSerie; hoofdstuk: (typeof NOVA_HOOFDSTUKKEN)["kgt12"][number]; score: number } | null = null;
  for (const h of NOVA_HOOFDSTUKKEN[serie]) {
    let score = 0;
    const ht = kaal(h.titel);
    if (kop.includes(ht)) score += 3;
    if (new RegExp(`\\b(?:h|hoofdstuk) ?${h.n}\\b`).test(kop)) score += 2;
    score += h.paragrafen.filter((p) => kaal(p.titel).length > 4 && t.includes(kaal(p.titel))).length * 2;
    if (score > (beste?.score ?? 0)) beste = { serie, hoofdstuk: h, score };
  }
  return beste && beste.score >= 4 ? beste : null;
}

/** Promptregel met Nova-paragrafen en leerdoelen; alleen als de bron zelf geen paragraafkoppen heeft. */
export function novaPrompt(titel: string, bron: string, leerjaar: number, leerweg: Leerweg, heeftKoppen: boolean): string {
  const hit = vindNovaHoofdstuk(titel, bron, leerjaar, leerweg);
  if (!hit) return "";
  const h = hit.hoofdstuk;
  const doelen = NOVA_LEERDOELEN[hit.serie] ?? {};
  const regels = h.paragrafen.map((p) => {
    const code = `${h.n}.${p.n}`;
    const ld = Object.entries(doelen)
      .filter(([c]) => c.startsWith(`${code}.`))
      .map(([, tekst]) => tekst.replace(/^Je kunt /, ""))
      .slice(0, 5);
    return `${code} ${p.titel}${ld.length ? `: ${ld.join("; ")}` : ""}`;
  });
  return heeftKoppen
    ? `Nova-leerdoelen bij dit hoofdstuk (ter controle; de koppen in de lesstof blijven leidend): ${regels.join(" | ")}`
    : `Nova H${h.n} ${h.titel} — paragrafen en leerdoelen (dekking verplicht, minstens één vraag per paragraaf; domein = "<nr> <titel>"): ${regels.join(" | ")}`;
}

/** Nova-paragrafen als dekkingslijst (als de bron geen eigen koppen heeft). */
export function novaParagrafen(titel: string, bron: string, leerjaar: number, leerweg: Leerweg): { code: string; titel: string }[] {
  const hit = vindNovaHoofdstuk(titel, bron, leerjaar, leerweg);
  return hit ? hit.hoofdstuk.paragrafen.map((p) => ({ code: `${hit.hoofdstuk.n}.${p.n}`, titel: p.titel })) : [];
}
