/**
 * Plan-first, stap 2: deterministische controle en herstel van het bouwplan (geen modelaanroep).
 * Controleert aantallen, paragraafdekking (eerlijke diepgang), unieke personen/situaties/begrippen, weggevers,
 * punten en RTTI-mix, en herstelt wat zonder model kan (reserves inwisselen, namen vervangen, punten
 * bijstellen, volgorde). Wat code niet kan herstellen, gaat als aanwijzing ("let") mee naar de schrijver.
 */
import type { Rtti } from "./types";
import { VOORNAMEN } from "./config.ts";
import { GESLOTEN, contextBlokkenDoel, type Bouwplan, type PlanItem, type PlanQuota } from "./bouwplan.ts";

export interface PlanIssue {
  code: "aantal" | "dekking" | "diepgang" | "persoon" | "context" | "begrip" | "weggever" | "punten" | "rtti" | "vorm" | "school";
  detail: string;
  ernst: "hard" | "zacht";
  hersteld: boolean;
}

const STOP = new Set("de het een en of van in op met voor naar bij aan uit door over als dat die dit deze is zijn wordt worden je jij hij zij ze we wat welke waarom hoe wie om te tot niet geen wel ook nog dan maar want".split(" "));

/** Inhoudswoorden, grof gestamd (eerste 5 letters) zodat "fietser/fietsen" samenvallen. */
export function sleutelwoorden(t: string | undefined): string[] {
  return [
    ...new Set(
      (t ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4 && !STOP.has(w))
        .map((w) => w.slice(0, 5)),
    ),
  ];
}

/** Onderwerpwoorden die in veel planregels staan (bijv. "kracht", "druk") zeggen niets over dubbeling. */
function generiekeWoorden(items: PlanItem[]): Set<string> {
  const tel = new Map<string, number>();
  for (const it of items) for (const w of sleutelwoorden(`${it.begrip} ${it.kern}`)) tel.set(w, (tel.get(w) ?? 0) + 1);
  return new Set([...tel.entries()].filter(([, n]) => n >= 3).map(([w]) => w));
}

let GENERIEK = new Set<string>();

/** Strenger: woorden ≥ 6 letters, gestamd op 6 (voor weggevers: "groter" ≠ "grote"). */
function sleutelwoordenLang(t: string | undefined): string[] {
  return [
    ...new Set(
      (t ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 6 && !STOP.has(w))
        .map((w) => w.slice(0, 6)),
    ),
  ];
}

function lijkt(a: string, b: string, drempel: number): boolean {
  const x = sleutelwoorden(a).filter((w) => !GENERIEK.has(w));
  const y = new Set(sleutelwoorden(b).filter((w) => !GENERIEK.has(w)));
  if (!x.length || !y.size) return false;
  const gedeeld = x.filter((w) => y.has(w)).length;
  return gedeeld / Math.min(x.length, y.size) >= drempel && gedeeld >= 1;
}

const isGesloten = (it: PlanItem) => GESLOTEN.includes(it.vorm);
const zelfdeGroep = (a: PlanItem, b: PlanItem) => Boolean(a.groep && a.groep === b.groep);
/** Aanwijzing voor de schrijver; hooguit 3 per vraag (te veel aanwijzingen maken de opdracht onduidelijk). */
const notitie = (it: PlanItem, tekst: string) => {
  if ((it.let?.length ?? 0) >= 3) return;
  it.let = [...new Set([...(it.let ?? []), tekst])];
};
const SCHOOL_RE = /\b[A-Z][\w-]*(?:college|lyceum|school)\b|\b(?:college|lyceum|scholengemeenschap|mavo|havo|vwo)\b/i;
const TEKEN_RE = /teken|schets|pijl|grafiek|diagram|\blijn\b|schaal|\bgeef .*aan\b|\baangeven\b|\bkleur|\bomcirkel/i;

