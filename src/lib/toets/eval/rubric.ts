/**
 * Vaste beoordelingsrubriek voor de offline eval (13 punten uit de r236-review van de Krachten-toets).
 * Zoveel mogelijk in code gescoord, zodat twee runs eerlijk te vergelijken zijn; een optionele
 * LLM-rechter (vaste prompt, grok-4.5, temperatuur 0) vult de inhoudelijke punten (rekenen,
 * weggevers, contexten, afleiders, realisme) aan. Wijzig je de rubriek: verhoog RUBRIEK_VERSIE.
 *
 * Go-live-poort: cijfer ≥ baseline én alle harde criteria 100 %.
 */
import { extractParagrafen, paragraafDekking } from "../leerdoelen.ts";
import { rttiDoelVoor } from "../config.ts";
import type { GegenereerdeToets, NakijkItem, RttiVerdeling, Vraag } from "../types";

export const RUBRIEK_VERSIE = "2026-10-01.3";

export interface EvalInput {
  titel?: string;
  leerjaar: number;
  leerweg: string;
  moeilijkheid?: string;
  duurMinuten: number;
  doelPunten: number;
  aantalVragen: number;
  rttiDoel?: RttiVerdeling;
  rttiHandmatig?: boolean;
  bronmateriaal: string;
  antwoordenmateriaal?: string;
}

export interface Criterium {
  punt: number;
  id: string;
  naam: string;
  /** 0–1 */
  score: number;
  bron: "code" | "rechter" | "code+rechter";
  detail: string;
}

export interface HardCriterium {
  id: string;
  naam: string;
  ok: boolean;
  detail: string;
}

export interface RechterOordeel {
  versie: string;
  /** Per rubriekpunt 0–2. */
  punten: Record<string, { score: number; opmerking?: string }>;
  cijfer?: number;
  topProblemen?: string[];
}

export interface Scorekaart {
  rubriekVersie: string;
  criteria: Criterium[];
  hard: HardCriterium[];
  hardOk: boolean;
  /** 1–10, gemiddelde van de 13 punten. */
  cijfer: number;
  feiten: Record<string, number | string>;
}

// ── hulpjes ────────────────────────────────────────────────────────────────────────────────────
const STOP = new Set(
  "de het een en of van in op aan met voor door bij naar als dan dat die dit deze zijn is was wordt worden heeft hebben om uit over onder tot ook niet geen wel je jij hij zij ze we wij hoe wat welke waarom waar wie er nog meer minder groot groter klein kleiner juist onjuist leg uit bereken noteer noem geef antwoord vraag vragen omdat want zodat maar dus kan kun kunnen moet moeten veel weinig eerst daarna steeds tijdens zelfde andere ander keer twee drie vier punt punten".split(
    " ",
  ),
);

function woorden(t: string | undefined): string[] {
  return (t ?? "")
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w));
}

function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  return a.filter((w) => sb.has(w)).length / a.length;
}

function jaccard(a: string[], b: string[]): { j: number; gedeeld: string[] } {
  const sa = new Set(a);
  const sb = new Set(b);
  const gedeeld = [...sa].filter((w) => sb.has(w));
  const uni = new Set([...sa, ...sb]).size;
  return { j: uni ? gedeeld.length / uni : 0, gedeeld };
}

/** Veelgebruikte voornamen in gegenereerde contexten (NL + meercultureel). */
const VOORNAMEN = new Set(
  "Bram Daan Sanne Lotte Emma Luuk Fenna Sem Noah Julia Tess Milan Jesse Lisa Anna Finn Liam Lucas Levi Mila Zoë Sara Sophie Eva Noor Lieke Iris Femke Jasper Thijs Ruben Tim Tom Max Lars Bas Koen Joost Niels Sven Stijn Floor Roos Fleur Nina Isa Yara Amira Fatima Ayoub Mohammed Mehmet Yusuf Omar Ilias Sami Aisha Priya Mei Chen Kevin Dylan Rick Nick Mark Anouk Esmee Demi Romy Elif Zeynep Hamza Rayan Adam Ilse Marieke Pieter Jan Kees Henk Wouter Gijs Hugo Olivier Jens Mats Siem Jip Janneke Tygo Lynn Puck Hanna Hannah Bo Teun Ward Mees Mia Saar Vera Joep Rosa Mo".split(" "),
);

