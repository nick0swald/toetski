import { findCorrectOptionIndex } from "./mc-balance.ts";
import type { NakijkItem, Vraag, VraagOptie } from "./types";
import { bevatSchoolnaam, figuurVerwijzingenZonderFiguur, onopgeloste, repareerSchoolnamen } from "./context-regels.ts";

export type ItemIssue = { nummer: number; code: string; uitleg: string };

const STOFEIG = ["kleur", "geur", "smaak", "dichtheid", "brandbaarheid", "kookpunt", "smeltpunt", "oplosbaarheid"];
const HIERARCHIE: [string, string[]][] = [
  ["mengsel", ["suspensie", "oplossing", "emulsie", "legering"]],
  ["zuivere stof", ["element", "verbinding"]],
];
const AFLEIDER_POOL = ["zand", "hout", "glas", "steen", "papier"];
const VEILIG_TEMPLATE: VraagOptie[] = [
  { letter: "A", tekst: "het etiket en het gevarensymbool bekijken" },
  { letter: "B", tekst: "eraan ruiken" },
  { letter: "C", tekst: "een beetje proeven" },
  { letter: "D", tekst: "een klein beetje bij een vlam houden" },
];

function cloneVragen(vragen: Vraag[]): Vraag[] {
  return vragen.map((q) => ({
    ...q,
    opties: q.opties?.map((o) => ({ ...o })),
    tabel: q.tabel ? { koppen: [...q.tabel.koppen], rijen: q.tabel.rijen.map((r) => [...r]) } : undefined,
  }));
}

function cloneNakijk(nakijk: NakijkItem[]): NakijkItem[] {
  return nakijk.map((n) => ({
    ...n,
    puntenverdeling: (n.puntenverdeling ?? []).map((p) => ({ ...p })),
    nietToekennen: n.nietToekennen ? [...n.nietToekennen] : undefined,
  }));
}

function nakijkVan(nakijk: NakijkItem[], q: Vraag, i: number): NakijkItem | undefined {
  return nakijk.find((n) => n.nummer === q.nummer) ?? nakijk[i];
}

function sleutelIndex(q: Vraag, n: NakijkItem | undefined): number {
  if (!q.opties?.length) return -1;
  return findCorrectOptionIndex(q.opties, n?.modelantwoord ?? "");
}

function zetSleutel(q: Vraag, n: NakijkItem | undefined, idx: number): void {
  const opt = q.opties?.[idx];
  if (!opt || !n) return;
  n.modelantwoord = `${opt.letter}. ${opt.tekst}`;
}

export function boekDichtheden(bron: string): number[] {
  const set = new Set<number>();
  const re = /(\d+(?:[.,]\d+)?)\s*g\s*\/\s*cm/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bron))) {
    const n = Number(m[1]!.replace(",", "."));
    if (Number.isFinite(n) && n > 0 && n < 40) set.add(Math.round(n * 100) / 100);
  }
  return [...set];
}

function formatNl(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return String(Math.round(rounded));
  const one = Math.round(rounded * 10) / 10;
  if (Math.abs(rounded - one) < 1e-6) return one.toFixed(1).replace(".", ",");
  return rounded.toFixed(2).replace(".", ",");
}

function exactOpEenDecimaal(n: number): boolean {
  return Math.abs(n * 10 - Math.round(n * 10)) < 1e-6;
}

function vindMassaVolume(tekst: string): { massa: number; volume: number } | null {
  const massa = tekst.match(/(\d+(?:[.,]\d+)?)\s*g\b(?!\s*\/)/i);
  const vol = tekst.match(/(\d+(?:[.,]\d+)?)\s*cm\s*[³3]/i);
  if (!massa?.[1] || !vol?.[1]) return null;
  const m = Number(massa[1].replace(",", "."));
  const v = Number(vol[1].replace(",", "."));
  if (!Number.isFinite(m) || !Number.isFinite(v) || v === 0) return null;
  return { massa: m, volume: v };
}

function dichtBij(n: number, verboden: number[]): boolean {
  return verboden.some((v) => Math.abs(n - v) < 0.051 || Math.abs(n - Math.round(v * 10) / 10) < 0.051);
}