const TELWOORD: Record<string, number> = { twee: 2, drie: 3, "2": 2, "3": 3 };
const GEEN_DEEL = /^(keer|maal|punten?|meter|seconden?|minuten?|uur|newton|kilo|gram|cm|mm|km|kg)$/;
/** Aantal gevraagde onderdelen in een kort-vraag ("noem twee …", "bron, tussenstof en ontvanger"); 0 = één antwoord. */
export function deelAantal(kern: string): number {
  const t = kern.toLowerCase();
  for (const m of t.matchAll(/\b(twee|drie|2|3)\s+([\p{L}]{3,})/gu)) if (!GEEN_DEEL.test(m[2]!)) return TELWOORD[m[1]!]!;
  const lijst = t.match(/[\p{L}-]+(?:,\s*[\p{L}-]+)+,?\s+en\s+[\p{L}-]+/u);
  return lijst ? Math.min(3, lijst[0].split(/,\s*|\s+en\s+/).filter(Boolean).length) : 0;
}

/** Paragraafcode normaliseren naar een bekende code ("§11.1 Voortstuwen" → "11.1"). */
function normPar(par: string, codes: string[]): string {
  const m = par.match(/\d{1,2}\.\d{1,2}/);
  const c = m ? `${Number(m[0].split(".")[0])}.${Number(m[0].split(".")[1])}` : par;
  return !codes.length || codes.includes(c) ? c : codes[0]!;
}

export function rttiPuntenVan(items: PlanItem[]): Record<Rtti, number> {
  const r: Record<Rtti, number> = { R: 0, T1: 0, T2: 0, I: 0 };
  for (const it of items) r[it.rtti] += it.punten;
  return r;
}