function namen(t: string | undefined): string[] {
  const out = new Set<string>();
  for (const m of (t ?? "").matchAll(/\b([A-Z][a-zëé]{1,11})\b/g)) if (VOORNAMEN.has(m[1]!)) out.add(m[1]!);
  return [...out];
}

function groepSleutel(q: Vraag): string {
  return q.contextTitel?.trim() ? `t:${q.contextTitel.trim().toLowerCase()}` : `q:${q.nummer}`;
}

function nakijkVan(nk: NakijkItem[], nr: number): NakijkItem | undefined {
  return nk.find((n) => n.nummer === nr);
}

function isMc(q: Vraag): boolean {
  return Boolean(q.opties?.length);
}

function sleutelLetter(n: NakijkItem | undefined): string | undefined {
  const m = (n?.modelantwoord ?? "").trim().match(/^([A-F])(?:[.):\s]|$)/);
  return m?.[1];
}

const heeftFiguurdata = (q: Vraag) => Boolean(q.figuur || q.figuurId || q.tabel || q.grafiek || q.schemaFiguur || q.pictogram || q.maatcilinder);

/** Tekstversie van de toets (voor de rechter en voor mensen). */
export function toetsAlsTekst(t: GegenereerdeToets): string {
  const regels: string[] = [`${t.meta.titel} · ${t.meta.leerweg} klas ${t.meta.leerjaar} · ${t.meta.duurMinuten} min`];
  let laatsteTitel = "";
  for (const q of t.vragen) {
    if (q.contextTitel && q.contextTitel !== laatsteTitel) {
      regels.push(`\n## ${q.contextTitel}`);
      laatsteTitel = q.contextTitel;
    }
    const fig = q.tabel ? ` [tabel: ${q.tabel.koppen.join(" | ")} / ${q.tabel.rijen.map((r) => r.join(" | ")).join(" ; ")}]` : heeftFiguurdata(q) ? " [figuur]" : "";
    regels.push(`\n${q.nummer}. (${q.punten}p, ${q.rtti}${q.vraagtype ? `, ${q.vraagtype}` : ""}, ${q.domein ?? ""})${q.context ? ` ${q.context}` : ""}${fig}\n${q.stam}`);
    for (const o of q.opties ?? []) regels.push(`   ${o.letter}. ${o.tekst}`);
    const n = nakijkVan(t.nakijkmodel, q.nummer);
    if (n) regels.push(`   → ${n.modelantwoord} | ${n.puntenverdeling.map((p) => `${p.punt}p ${p.criterium}`).join("; ")}`);
  }
  return regels.join("\n");
}