export function normaliseerTaalOpTekst(s: string): string {
  let t = s
    .replace(/\s+volgens de lesstof/gi, "")
    .replace(/\s+uit de lesstof/gi, "")
    .replace(/\s+zoals in het boek/gi, "")
    .replace(/\s+zoals in de lesstof/gi, "");
  t = t.replace(/\bvoordat hij\b/gi, "voordat de leerling");
  t = t.replace(/\bwaarbij hij\b/gi, "waarbij de leerling");
  t = t.replace(/\bals hij\b/gi, "als de leerling");
  t = t.replace(/\bdat hij\b/gi, "dat de leerling");
  t = t.replace(/\bdeze leerling\b/gi, "de leerling");
  t = t.replace(/de leerling([^.]{0,80})de leerling/gi, "de leerling$1die");
  return t.replace(/\s{2,}/g, " ").replace(/\s+([?.!,])/g, "$1").trim();
}

function pasTaalToe(vragen: Vraag[]): void {
  for (const q of vragen) {
    q.stam = normaliseerTaalOpTekst(q.stam);
    if (q.context) q.context = normaliseerTaalOpTekst(q.context);
    q.leerdoel = normaliseerTaalOpTekst(q.leerdoel || "");
    q.domein = normaliseerTaalOpTekst(q.domein || "");
  }
}

function optieOnveilig(tekst: string): boolean {
  const t = tekst.toLowerCase();
  if (/\bniet\b/.test(t) && /ruik|proef|vlam/.test(t)) return false;
  return /vlam|proeven|ruiken|drinken|aansteken|\bgeur\b|\bsmaak\b|brandbaar/.test(t);
}

function repareerOnveilig(q: Vraag, n: NakijkItem | undefined, issues: ItemIssue[]): void {
  if (!q.opties?.length || !/\bveilig/.test(q.stam.toLowerCase())) return;
  const idx = sleutelIndex(q, n);
  if (idx < 0) return;
  const key = q.opties[idx]!;
  if (!optieOnveilig(key.tekst)) return;
  issues.push({ nummer: q.nummer, code: "onveilig", uitleg: "De sleutel beloont onveilig handelen." });
  const overBrandbaar = /brandbaar|ontvlambaar|vlam/.test(`${q.stam} ${key.tekst}`.toLowerCase());
  if (overBrandbaar) {
    q.stam = "Wat is de veiligste manier om te zien of een onbekende vloeistof brandbaar is?";
    q.opties = VEILIG_TEMPLATE.map((o) => ({ ...o }));
    q.type = "meerkeuze";
    q.punten = 1;
    if (n) n.modelantwoord = "A. het etiket en het gevarensymbool bekijken";
    return;
  }
  const veilig = q.opties.findIndex((o) => /etiket|pictogram|symbool|docent|\bkleur\b/i.test(o.tekst) && !optieOnveilig(o.tekst));
  if (veilig >= 0) zetSleutel(q, n, veilig);
}

function isStof(tekst: string): boolean {
  const t = tekst.toLowerCase();
  return STOFEIG.some((s) => t.includes(s));
}

function repareerStofTegenstelling(q: Vraag, n: NakijkItem | undefined, issues: ItemIssue[]): void {
  if (!q.opties?.length) return;
  if (!/hoort niet bij/i.test(q.stam) || !/stofeigenschap/i.test(q.stam)) return;
  const idx = sleutelIndex(q, n);
  if (idx < 0) return;
  if (!q.opties.every((o) => isStof(o.tekst)) || !isStof(q.opties[idx]!.tekst)) return;
  issues.push({
    nummer: q.nummer,
    code: "dubbel-juist",
    uitleg: "De sleutel is zelf een stofeigenschap, terwijl de vraag vraagt wat er niet bij hoort.",
  });
  const juist = q.opties[idx]!.tekst;
  q.stam = "Welke eigenschap is een stofeigenschap?";
  q.opties = [
    { letter: "A", tekst: juist },
    { letter: "B", tekst: "de massa van dit voorwerp" },
    { letter: "C", tekst: "de vorm van het voorwerp" },
    { letter: "D", tekst: "de temperatuur in het lokaal" },
  ];
  if (n) n.modelantwoord = `A. ${juist}`;
}