/** Controleer en herstel. Puur: het invoerplan wordt niet aangepast. */
export function herstelBouwplan(invoer: Bouwplan, q: PlanQuota): { plan: Bouwplan; issues: PlanIssue[] } {
  const issues: PlanIssue[] = [];
  const meld = (code: PlanIssue["code"], detail: string, ernst: PlanIssue["ernst"], hersteld: boolean) => issues.push({ code, detail, ernst, hersteld });
  const codes = q.paragrafen.map((p) => p.code);
  const items: PlanItem[] = invoer.items.map((it) => ({ ...it, par: normPar(it.par, codes), let: it.let ? [...it.let] : undefined }));
  const reserve: PlanItem[] = invoer.reserve.map((it) => ({ ...it, par: normPar(it.par, codes) }));
  GENERIEK = generiekeWoorden([...items, ...reserve]);
  const telPar = (c: string) => items.filter((it) => it.par === c).length;
  const quotaVan = (c: string) => q.paragrafen.find((p) => p.code === c)?.aantal ?? 0;
  const overschot = () =>
    [...codes].sort((a, b) => telPar(b) - quotaVan(b) - (telPar(a) - quotaVan(a)))[0];

  // 1. Aantal vragen
  if (items.length > q.aantal) {
    while (items.length > q.aantal) {
      const c = overschot();
      // Te veel gesloten vragen? Dan eerst een gesloten vraag naar de reserve (de open vragen staan achteraan).
      const teVeelGesloten = items.filter(isGesloten).length > q.vorm.mc + q.vorm.jn + 1;
      const kandidaatIdx = items.map((it, i) => ({ it, i })).filter(({ it }) => (!c || it.par === c) && (!teVeelGesloten || isGesloten(it))).map(({ i }) => i);
      const idx = kandidaatIdx.length ? kandidaatIdx[kandidaatIdx.length - 1]! : c ? items.map((it) => it.par).lastIndexOf(c) : items.length - 1;
      reserve.unshift(items.splice(idx >= 0 ? idx : items.length - 1, 1)[0]!);
    }
    meld("aantal", `te veel vragen in het plan → ${q.aantal}`, "zacht", true);
  } else if (items.length < q.aantal) {
    const voor = items.length;
    while (items.length < q.aantal && reserve.length) {
      const tekort = codes.find((c) => telPar(c) < quotaVan(c));
      const ri = Math.max(0, reserve.findIndex((r) => r.par === tekort));
      items.push(reserve.splice(ri, 1)[0]!);
    }
    meld("aantal", `${voor} vragen in het plan, aangevuld tot ${items.length} uit de reserve`, items.length < q.aantal ? "hard" : "zacht", items.length >= q.aantal);
  }

  // 2. Dekking en eerlijke diepgang: lege paragraaf = hard; ver onder quota = zacht.
  for (const p of q.paragrafen) {
    const tekort = (n: number) => (n === 0 ? 1 : n < p.aantal - 1 ? p.aantal - 1 - n : 0);
    let nodig = tekort(telPar(p.code));
    const wasLeeg = telPar(p.code) === 0;
    while (nodig > 0) {
      const van = overschot();
      if (!van || van === p.code || telPar(van) <= Math.max(1, quotaVan(van) - 1)) break;
      const vi = items.map((it) => it.par).lastIndexOf(van);
      const ri = reserve.findIndex((r) => r.par === p.code);
      if (ri >= 0) {
        items[vi] = { ...reserve.splice(ri, 1)[0]! };
      } else {
        const oud = items[vi]!;
        items[vi] = {
          ...oud,
          par: p.code,
          begrip: `(kies een kernbegrip uit ${p.code} ${p.titel})`,
          context: "",
          persoon: undefined,
          groep: undefined,
          kern: `vraag over ${p.code} ${p.titel} (zelfde vorm, RTTI en punten)`,
          antwoord: "",
          let: [`nieuw te bedenken vraag over ${p.code} ${p.titel}; ander begrip en andere situatie dan de rest van het plan`],
        };
      }
      nodig = tekort(telPar(p.code));
    }
    const n = telPar(p.code);
    if (wasLeeg) meld("dekking", `${p.code} ${p.titel} had geen vraag${n ? " → aangevuld" : ""}`, "hard", n > 0);
    else if (n < p.aantal - 1) meld("diepgang", `${p.code} ${p.titel}: ${n} van ${p.aantal} vragen`, "zacht", false);
  }

  // 3. Vormquotum: geen jn als het quotum 0 is (→ mc), hooguit quotum+1 gesloten vragen (overschot → kort open).
  if (!q.vorm.jn) {
    const jn = items.filter((it) => it.vorm === "jn");
    for (const it of jn) it.vorm = "mc";
    if (jn.length) meld("vorm", `${jn.length} juist/onjuist zonder quotum → meerkeuze`, "zacht", true);
  }
  const maxGesloten = q.vorm.mc + q.vorm.jn + 1;
  const gesloten = items.filter(isGesloten);
  if (gesloten.length > maxGesloten) {
    // Eerst de gesloten vragen die het meest toepassen (T2/T1), daarna de laatste.
    const rang: Record<Rtti, number> = { I: 0, T2: 1, T1: 2, R: 3 };
    const om = [...gesloten].sort((a, b) => rang[a.rtti] - rang[b.rtti] || items.indexOf(b) - items.indexOf(a)).slice(0, gesloten.length - maxGesloten);
    for (const it of om) {
      it.vorm = "kort";
      notitie(it, "korte open vraag (geen meerkeuze): de leerling formuleert het antwoord zelf");
    }
    meld("vorm", `${gesloten.length} gesloten vragen (max ${maxGesloten}) → ${om.length} korte open vragen`, "zacht", true);
  }
  // "teken" zonder tekenopdracht in de bedoeling is een verkeerd label → kort open. Echte tekenvragen blijven.
  for (const it of items) {
    if (it.vorm === "teken" && !TEKEN_RE.test(`${it.kern} ${it.begrip}`)) {
      it.vorm = "kort";
      meld("vorm", `"${it.begrip}": "tekenen" zonder tekenopdracht → kort open`, "zacht", true);
    } else if (it.vorm === "teken") notitie(it, "tekenvraag: de leerling tekent zelf (pijl op schaal, lijn in een diagram of schema); alle gegevens in de tekst, geen plaatje");
  }
  // Open vormen op quotum: eerst omlabelen wat het al is (kort met een uitkomst-getal → reken, kort T2/I →
  // uitleg), daarna reservevragen van die vorm inwisselen tegen een losse kort-vraag uit dezelfde paragraaf.
  const tel = (v: PlanItem["vorm"]) => items.filter((it) => it.vorm === v).length;
  const REKEN_RE = /\bbereken|\d\s*(?:n|kg|m|s|pa|hz|db|nm|n\/cm²?|m\/s|cm|%)\b/i;
  for (const it of items) if (tel("reken") < q.vorm.reken && it.vorm === "kort" && REKEN_RE.test(`${it.kern} ${it.antwoord} ${it.begrip}`)) {
    it.vorm = "reken";
    it.punten = Math.max(2, it.punten);
    meld("vorm", `"${it.begrip}": rekenvraag → berekening`, "zacht", true);
  }
  for (const it of items) if (tel("uitleg") < q.vorm.uitleg && it.vorm === "kort" && (it.rtti === "T2" || it.rtti === "I")) {
    it.vorm = "uitleg";
    it.punten = Math.max(2, it.punten);
    meld("vorm", `"${it.begrip}": redeneervraag → uitleggen`, "zacht", true);
  }
  for (const v of ["reken", "teken", "uitleg"] as const) {
    while (tel(v) < q.vorm[v]) {
      const ri = reserve.findIndex((r) => r.vorm === v && items.some((it) => it.par === r.par && it.vorm === "kort" && !it.groep));
      if (ri < 0) break;
      const r = reserve.splice(ri, 1)[0]!;
      const ii = items.findIndex((it) => it.par === r.par && it.vorm === "kort" && !it.groep);
      reserve.push(items[ii]!);
      items[ii] = { ...r };
      meld("vorm", `${v}: reservevraag "${r.begrip}" ingewisseld`, "zacht", true);
    }
  }
  // Punten: gesloten = 1; open 1–4 (rekenen ≥ 2); een vraag naar meerdere onderdelen ≥ 1 punt per onderdeel (max 3).
  const minPunten = new Map<PlanItem, number>();
  for (const it of items) {
    if (isGesloten(it)) it.punten = 1;
    else it.punten = Math.max(it.vorm === "reken" ? 2 : 1, Math.min(4, Math.round(it.punten) || 2));
    const delen = it.vorm === "kort" || it.vorm === "invul" ? deelAantal(it.kern) : 0;
    if (delen > it.punten) {
      meld("punten", `"${it.begrip}": ${delen} onderdelen → ${delen} punten (was ${it.punten})`, "zacht", true);
      it.punten = delen;
    }
    if (delen > 1) minPunten.set(it, delen);
  }

  // 4. Personen: alleen namen uit de lijst, elke naam hooguit één vraag of één groep.
  const gebruikt = new Map<string, string>(); // naam → groep/itemsleutel
  const vrij = () => VOORNAMEN.find((n) => !gebruikt.has(n) && !items.some((it) => it.persoon === n));
  for (const it of items) {
    if (!it.persoon) continue;
    const sleutel = it.groep ?? `#${it.n}-${it.begrip}`;
    const naam = it.persoon.split(/\s+/)[0]!;
    const inLijst = (VOORNAMEN as readonly string[]).includes(naam);
    const dubbel = gebruikt.has(naam) && gebruikt.get(naam) !== sleutel;
    if (!inLijst || dubbel) {
      const nieuw = (it.groep && [...gebruikt.entries()].find(([, s]) => s === sleutel)?.[0]) || vrij();
      if (nieuw) {
        const oud = it.persoon;
        it.persoon = nieuw;
        it.context = it.context.replaceAll(oud, nieuw);
        it.kern = it.kern.replaceAll(oud, nieuw);
        meld("persoon", `${oud} ${dubbel ? "dubbel" : "niet in de namenlijst"} → ${nieuw}`, "zacht", true);
      }
    }
    gebruikt.set(it.persoon!, sleutel);
  }

  // 5. Situaties en begrippen uniek (buiten dezelfde groep). Eerst reserve inwisselen, anders een aanwijzing.
  const wissel = (i: number, waarom: (r: PlanItem) => boolean): boolean => {
    const ri = reserve.findIndex((r) => r.par === items[i]!.par && isGesloten(r) === isGesloten(items[i]!) && waarom(r));
    if (ri < 0) return false;
    items[i] = { ...reserve.splice(ri, 1)[0]! };
    return true;
  };
  for (let i = 0; i < items.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = items[j]!;
      const b = items[i]!;
      if (zelfdeGroep(a, b) || a.begrip.startsWith("(") || b.begrip.startsWith("(")) continue;
      if (a.context && b.context && lijkt(a.context, b.context, 0.5)) {
        const ok = wissel(i, (r) => !items.some((x) => x.context && lijkt(x.context, r.context, 0.5)));
        if (!ok) {
          notitie(items[i]!, `kies een duidelijk andere situatie dan "${a.context}" (die staat al in de toets)`);
          items[i]!.context = "";
        }
        meld("context", `situatie "${b.context}" lijkt op "${a.context}"`, "zacht", true);
      } else if (lijkt(a.begrip, b.begrip, 0.5)) {
        const ok = wissel(i, (r) => !items.some((x) => lijkt(x.begrip, r.begrip, 0.5)));
        if (!ok) notitie(items[i]!, `begrip "${a.begrip}" komt al aan bod: vraag vanuit een andere invalshoek (toepassen/verklaren i.p.v. herkennen)`);
        meld("begrip", `begrip "${b.begrip}" herhaalt "${a.begrip}"`, "zacht", true);
      }
    }
  }

  // 5b. Contextblokken zoals in Nicks schooltoetsen: minstens het doel aan groepen van 2–3 open vragen bij één
  // situatie (eerst berekening/toepassing, dan redeneren). Ontbreken ze, dan koppelen we losse open vragen
  // uit dezelfde paragraaf. Groepstitels met maar één vraag vervallen.
  for (const it of items) if (it.groep && items.filter((x) => x.groep === it.groep).length < 2) it.groep = undefined;
  const doelBlokken = contextBlokkenDoel(q);
  const groepen = () => new Set(items.filter((it) => it.groep).map((it) => it.groep!));
  if (groepen().size < doelBlokken) {
    let gemaakt = 0;
    const los = (it: PlanItem) => !it.groep && !isGesloten(it) && !it.begrip.startsWith("(");
    for (const code of [...q.paragrafen].sort((a, b) => b.aantal - a.aantal).map((p) => p.code)) {
      if (groepen().size >= doelBlokken) break;
      const kand = items.filter((it) => it.par === code && los(it));
      const eerste = kand.find((it) => it.vorm === "reken") ?? kand.find((it) => it.vorm === "kort" || it.vorm === "teken" || it.vorm === "invul");
      if (!eerste) continue;
      const rest = kand.filter((it) => it !== eerste);
      const verwant = (it: PlanItem) => lijkt(`${it.begrip} ${it.kern}`, `${eerste.begrip} ${eerste.kern} ${eerste.context}`, 0.3);
      const tweede = rest.find((it) => verwant(it) && (it.vorm === "uitleg" || it.rtti === "T2" || it.rtti === "I")) ?? rest.find(verwant) ?? rest.find((it) => it.vorm === "uitleg" || it.rtti === "T2" || it.rtti === "I") ?? rest[0];
      if (!tweede) continue;
      if (!verwant(tweede)) {
        // Geen verwante vraag: deze vraag wordt een redeneer-vervolg op de situatie van de eerste (zelfde
        // paragraaf, punten en RTTI blijven); het oude begrip vervalt (meestal een dubbeling).
        tweede.begrip = `${eerste.begrip}: redeneren`;
        tweede.kern = `leg uit of voorspel iets in dezelfde situatie, voortbouwend op de vorige vraag (${eerste.begrip})`;
        tweede.antwoord = "";
      }
      const basis = (eerste.context || tweede.context || eerste.begrip).replace(/[.:;]+$/, "").slice(0, 40);
      let titel = basis.charAt(0).toUpperCase() + basis.slice(1);
      if (groepen().has(titel)) titel = `${titel} (${code})`;
      eerste.groep = tweede.groep = titel;
      const [ie, it2] = [items.indexOf(eerste), items.indexOf(tweede)];
      if (it2 < ie) [items[ie], items[it2]] = [tweede, eerste];
      if (!eerste.context) {
        eerste.context = tweede.context;
        if (!eerste.context) notitie(eerste, "eerste vraag van een contextblok: begin met een concrete situatie met gegevens");
      }
      tweede.context = "";
      tweede.persoon = eerste.persoon;
      if (tweede.vorm === "kort" && tweede.rtti !== "R") tweede.vorm = "uitleg";
      notitie(tweede, `vervolgvraag in de situatie van "${titel}" (de vraag ervoor): bouw voort op die gegevens of uitkomst en laat de leerling redeneren`);
      gemaakt++;
    }
    meld("context", `${groepen().size} contextblokken (doel ${doelBlokken})${gemaakt ? `, ${gemaakt} gemaakt uit losse vragen` : ""}`, "zacht", groepen().size >= doelBlokken);
  }

  // 6. Weggevers: het verwachte antwoord van een vraag mag niet in de situatie/vraag van een andere staan.
  const woorden6 = (t: string) => sleutelwoordenLang(t).filter((w) => !GENERIEK.has(w.slice(0, 5)));
  for (const a of items) {
    const sleutels = woorden6(a.antwoord);
    if (!sleutels.length) continue;
    for (const b of items) {
      if (a === b || zelfdeGroep(a, b)) continue;
      const tekst = new Set(woorden6(`${b.context} ${b.kern}`));
      const hit = sleutels.filter((w) => tekst.has(w));
      if (hit.length && hit.length / sleutels.length >= 0.5) {
        notitie(b, `noem "${a.antwoord}" niet in de vraagtekst (dat is het antwoord op de vraag over "${a.begrip}")`);
        meld("weggever", `"${b.begrip}" verklapt het antwoord van "${a.begrip}"`, "zacht", true);
      }
    }
  }

  // 7. School(namen) uit situaties.
  for (const it of items) {
    if (SCHOOL_RE.test(`${it.context} ${it.kern}`)) {
      it.context = it.context.replace(SCHOOL_RE, "").trim();
      notitie(it, "noem geen school of schoolnaam");
      meld("school", `schoolnaam in "${it.begrip}"`, "hard", true);
    }
  }

  // 8. RTTI: minstens één I-vraag als het doel dat vraagt; daarna punten op het doel brengen.
  if (q.rttiPunten.I > 0 && !items.some((it) => it.rtti === "I")) {
    const kandidaat = items.find((it) => !isGesloten(it) && it.rtti === "T2" && (it.vorm === "uitleg" || it.vorm === "kort")) ?? items.find((it) => !isGesloten(it) && it.rtti === "T2");
    if (kandidaat) {
      kandidaat.rtti = "I";
      kandidaat.punten = Math.max(2, kandidaat.punten);
      notitie(kandidaat, "I-vraag: nieuwe, onbekende situatie waarin de leerling zelf een redenering opbouwt (\"Beredeneer …\", \"Voorspel … en leg uit\")");
      meld("rtti", `geen I-vraag → "${kandidaat.begrip}" wordt I`, "zacht", true);
    }
  }
  const verschil = q.punten - items.reduce((s, it) => s + it.punten, 0);
  if (verschil !== 0) {
    const rang: Record<Rtti, number> = { I: 0, T2: 1, T1: 2, R: 3 };
    const open = items.filter((it) => !isGesloten(it));
    let rest = verschil;
    const kandidaten = (plus: boolean) =>
      open
        .filter((it) => (plus ? it.punten < (it.vorm === "reken" || it.rtti !== "R" ? 4 : 2) : it.punten > Math.max(it.vorm === "reken" ? 2 : 1, minPunten.get(it) ?? 1)))
        .sort((a, b) => {
          const meerstaps = (x: PlanItem) => (x.vorm === "reken" || x.vorm === "uitleg" ? 0 : 1);
          return (plus ? meerstaps(a) - meerstaps(b) || rang[a.rtti] - rang[b.rtti] : rang[b.rtti] - rang[a.rtti] || meerstaps(b) - meerstaps(a)) || (plus ? a.punten - b.punten : b.punten - a.punten);
        });
    for (let ronde = 0; rest !== 0 && ronde < 3; ronde++) {
      for (const it of kandidaten(rest > 0)) {
        if (rest === 0) break;
        it.punten += rest > 0 ? 1 : -1;
        rest += rest > 0 ? -1 : 1;
      }
    }
    // Nog steeds te weinig (plan vol gesloten vragen of alles op het maximum): gesloten vragen boven R
    // worden korte open vragen van 2 punten. Te veel: open R-vragen worden mc. Liever iets andere vormmix
    // dan terug naar de oude route.
    for (const it of [...items].filter((x) => (rest > 0 ? isGesloten(x) : !isGesloten(x) && x.rtti === "R" && x.vorm !== "reken" && !minPunten.has(x))).sort((a, b) => (rest > 0 ? rang[a.rtti] - rang[b.rtti] : b.punten - a.punten))) {
      if (rest === 0) break;
      if (rest > 0) {
        it.vorm = "kort";
        it.punten = Math.min(1 + rest, 2);
        rest -= it.punten - 1;
      } else {
        if (items.filter(isGesloten).length >= maxGesloten) break;
        rest += it.punten - 1;
        it.vorm = "mc";
        it.punten = 1;
      }
    }
    meld("punten", `plan had ${q.punten - verschil} punten → ${q.punten - rest} (doel ${q.punten})`, Math.abs(rest) > 2 ? "hard" : "zacht", Math.abs(rest) <= 2);
  }
  const r = rttiPuntenVan(items);
  const tot = Math.max(1, q.punten);
  const afw = (["R", "T1", "T2", "I"] as Rtti[]).map((l) => Math.abs(r[l] - q.rttiPunten[l]) / tot);
  if (Math.max(...afw) > 0.12) meld("rtti", `RTTI-punten R ${r.R}/T1 ${r.T1}/T2 ${r.T2}/I ${r.I} vs doel ${q.rttiPunten.R}/${q.rttiPunten.T1}/${q.rttiPunten.T2}/${q.rttiPunten.I}`, "zacht", false);

  // 9. Volgorde: gesloten eerst, groepen aaneen; daarna doornummeren.
  const eerste = new Map<string, number>();
  items.forEach((it, i) => {
    if (it.groep && !eerste.has(it.groep)) eerste.set(it.groep, i);
  });
  // Een groep telt als gesloten alleen als al zijn vragen gesloten zijn; anders staat de hele groep bij de open vragen.
  const klasse = (it: PlanItem) => (it.groep ? Number(items.some((x) => x.groep === it.groep && !isGesloten(x))) : Number(!isGesloten(it)));
  const geordend = items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => klasse(a.it) - klasse(b.it) || (a.it.groep ? eerste.get(a.it.groep)! : a.i) - (b.it.groep ? eerste.get(b.it.groep)! : b.i) || a.i - b.i)
    .map(({ it }, i) => ({ ...it, n: i + 1 }));
  return { plan: { versie: 1, items: geordend, reserve: reserve.map((it, i) => ({ ...it, n: geordend.length + i + 1 })) }, issues };
}

/** Harde problemen die na herstel overblijven (dan valt de app terug op de oude route). */
export function openHard(issues: PlanIssue[]): PlanIssue[] {
  return issues.filter((i) => i.ernst === "hard" && !i.hersteld);
}