// ── scoren ─────────────────────────────────────────────────────────────────────────────────────
export function scoorToets(t: GegenereerdeToets, input: EvalInput, rechter?: RechterOordeel): Scorekaart {
  const V = t.vragen;
  const N = t.nakijkmodel;
  const tekstVan = (q: Vraag) => `${q.context ?? ""} ${q.stam} ${(q.opties ?? []).map((o) => o.tekst).join(" ")}`;
  const crit: Criterium[] = [];
  const hard: HardCriterium[] = [];
  const r = (p: number) => {
    const s = rechter?.punten?.[String(p)]?.score;
    return typeof s === "number" ? Math.max(0, Math.min(2, s)) / 2 : undefined;
  };
  const meng = (code: number, p: number): { score: number; bron: Criterium["bron"] } => {
    const rr = r(p);
    return rr === undefined ? { score: code, bron: "code" } : { score: (code + rr) / 2, bron: "code+rechter" };
  };
  const blijft = t.controle?.blijft ?? [];

  // 1. Rekenen / één g
  const alleTekst = [...V.map(tekstVan), ...N.map((n) => `${n.modelantwoord} ${n.puntenverdeling.map((p) => p.criterium).join(" ")}`), ...(t.meta.instructies ?? [])].join("\n");
  const gWaarden = new Set<string>();
  for (const m of alleTekst.matchAll(/\bg\s*=\s*(9[,.]81?|10)\b|\b(9[,.]81?|10)\s*N\/kg\b/g)) {
    // "Ook goed: … (g = 10)" in het nakijkmodel is een toegestane alternatieve waarde, geen tweede g.
    if (/ook goed[^\n]{0,60}$/i.test(alleTekst.slice(Math.max(0, m.index! - 60), m.index!))) continue;
    gWaarden.add((m[1] ?? m[2]!).replace(".", ","));
  }
  const gOk = gWaarden.size <= 1;
  const reken = V.filter((q) => q.type === "berekening");
  const rekenMetGetal = reken.filter((q) => /\d/.test(nakijkVan(N, q.nummer)?.modelantwoord ?? "")).length;
  const rekenSleutelFout = blijft.filter((b) => b.code === "sleutel-fout" && reken.some((q) => q.nummer === b.nummer)).length;
  const c1 = (gOk ? 0.4 : 0) + 0.4 * (reken.length ? rekenMetGetal / reken.length : 1) + (rekenSleutelFout ? 0 : 0.2);
  crit.push({ punt: 1, id: "rekenen", naam: "Rekenen klopt, één g", ...meng(c1, 1), detail: `g-waarden: ${[...gWaarden].join("/") || "geen"}; ${rekenMetGetal}/${reken.length} rekenantwoorden met uitkomst; ${rekenSleutelFout} open sleutelfout(en)` });
  hard.push({ id: "H-g", naam: "Eén waarde voor g in de hele toets", ok: gOk, detail: [...gWaarden].join("/") || "geen g" });

  // 2. Weggevers: MC-sleutel of modelantwoord ≈ antwoord van een andere vraag, of antwoord letterlijk in een andere stam
  const weg: string[] = [];
  for (const q of V) {
    const n = nakijkVan(N, q.nummer);
    const ant = isMc(q) ? q.opties!.find((o) => o.letter === sleutelLetter(n))?.tekst : n?.modelantwoord;
    const aw = woorden(ant);
    if (aw.length < 3) continue;
    for (const p of V) {
      if (p.nummer === q.nummer || groepSleutel(p) === groepSleutel(q)) continue;
      if (overlap(aw, woorden(tekstVan(p))) >= 0.6) weg.push(`${p.nummer}→${q.nummer}`);
    }
  }
  const c2 = 1 - Math.min(1, weg.length / 3);
  crit.push({ punt: 2, id: "weggevers", naam: "Geen weggevers tussen vragen", ...meng(c2, 2), detail: weg.length ? `vraag(en) verklappen: ${weg.slice(0, 6).join(", ")}` : "geen gevonden" });

  // 3. Dubbele contexten (verschillende blokken met dezelfde persoon of hetzelfde voorwerp/situatie)
  const groepen = new Map<string, Vraag[]>();
  for (const q of V) groepen.set(groepSleutel(q), [...(groepen.get(groepSleutel(q)) ?? []), q]);
  const gl = [...groepen.entries()].map(([k, qs]) => ({ k, nrs: qs.map((q) => q.nummer), tekst: `${qs[0]!.contextTitel ?? ""} ${qs.map((q) => q.context ?? "").join(" ")} ${qs[0]!.stam}` }));
  const dubbel: string[] = [];
  for (let i = 0; i < gl.length; i++) {
    for (let j = i + 1; j < gl.length; j++) {
      const a = gl[i]!;
      const b = gl[j]!;
      const zelfdeNaam = namen(a.tekst).filter((x) => namen(b.tekst).includes(x));
      const jac = jaccard(woorden(a.tekst).filter((w) => w.length >= 5), woorden(b.tekst).filter((w) => w.length >= 5));
      if (zelfdeNaam.length || (jac.j >= 0.3 && jac.gedeeld.length >= 2)) dubbel.push(`${a.nrs[0]}/${b.nrs[0]}${zelfdeNaam.length ? ` (${zelfdeNaam[0]})` : ` (${jac.gedeeld.slice(0, 2).join(", ")})`}`);
    }
  }
  const c3 = 1 - Math.min(1, dubbel.length / 4);
  crit.push({ punt: 3, id: "contexten", naam: "Geen dubbele contexten/personen", ...meng(c3, 3), detail: dubbel.length ? dubbel.slice(0, 8).join("; ") : "geen" });

  // 4. Begripsherhaling: twee vragen in verschillende blokken toetsen hetzelfde antwoord
  const herh: string[] = [];
  for (let i = 0; i < V.length; i++) {
    for (let j = i + 1; j < V.length; j++) {
      const a = V[i]!;
      const b = V[j]!;
      if (groepSleutel(a) === groepSleutel(b)) continue;
      const wa = woorden(nakijkVan(N, a.nummer)?.modelantwoord);
      const wb = woorden(nakijkVan(N, b.nummer)?.modelantwoord);
      if (wa.length >= 3 && wb.length >= 3 && Math.min(overlap(wa, wb), overlap(wb, wa)) >= 0.6) herh.push(`${a.nummer}/${b.nummer}`);
    }
  }
  const c4 = 1 - Math.min(1, herh.length / 3);
  crit.push({ punt: 4, id: "begrippen", naam: "Geen herhaling van hetzelfde begrip", ...meng(c4, 4), detail: herh.length ? herh.join(", ") : "geen" });

  // 5. Context niet herhaald in de stam
  const herhaald = V.filter((q) => {
    const ctx = (q.context ?? "").split(/(?<=[.!?])\s+/).filter((z) => z.split(/\s+/).length >= 8);
    return ctx.some((z) => q.stam.includes(z.trim()));
  }).map((q) => q.nummer);
  crit.push({ punt: 5, id: "stam", naam: "Context niet herhaald in de stam", score: 1 - Math.min(1, herhaald.length / 3), bron: "code", detail: herhaald.length ? `vragen ${herhaald.join(", ")}` : "geen" });

  // 6. MC: één verdedigbaar antwoord, unieke afleiders
  const mc = V.filter(isMc);
  const mcFout: string[] = [];
  let mcStructuurOk = true;
  for (const q of mc) {
    const n = nakijkVan(N, q.nummer);
    const teksten = q.opties!.map((o) => o.tekst.trim().toLowerCase());
    const jo = q.type === "juist-onjuist";
    const letter = sleutelLetter(n);
    const sleutelOk = Boolean(letter && q.opties!.some((o) => o.letter === letter));
    const uniek = new Set(teksten).size === teksten.length;
    const genoeg = jo ? teksten.length === 2 : teksten.length >= 3;
    const subset = !jo && teksten.some((a, i) => a.split(/\s+/).length >= 3 && teksten.some((b, j) => i !== j && b.includes(a)));
    const meerJuist = blijft.some((b) => b.nummer === q.nummer && (b.code === "meer-juiste-opties" || b.code === "geen-juiste-optie"));
    if (!sleutelOk || !uniek || !genoeg) mcStructuurOk = false;
    if (!sleutelOk || !uniek || !genoeg || subset || meerJuist) mcFout.push(`${q.nummer}${!sleutelOk ? " sleutel" : ""}${!uniek ? " dubbel" : ""}${!genoeg ? " opties" : ""}${subset ? " deelverzameling" : ""}${meerJuist ? " meer/geen juist" : ""}`);
  }
  const c6 = mc.length ? 1 - mcFout.length / mc.length : 1;
  crit.push({ punt: 6, id: "afleiders", naam: "MC eenduidig, goede afleiders", ...meng(c6, 6), detail: `${mc.length - mcFout.length}/${mc.length} MC in orde${mcFout.length ? `; fout: ${mcFout.join(", ")}` : ""}` });
  hard.push({ id: "H-mc", naam: "Elke MC: sleutel bestaat, opties uniek, genoeg opties", ok: mcStructuurOk, detail: mcFout.filter((f) => /sleutel|dubbel|opties/.test(f)).join(", ") || "ok" });

  // 7. Realisme (controle-log + rechter)
  const realisme = blijft.filter((b) => b.code === "realisme").length;
  crit.push({ punt: 7, id: "realisme", naam: "Realistische situaties en getallen", ...meng(1 - Math.min(1, realisme / 2), 7), detail: `${realisme} open realisme-bevinding(en) na reparatie` });

  // 8. RTTI
  const doel = input.rttiHandmatig && input.rttiDoel ? input.rttiDoel : rttiDoelVoor(input.leerjaar, input.moeilijkheid);
  const tot = Math.max(1, V.reduce((s, q) => s + q.punten, 0));
  const pct = (k: string) => Math.round((V.filter((q) => q.rtti === k).reduce((s, q) => s + q.punten, 0) / tot) * 100);
  const afw = Math.max(...(["R", "T1", "T2", "I"] as const).map((k) => Math.abs(pct(k) - doel[k])));
  const heeftI = V.some((q) => q.rtti === "I");
  let c8 = afw <= 10 ? 1 : Math.max(0, 1 - (afw - 10) / 20);
  if (input.leerjaar >= 3 && !heeftI) c8 = Math.min(c8, 0.5);
  crit.push({ punt: 8, id: "rtti", naam: "RTTI dicht bij het klasdoel", score: c8, bron: "code", detail: `R ${pct("R")}/T1 ${pct("T1")}/T2 ${pct("T2")}/I ${pct("I")} vs doel ${doel.R}/${doel.T1}/${doel.T2}/${doel.I}; max afwijking ${afw} pp${heeftI ? "" : "; geen I-vraag"}` });

  // 9. Vraagtypen gelabeld
  const metType = V.filter((q) => q.vraagtype && q.vraagtype !== "OVERIG").length;
  crit.push({ punt: 9, id: "vraagtypen", naam: "Vraagtypen uit de NaSk-taxonomie", score: V.length ? metType / V.length : 0, bron: "code", detail: `${metType}/${V.length} met vraagtype` });

  // 10. Paragraaf-/leerdoeldekking
  const pars = extractParagrafen(input.bronmateriaal, input.antwoordenmateriaal);
  const dek = pars.length >= 2 ? paragraafDekking(V, pars) : [];
  const leeg = dek.filter((d) => !d.vragen.length).map((d) => `${d.paragraaf.code} ${d.paragraaf.titel}`);
  crit.push({ punt: 10, id: "dekking", naam: "Elke paragraaf van de lesstof getoetst", score: dek.length ? 1 - leeg.length / dek.length : 1, bron: "code", detail: dek.length ? `${dek.length - leeg.length}/${dek.length} paragrafen${leeg.length ? `; ontbreekt: ${leeg.join("; ")}` : ""}` : "geen paragraafkoppen in de lesstof" });
  hard.push({ id: "H-dekking", naam: "Alle paragrafen gedekt", ok: leeg.length === 0, detail: leeg.join("; ") || "ok" });

  // 11. Figuur-/tabelverwijzingen kloppen (ook teken-/grafiekvragen)
  // Alleen echte verwijzingen ("in de figuur", "deze tabel", "zie grafiek", "hieronder"), niet "een tekening" of "maak een grafiek".
  const VERWIJS = /\b(?:de|deze|het|die|onderstaande|bovenstaande|zie|in|uit)\s+(?:figuur|afbeelding|tabel|diagram|grafiek|tekening)\b|\b(?:figuur|tabel|afbeelding)\s+\d|\b(?:hieronder|hiernaast|hierboven)\b/i;
  const spook = V.filter((q) => VERWIJS.test(`${q.context ?? ""} ${q.stam}`) && !heeftFiguurdata(q) && !/\b(teken|schets|maak een (tabel|grafiek|diagram))\b/i.test(q.stam)).map((q) => q.nummer);
  crit.push({ punt: 11, id: "figuren", naam: "Geen verwijzing naar ontbrekende figuur/tabel", score: 1 - Math.min(1, spook.length / 2), bron: "code", detail: spook.length ? `vragen ${spook.join(", ")}` : "ok" });
  hard.push({ id: "H-figuur", naam: "Geen verwijzing naar een ontbrekende figuur/tabel", ok: spook.length === 0, detail: spook.join(", ") || "ok" });

  // 12. Nakijkmodel compleet en punten kloppen
  const nkFout = V.filter((q) => {
    const n = nakijkVan(N, q.nummer);
    if (!n || !n.modelantwoord?.trim()) return true;
    const som = n.puntenverdeling.reduce((s, p) => s + (p.punt ?? 0), 0);
    return som !== q.punten;
  }).map((q) => q.nummer);
  crit.push({ punt: 12, id: "nakijkmodel", naam: "Nakijkmodel compleet, punten = rubriek", score: V.length ? 1 - nkFout.length / V.length : 0, bron: "code", detail: nkFout.length ? `afwijkend: ${nkFout.join(", ")}` : "ok" });
  hard.push({ id: "H-nakijk", naam: "Nakijkmodel compleet en punten kloppen", ok: nkFout.length === 0, detail: nkFout.join(", ") || "ok" });

  // 13. Lengte (punten en vragen voor deze toetsduur)
  const lengteDoel = effectiefDoel(t, input);
  const doelP = lengteDoel.punten;
  const ratio = tot / Math.max(1, doelP);
  const puntScore = ratio >= 0.9 && ratio <= 1.15 ? 1 : Math.max(0, 1 - Math.abs(ratio < 0.9 ? 0.9 - ratio : ratio - 1.15) * 4);
  const vr = V.length / Math.max(1, lengteDoel.vragen);
  const vraagScore = vr >= 0.85 ? 1 : Math.max(0, 1 - (0.85 - vr) * 4);
  const c13 = Math.min(puntScore, vraagScore);
  crit.push({ punt: 13, id: "lengte", naam: "Lengte past bij de toetsduur", score: c13, bron: "code", detail: `${V.length} vragen / ${tot} p tegen doel ${lengteDoel.vragen} / ${doelP}${lengteDoel.bron === "kalibratie" ? " (automatische lengte)" : ""}` });
  hard.push({ id: "H-lengte", naam: "Punten binnen 85–120 % van het doel", ok: ratio >= 0.85 && ratio <= 1.2, detail: `${tot}/${doelP} = ${Math.round(ratio * 100)} %` });

  // Hard: geen schoolnamen en geen onbruikbare vragen meer
  const school = V.filter((q) => /\b(Aeres|Nordwin)\b|\b[A-Z][a-z]+\s+(College|Lyceum)\b|\b[A-Z][a-z]+school\b/.test(tekstVan(q))).map((q) => q.nummer);
  hard.push({ id: "H-school", naam: "Geen schoolnamen", ok: school.length === 0, detail: school.join(", ") || "ok" });
  const onbruikbaar = blijft.filter((b) => ["sleutel-fout", "geen-juiste-optie", "meer-juiste-opties", "gegeven-ontbreekt"].includes(b.code));
  hard.push({ id: "H-onbruikbaar", naam: "Geen open sleutel-/oplosbaarheidsfouten na reparatie", ok: onbruikbaar.length === 0, detail: onbruikbaar.map((b) => `${b.nummer} ${b.code}`).join(", ") || "ok" });

  const cijfer = Math.round((1 + 9 * (crit.reduce((s, c) => s + c.score, 0) / crit.length)) * 10) / 10;
  return {
    rubriekVersie: RUBRIEK_VERSIE,
    criteria: crit,
    hard,
    hardOk: hard.every((h) => h.ok),
    cijfer,
    feiten: {
      vragen: V.length,
      punten: tot,
      doelPunten: doelP,
      mc: mc.length,
      verwijderd: (t.controle?.verwijderd ?? []).length,
      vervangen: (t.controle?.vervangen ?? []).length,
      gevonden: (t.controle?.gevonden ?? []).length,
      openNaReparatie: blijft.length,
      ...(rechter?.cijfer != null ? { rechterCijfer: rechter.cijfer } : {}),
    },
  };
}