function familieVan(tekst: string): { rol: "ouder" | "kind"; wortel: string } | null {
  const t = tekst.toLowerCase();
  for (const [ouder, kids] of HIERARCHIE) {
    if (t.includes(ouder)) return { rol: "ouder", wortel: ouder };
    if (kids.some((k) => t.includes(k))) return { rol: "kind", wortel: ouder };
  }
  return null;
}

function repareerHierarchie(q: Vraag, n: NakijkItem | undefined, issues: ItemIssue[]): void {
  if (!q.opties || q.opties.length < 2) return;
  const idx = sleutelIndex(q, n);
  const rollen = q.opties.map((o) => familieVan(o.tekst));
  for (let i = 0; i < q.opties.length; i++) {
    for (let j = i + 1; j < q.opties.length; j++) {
      const a = rollen[i];
      const b = rollen[j];
      if (!a || !b || a.wortel !== b.wortel || a.rol === b.rol) continue;
      issues.push({
        nummer: q.nummer,
        code: "dubbel-juist",
        uitleg: "Een optie is een soort van een andere optie, dus er zijn twee verdedigbare antwoorden.",
      });
      const weg = idx === i ? j : idx === j ? i : j;
      const gebruikt = new Set(q.opties.map((o) => o.tekst.toLowerCase()));
      const vervanging = AFLEIDER_POOL.find((p) => !gebruikt.has(p)) ?? "tijd";
      q.opties[weg] = { ...q.opties[weg]!, tekst: `een ${vervanging}` };
      return;
    }
  }
}

function repareerUitgesloten(q: Vraag, issues: ItemIssue[]): void {
  if (!q.opties?.length) return;
  const m = q.stam.match(/in plaats van ([a-zà-ÿ-]+)/i) ?? q.stam.match(/\bzonder ([a-zà-ÿ-]+)/i);
  if (!m?.[1]) return;
  const uit = m[1].toLowerCase();
  const idx = q.opties.findIndex((o) => o.tekst.toLowerCase().trim() === uit || o.tekst.toLowerCase().includes(uit));
  if (idx < 0) return;
  issues.push({ nummer: q.nummer, code: "afleider-uitgesloten", uitleg: `Optie herhaalt wat de stam uitsluit (${uit}).` });
  const gebruikt = new Set(q.opties.map((o) => o.tekst.toLowerCase()));
  const vervanging = AFLEIDER_POOL.find((p) => !gebruikt.has(p) && p !== uit) ?? "kurk";
  q.opties[idx] = { ...q.opties[idx]!, tekst: vervanging };
}