/** Go-live-poort: nieuw ≥ baseline en alle harde criteria ok. */
/**
 * Go-live-poort: harde criteria 100 % én rechtercijfer ≥ baseline (gemiddelde van de rechter-runs; Nick: de
 * coderubriek alleen is te mild). Zonder rechtercijfers valt de poort terug op het rubriekcijfer.
 */
/**
 * Doel-lengte: bij "automatische lengte" (lengteAuto) kiest de app de lengte uit de kalibratie (echte
 * schooltoetsen); dan telt die richtwaarde, niet het standaardgetal uit het formulier.
 */
export function effectiefDoel(t: GegenereerdeToets, input: EvalInput): { vragen: number; punten: number; bron: "invoer" | "kalibratie" } {
  if ((input as { lengteAuto?: boolean }).lengteAuto) {
    const k = t.kwaliteit?.punten?.find((p) => /kalibratie/i.test(p.criterium));
    const m = k?.toelichting.match(/richtwaarde[^:]*:\s*(\d+)\s*vragen\s*\/\s*(\d+)\s*punten/i);
    if (m) return { vragen: Number(m[1]), punten: Number(m[2]), bron: "kalibratie" };
  }
  return { vragen: input.aantalVragen, punten: input.doelPunten, bron: "invoer" };
}