function contextNodig(q: Vraag): boolean {
  const c = (q.context ?? "").trim();
  if (!c) return false;
  if (q.pictogram || q.grafiek || q.maatcilinder || q.schemaFiguur || q.tabel) return true;
  if (/\b(deze|dit|die|dat|de figuur|het symbool|de tabel|de grafiek|de maatcilinder)\b/i.test(q.stam)) return true;
  const nums = c.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return nums.some((n) => n.length > 1 && q.stam.includes(n));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** De stam noemt het juiste MC-antwoord (weegschaal → welk instrument meet massa). */
function repareerStamVerklapt(q: Vraag, n: NakijkItem | undefined, issues: ItemIssue[]): void {
  if (!q.opties?.length) return;
  const idx = sleutelIndex(q, n);
  if (idx < 0) return;
  const key = q.opties[idx]!.tekst.trim();
  if (key.length < 4) return;
  const re = new RegExp(`\\b${escapeRe(key)}\\b`, "i");
  if (!re.test(q.stam)) return;
  issues.push({ nummer: q.nummer, code: "stam-verklapt", uitleg: "De stam noemt het juiste antwoord." });
  if (/weegschaal/i.test(key) && /instrument|massa/i.test(q.stam)) {
    q.stam = "Welk instrument meet de massa van een voorwerp?";
    return;
  }
  const zinnen = q.stam.split(/(?<=[.?!])\s+/).filter(Boolean);
  const zonder = zinnen.filter((z) => !re.test(z));
  if (zonder.length && zonder.length < zinnen.length) q.stam = zonder.join(" ").trim();
}

const TELWOORD: Record<string, number> = { twee: 2, drie: 3, vier: 4, vijf: 5 };

/** Een context van hooguit twee woorden zonder getal of zin is geen situatie. */
export function isStubContext(c: string): boolean {
  const t = c.trim();
  return t.split(/\s+/).length <= 2 && !/\d/.test(t) && !/[.!?]$/.test(t);
}

/** Juist/onjuist moet een stelling zijn, geen vraagzin. */
export function isVraagzinStelling(q: Vraag): boolean {
  if (q.type !== "juist-onjuist") return false;
  const stelling = q.stam.replace(/^.*?(?:stelling|bewering)\s*:\s*/i, "").trim();
  return /\?\s*["”']?\s*$/.test(stelling) && !/juist of onjuist\??\s*$/i.test(stelling);
}

/** "Noem twee …" of "noem … en leg uit" met minder punten dan gevraagde onderdelen. */
export function tekortPunten(q: Vraag): string | null {
  if (q.opties?.length) return null;
  const t = q.stam.toLowerCase();
  const m = t.match(/\b(?:noem|geef|beschrijf|schrijf op)\s+(twee|drie|vier|vijf)\b/);
  const n = m ? TELWOORD[m[1]!]! : 0;
  const uitleg = /\b(leg (?:ook )?uit|verklaar|waarom)\b/.test(t) ? 1 : 0;
  const nodig = Math.max(n, 1) + (uitleg && (n || /\b(noem|geef)\b/.test(t)) ? 1 : 0);
  if (nodig > (q.punten ?? 1) && nodig >= 2) return `Vraagt ${nodig} onderdelen maar geeft ${q.punten} punt(en); maak de punten gelijk aan het aantal gevraagde onderdelen of vraag minder.`;
  return null;
}

const VAAG_OBJECT = /^(het|de|dit|deze)\s+([a-zà-ÿ]+(?:je|tje|pje|kje)|fles|potje|bak|beker|emmer|doos|kist|blik|vat|ton|pot|slang|kraan|auto|kar|bus|machine|apparaat|toestel)\b/i;

/** Stam zonder context die begint met "Het flesje …" zonder dat het flesje is geïntroduceerd. */
export function vaagObjectBegin(q: Vraag): string | null {
  if ((q.context ?? "").trim()) return null;
  if (q.figuur || q.figuurId || q.grafiek || q.schemaFiguur || q.pictogram || q.maatcilinder || q.tabel) return null;
  const m = q.stam.trim().match(VAAG_OBJECT);
  return m ? m[0] : null;
}

function repareerContext(q: Vraag, n: NakijkItem | undefined, issues: ItemIssue[]): void {
  let c = (q.context ?? "").trim();
  if (/ontstopper/i.test(c) && /kas/i.test(c)) {
    issues.push({ nummer: q.nummer, code: "context-onrealistisch", uitleg: "Ontstopper in de kas is geen realistische context." });
    c = "In het practicumlokaal staat een fles ontstopper.";
  }
  if (/kurkplug|waterbuis/i.test(c)) {
    issues.push({ nummer: q.nummer, code: "context-onrealistisch", uitleg: "Een kurkplug in een waterbuis is geen realistische context." });
    c = "Een kurk valt in een emmer water.";
  }
  // Losse stub als context ("pictogram", "Werkplaats") zegt niets: weg ermee.
  if (c && isStubContext(c)) {
    issues.push({ nummer: q.nummer, code: "context-loos", uitleg: `Context '${c}' is geen situatie.` });
    c = "";
  }
  q.context = c || undefined;
  const idx = sleutelIndex(q, n);
  const sleutel = idx >= 0 ? q.opties?.[idx]?.tekst ?? "" : "";
  if (sleutel.length >= 4 && q.context && q.context.toLowerCase().includes(sleutel.toLowerCase())) {
    issues.push({ nummer: q.nummer, code: "stam-verklapt", uitleg: "De context noemt het juiste antwoord." });
    q.context = q.context.replace(new RegExp(sleutel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "").replace(/\s{2,}/g, " ").trim();
  }
  if (q.context && !contextNodig(q)) {
    issues.push({ nummer: q.nummer, code: "context-loos", uitleg: "De context voegt niets toe aan de vraag." });
    q.context = undefined;
  }
  const kenmerk = (n?.modelantwoord ?? "").toLowerCase();
  if (/\btroebel/.test(q.stam.toLowerCase()) && /troebel|suspensie/.test(kenmerk) && /kenmerk|oplossing of een suspensie|suspensie/i.test(q.stam)) {
    issues.push({ nummer: q.nummer, code: "stam-verklapt", uitleg: "De stam noemt al het kenmerk dat de leerling moet geven." });
    q.stam = "Noem twee kenmerken van een suspensie.";
    q.context = undefined;
  }
}

function repareerVariatie(vragen: Vraag[], issues: ItemIssue[]): void {
  const aeres = vragen
    .map((q, i) => ({ i, q }))
    .filter(({ q }) => /aeres|leerbedrijf/i.test(`${q.context ?? ""} ${q.stam}`));
  if (aeres.length > 2) {
    for (const { q } of aeres.slice(2)) {
      issues.push({ nummer: q.nummer, code: "weinig-variatie", uitleg: "Aeres/leerbedrijf staat in te veel vragen." });
      if (q.context) q.context = q.context.replace(/\s*(op|van|bij)\s+(het\s+)?(leerbedrijf\s+)?aeres/gi, "").trim() || undefined;
      q.stam = q.stam.replace(/\s*(op|van|bij)\s+(het\s+)?(leerbedrijf\s+)?aeres/gi, "").trim();
    }
  }
  const flessen = vragen.map((q, i) => ({ i, q })).filter(({ q }) => /\bfles\b/i.test(`${q.context ?? ""} ${q.stam}`));
  const wissel = ["pot", "jerrycan", "monster", "bakje"];
  if (flessen.length > 3) {
    flessen.slice(3).forEach(({ q }, k) => {
      issues.push({ nummer: q.nummer, code: "weinig-variatie", uitleg: "Het woord fles komt te vaak terug." });
      const woord = wissel[k % wissel.length]!;
      if (q.context) q.context = q.context.replace(/\bfles\b/gi, woord);
      q.stam = q.stam.replace(/\bfles\b/gi, woord);
    });
  }
}

function repareerBoekgetallen(q: Vraag, n: NakijkItem | undefined, bron: string, issues: ItemIssue[]): void {
  const blob = `${q.stam} ${q.context ?? ""}`;
  const mv = vindMassaVolume(blob);
  const verboden = boekDichtheden(bron);
  if (mv && verboden.length && dichtBij(mv.massa / mv.volume, verboden)) {
    issues.push({
      nummer: q.nummer,
      code: "boek-uitkomst",
      uitleg: "De uitkomst is gelijk aan een voorbeeldantwoord uit de lesstof.",
    });
    let massa = mv.massa;
    let guard = 0;
    while (dichtBij(massa / mv.volume, verboden) && guard < 8) {
      massa += 6;
      guard += 1;
    }
    const ratio = massa / mv.volume;
    const nieuw = String(Math.round(massa));
    q.stam = q.stam.replace(new RegExp(`\\b${String(mv.massa).replace(".", "[.,]")}\\s*g\\b`), `${nieuw} g`);
    if (q.context) {
      q.context = q.context.replace(new RegExp(`\\b${String(mv.massa).replace(".", "[.,]")}\\s*g\\b`), `${nieuw} g`);
    }
    if (n) n.modelantwoord = `dichtheid = ${nieuw} / ${formatNl(mv.volume)} = ${formatNl(ratio)} g/cm³`;
  }
  const huidig = vindMassaVolume(`${q.stam} ${q.context ?? ""}`);
  const waarde = huidig ? huidig.massa / huidig.volume : null;
  if (/\brond af op ([eé]én|1) decimaal/i.test(q.stam) && (waarde === null || exactOpEenDecimaal(waarde))) {
    issues.push({ nummer: q.nummer, code: "afronden-exact", uitleg: "Afronden is gevraagd terwijl de uitkomst al exact is." });
    q.stam = q.stam.replace(/[,.]?\s*rond af op ([eé]én|1) decimaal[.]?/gi, "").replace(/\s{2,}/g, " ").trim();
    if (n) n.modelantwoord = n.modelantwoord.replace(/[,.]?\s*afgerond op ([eé]én|1) decimaal/gi, "").trim();
  }
}

function blobVan(q: Vraag): string {
  return `${q.stam} ${q.context ?? ""} ${(q.opties ?? []).map((o) => o.tekst).join(" ")}`.toLowerCase();
}

type Lek = { i: number; j: number; soort: string };

function vindLekken(vragen: Vraag[]): Lek[] {
  const out: Lek[] = [];
  for (let i = 0; i < vragen.length; i++) {
    for (let j = i + 1; j < vragen.length; j++) {
      const a = blobVan(vragen[i]!);
      const b = blobVan(vragen[j]!);
      if (/onderdompel/.test(a) && /onderdompel/.test(b)) out.push({ i, j, soort: "onderdompel" });
      else if (
        /lengte\s*[×x*]\s*breedte\s*[×x*]\s*hoogte/.test(a) &&
        /bereken/.test(b) &&
        /volume/.test(b)
      ) {
        out.push({ i, j, soort: "formule-volume" });
      } else if (/lengte\s*[×x*]\s*breedte\s*[×x*]\s*hoogte/.test(b) && /bereken/.test(a) && /volume/.test(a)) {
        out.push({ i, j, soort: "formule-volume" });
      } else if (/drijf/.test(a) && /dichtheid/.test(a) && /drijf|zink|zwev/.test(b) && /dichtheid/.test(b)) {
        out.push({ i, j, soort: "drijven" });
      } else if (
        (/wat is dichtheid|massa van 1/.test(a) && /bereken de dichtheid/.test(b)) ||
        (/wat is dichtheid|massa van 1/.test(b) && /bereken de dichtheid/.test(a))
      ) {
        out.push({ i, j, soort: "dichtheid-def" });
      } else if (/stofeigenschap/.test(a) && /stofeigenschap/.test(b)) {
        out.push({ i, j, soort: "stofeigenschap" });
      }
    }
  }
  return out;
}

const SJABLONEN: { stam: string; opties: string[]; key: number; merk: RegExp }[] = [
  {
    stam: "Welke eenheid past bij de massa van een vaste stof?",
    opties: ["gram", "newton", "seconde", "ampère"],
    key: 0,
    merk: /eenheid past bij de massa/,
  },
  {
    stam: "Welke eenheid past bij het volume van een vloeistof?",
    opties: ["milliliter", "newton", "graad Celsius", "ampère"],
    key: 0,
    merk: /eenheid past bij het volume/,
  },
  {
    stam: "Welk instrument meet de temperatuur van een vloeistof?",
    opties: ["thermometer", "weegschaal", "liniaal", "maatcilinder"],
    key: 0,
    merk: /instrument meet de temperatuur/,
  },
];

function isMcItem(q: Vraag): boolean {
  return q.type === "meerkeuze" || q.type === "juist-onjuist" || (q.opties?.length ?? 0) >= 2;
}

function repareerLekken(vragen: Vraag[], nakijk: NakijkItem[], issues: ItemIssue[]): void {
  const gebruikt = new Set<number>();
  for (const lek of vindLekken(vragen)) {
    const iMc = isMcItem(vragen[lek.i]!);
    const jMc = isMcItem(vragen[lek.j]!);
    let slachtoffer = lek.i;
    if (jMc && !iMc) slachtoffer = lek.j;
    else if (iMc && jMc) slachtoffer = lek.i;
    else slachtoffer = lek.i;
    if (gebruikt.has(slachtoffer)) continue;
    const q = vragen[slachtoffer]!;
    const sjabloon = SJABLONEN.find((s) => !vragen.some((v) => s.merk.test(v.stam.toLowerCase())));
    if (!sjabloon) continue;
    issues.push({
      nummer: q.nummer,
      code: "lek-tussen-vragen",
      uitleg: `Vraag overlapt met een andere vraag (${lek.soort}).`,
    });
    q.type = "meerkeuze";
    q.punten = 1;
    q.context = undefined;
    q.stam = sjabloon.stam;
    q.opties = sjabloon.opties.map((tekst, k) => ({ letter: "ABCD"[k] ?? "A", tekst }));
    q.pictogram = undefined;
    q.maatcilinder = undefined;
    const n = nakijkVan(nakijk, q, slachtoffer);
    if (n) n.modelantwoord = `${"ABCD"[sjabloon.key]}. ${sjabloon.opties[sjabloon.key]}`;
    gebruikt.add(slachtoffer);
  }
}

function verzamel(vragen: Vraag[], nakijk: NakijkItem[], bron: string): ItemIssue[] {
  const issues: ItemIssue[] = [];
  vragen.forEach((q, i) => {
    const n = nakijkVan(nakijk, q, i);
    const blob = `${q.stam} ${q.context ?? ""}`;
    if (bevatSchoolnaam(`${blob} ${(q.opties ?? []).map((o) => o.tekst).join(" ")}`)) {
      issues.push({ nummer: q.nummer, code: "schoolnaam", uitleg: "Noemt een school of leerbedrijf van school; gebruik een verzonnen bedrijf of alledaagse situatie." });
    }
    const los = onopgeloste(q.stam, q.context ?? "");
    const losCtx = q.context ? onopgeloste(q.context) : [];
    const onduidelijk = [...losCtx, ...los].filter((x) => !(/opstelling|schakeling/i.test(x) && (q.figuur || q.grafiek || q.schemaFiguur)));
    if (onduidelijk.length) {
      issues.push({ nummer: q.nummer, code: "vage-verwijzing", uitleg: `Verwijst naar '${onduidelijk[0]}' zonder dat die eerder is genoemd; noem concreet welk ding/apparaat het is.` });
    }
    const vaag = vaagObjectBegin(q);
    if (vaag && !onduidelijk.length) {
      issues.push({ nummer: q.nummer, code: "vage-verwijzing", uitleg: `Begint met '${vaag}' zonder te zeggen welk ding en in welke situatie; geef een korte, concrete context.` });
    }
    if (isVraagzinStelling(q)) {
      issues.push({ nummer: q.nummer, code: "onhelder", uitleg: "Juist/onjuist met een vraagzin; maak er een stelling van die juist of onjuist is." });
    }
    const tekort = tekortPunten(q);
    if (tekort) issues.push({ nummer: q.nummer, code: "rubriek", uitleg: tekort });
    const figRef = figuurVerwijzingenZonderFiguur(q, n);
    if (figRef.length) {
      issues.push({ nummer: q.nummer, code: "figuur-ontbreekt", uitleg: `Verwijst naar '${figRef[0]}' maar er staat geen figuur/tabel bij; maak de vraag zelfstandig (gegevens in de tekst).` });
    }
    if (/volgens de lesstof|uit de lesstof|zoals in het boek/i.test(blob)) {
      issues.push({ nummer: q.nummer, code: "lesstof-frase", uitleg: "Formulering 'volgens de lesstof' of 'zoals in het boek'." });
    }
    if (/\bhij\b/i.test(blob) && /leerling/i.test(blob)) {
      issues.push({ nummer: q.nummer, code: "niet-neutraal", uitleg: "Gebruik 'de leerling', niet 'hij'." });
    }
    if (q.opties?.length && /\bveilig/.test(q.stam.toLowerCase())) {
      const idx = sleutelIndex(q, n);
      if (idx >= 0 && optieOnveilig(q.opties[idx]!.tekst)) {
        issues.push({ nummer: q.nummer, code: "onveilig", uitleg: "De sleutel beloont onveilig handelen." });
      }
    }
    if (q.opties && q.opties.length >= 2) {
      const rollen = q.opties.map((o) => familieVan(o.tekst));
      for (let a = 0; a < rollen.length; a++) {
        for (let b = a + 1; b < rollen.length; b++) {
          const ra = rollen[a];
          const rb = rollen[b];
          if (ra && rb && ra.wortel === rb.wortel && ra.rol !== rb.rol) {
            issues.push({ nummer: q.nummer, code: "dubbel-juist", uitleg: "Twee opties kunnen allebei kloppen." });
          }
        }
      }
      if (/hoort niet bij/i.test(q.stam) && /stofeigenschap/i.test(q.stam) && q.opties.every((o) => isStof(o.tekst))) {
        const idx = sleutelIndex(q, n);
        if (idx >= 0 && isStof(q.opties[idx]!.tekst)) {
          issues.push({ nummer: q.nummer, code: "dubbel-juist", uitleg: "Geen enkele optie valt buiten de stofeigenschappen." });
        }
      }
    }
    const idxSleutel = sleutelIndex(q, n);
    const sleutelTekst = idxSleutel >= 0 ? (q.opties?.[idxSleutel]?.tekst ?? "").trim() : "";
    if (sleutelTekst.length >= 4 && new RegExp(`\\b${escapeRe(sleutelTekst)}\\b`, "i").test(q.stam)) {
      issues.push({ nummer: q.nummer, code: "stam-verklapt", uitleg: "De stam noemt het juiste antwoord." });
    }
    const uit = q.stam.match(/in plaats van ([a-zà-ÿ-]+)/i)?.[1]?.toLowerCase();
    if (uit && q.opties?.some((o) => o.tekst.toLowerCase().trim() === uit)) {
      issues.push({ nummer: q.nummer, code: "afleider-uitgesloten", uitleg: `Optie herhaalt '${uit}'.` });
    }
    const mv = vindMassaVolume(blob);
    if (mv && dichtBij(mv.massa / mv.volume, boekDichtheden(bron))) {
      issues.push({ nummer: q.nummer, code: "boek-uitkomst", uitleg: "Uitkomst gelijk aan een boekvoorbeeld." });
    }
    if (/\brond af op ([eé]én|1) decimaal/i.test(q.stam)) {
      const waarde = mv ? mv.massa / mv.volume : null;
      if (waarde === null || exactOpEenDecimaal(waarde)) {
        issues.push({ nummer: q.nummer, code: "afronden-exact", uitleg: "Afronden terwijl de uitkomst exact is." });
      }
    }
  });
  for (const lek of vindLekken(vragen)) {
    issues.push({
      nummer: vragen[lek.i]!.nummer,
      code: "lek-tussen-vragen",
      uitleg: `Overlapt met vraag ${vragen[lek.j]!.nummer} (${lek.soort}).`,
    });
  }
  return issues;
}

/**
 * Heuristieken + deterministische reparatie. De LLM-ronde zit in afwerken.ts.
 */
export function repareerItemsDeterministisch(
  vragen: Vraag[],
  nakijkmodel: NakijkItem[],
  bron: string,
): { vragen: Vraag[]; nakijkmodel: NakijkItem[]; issues: ItemIssue[] } {
  const nextV = cloneVragen(vragen);
  const nextN = cloneNakijk(nakijkmodel);
  const gezien: ItemIssue[] = [];
  pasTaalToe(nextV);
  nextV.forEach((q, i) => {
    const n = nakijkVan(nextN, q, i);
    if (repareerSchoolnamen(q, n)) gezien.push({ nummer: q.nummer, code: "schoolnaam", uitleg: "Schoolnaam vervangen door een verzonnen bedrijf." });
    repareerOnveilig(q, n, gezien);
    repareerStofTegenstelling(q, n, gezien);
    repareerHierarchie(q, n, gezien);
    repareerUitgesloten(q, gezien);
    repareerStamVerklapt(q, n, gezien);
    repareerContext(q, n, gezien);
    repareerBoekgetallen(q, n, bron, gezien);
  });
  repareerVariatie(nextV, gezien);
  repareerLekken(nextV, nextN, gezien);
  return { vragen: nextV, nakijkmodel: nextN, issues: verzamel(nextV, nextN, bron) };
}

export function detecteerItemIssues(vragen: Vraag[], nakijkmodel: NakijkItem[], bron: string): ItemIssue[] {
  return verzamel(vragen, nakijkmodel, bron);
}