export function poort(nieuw: Scorekaart, baseline?: Scorekaart, rechter?: { nieuw?: number | null; baseline?: number | null }): { ok: boolean; redenen: string[] } {
  const redenen: string[] = [];
  if (!nieuw.hardOk) redenen.push(`harde criteria niet 100 %: ${nieuw.hard.filter((h) => !h.ok).map((h) => h.id).join(", ")}`);
  if (rechter?.nieuw != null && rechter.baseline != null) {
    if (rechter.nieuw < rechter.baseline) redenen.push(`rechter ${rechter.nieuw} < baseline ${rechter.baseline}`);
  } else if (baseline && nieuw.cijfer < baseline.cijfer) redenen.push(`cijfer ${nieuw.cijfer} < baseline ${baseline.cijfer}`);
  return { ok: redenen.length === 0, redenen };
}

/** Vaste rechter-prompt (versie hoort bij RUBRIEK_VERSIE). */
export const RECHTER_VERSIE = "rechter-2026-10-01.1";
export const RECHTER_SYSTEM = `Je bent een strenge NaSk-docent (vmbo) die een gegenereerde toets beoordeelt met een VASTE rubriek. Wees consequent en kritisch; geef geen punten uit beleefdheid.
Scoor elk punt 0 (slecht), 1 (matig) of 2 (goed):
1 rekenen: alle uitkomsten en eenheden kloppen (reken zelf na), één waarde voor g, deelpunten per stap.
2 weggevers: geen vraag verklapt het antwoord van een andere vraag.
3 contexten: geen dubbele situaties/voorwerpen/personen over verschillende contexten.
4 begrippen: niet twee keer hetzelfde begrip of dezelfde redenering getoetst.
5 stam: de context wordt niet herhaald in de vraagzin; eerst situatie, dan vraag.
6 afleiders: precies één verdedigbaar MC-antwoord; afleiders plausibel, niet overlappend; goed Nederlands.
7 realisme: situaties en getallen kunnen echt zo; herkenbaar voor de leerling.
8 rtti: RTTI-labels kloppen met wat de vraag vraagt.
9 vraagtypen: vraagvormen passen bij het niveau (vergelijkbaar met schooltoetsen/CSE).
10 dekking: alle paragrafen van de lesstof komen aan bod, verdeeld naar hoeveelheid stof.
11 figuren: geen verwijzing naar ontbrekende figuren; teken-/grafiekvragen zijn uitvoerbaar.
12 nakijkmodel: per punt één scorebaar criterium; modelantwoorden kloppen.
13 lengte: aantal vragen en punten passen bij de toetsduur.
Antwoord ALLEEN met JSON: { "punten": { "1": {"score": 0|1|2, "opmerking": string}, … "13": {…} }, "cijfer": number (1–10), "topProblemen": [string, string, string] }`;

export function rechterPrompt(t: GegenereerdeToets, input: EvalInput): string {
  const d = effectiefDoel(t, input);
  return `LESSTOF:\n${input.bronmateriaal.slice(0, 20000)}\n\nTOETS (doel: ${input.leerweg} klas ${input.leerjaar}, ${input.duurMinuten} min, ± ${d.punten} punten${d.bron === "kalibratie" ? ", lengte automatisch volgens echte schooltoetsen van deze klas" : ""}):\n${toetsAlsTekst(t)}`;
}

export function parseRechter(raw: string): RechterOordeel | undefined {
  try {
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    const o = JSON.parse(raw.slice(s, e + 1)) as Omit<RechterOordeel, "versie">;
    return { versie: RECHTER_VERSIE, punten: o.punten ?? {}, cijfer: o.cijfer, topProblemen: o.topProblemen };
  } catch {
    return undefined;
  }
}
