import type { NakijkItem, Vraag, VraagOptie } from "./types";
import { ordenVragenMcEerst } from "./vraag-volgorde.ts";

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function lettersForCount(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
}

/** "B.", "b)", " A " → "B". Leeg als geen MC-letter. */
export function canonLetter(raw: string): string {
  const m = (raw || "").trim().toUpperCase().match(/([A-D])/);
  return m ? m[1] : "";
}

function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

/**
 * Meta-opties waarvan de plek vastligt: altijd achteraan, relatieve volgorde behouden.
 * "A en B" / "beide" / "alle bovenstaande" / "geen van bovenstaande".
 */
export function isAnchorOption(tekst: string): boolean {
  const t = normText(tekst);
  if (!t || t.length > 80) return false;
  if (/\b(alle|geen) van (de |het )?(bovenstaande|genoemde|vorige|deze|antwoorden)\b/.test(t)) return true;
  if (/^alle (bovenstaande|antwoorden|genoemde)\b/.test(t)) return true;
  if (/\b(all of the above|none of the above|both of the above)\b/.test(t)) return true;
  if (/^(beide|allebei|both)$/.test(t)) return true;
  if (/^(beide|allebei) (bovenstaande|antwoorden|genoemde)$/.test(t)) return true;
  if (/\b[a-d]\s*(?:,\s*[a-d]\s*)*(?:en|als|&)\s*[a-d]\b/.test(t)) return true;
  return false;
}

function parseLeadingNumber(tekst: string): number | null {
  const t = tekst.trim().replace(",", ".");
  const m = t.match(/^-?\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?/);
  if (!m) return null;
  const rest = t.slice(m[0].length).trim();
  if (rest && !/^[a-zA-Zµμ°%²³/.\-\s]{1,12}$/.test(rest)) return null;
  if (m[0].includes("/")) {
    const [a, b] = m[0].split("/").map((s) => Number(s.trim()));
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
    return a / b;
  }
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Zuiver numerieke opties (2 / 5 kg / 12 N): volgorde laten staan. */
export function isNumericOptionSet(opties: VraagOptie[]): boolean {
  if (opties.length < 2) return false;
  if (opties.some((o) => isAnchorOption(o.tekst))) return false;
  return opties.every((o) => parseLeadingNumber(o.tekst) !== null);
}

/**
 * Zoek welk optie-index het modelantwoord bedoelt. -1 = onbekend.
 * Herkent o.a. "B", "B.", "B) tekst", "Antwoord: B", en de optietekst zelf.
 */
export function findCorrectOptionIndex(opties: VraagOptie[], modelantwoord: string): number {
  const m = (modelantwoord || "").trim();
  if (!m || !opties.length) return -1;

  const byLetter = (L: string) => opties.findIndex((o) => canonLetter(o.letter) === L);

  const start = m.match(/^\*{0,2}\s*([A-Da-d])(?:\s*[.):\-–—]|\s|$)/);
  if (start) {
    const idx = byLetter(start[1]!.toUpperCase());
    if (idx >= 0) return idx;
  }

  const labeled = m.match(
    /(?:juiste\s+)?(?:antwoord|sleutel|optie|keuze)\s*(?:is|=|:)?\s*\*{0,2}\s*([A-Da-d])\b/i,
  );
  if (labeled) {
    const idx = byLetter(labeled[1]!.toUpperCase());
    if (idx >= 0) return idx;
  }

  const stripped = m.replace(/^\*{0,2}\s*[A-Da-d]\s*[.):\-–—]?\s*/, "").trim();
  const nStrip = normText(stripped);
  if (nStrip.length >= 2) {
    const hits = opties
      .map((o, i) => ({ i, t: normText(o.tekst.replace(/^\*{0,2}\s*[A-Da-d]\s*[.):\-–—]?\s*/, "")) }))
      .filter((x) => x.t.length >= 2 && (x.t === nStrip || nStrip.includes(x.t) || x.t.includes(nStrip)));
    if (hits.length >= 1) {
      hits.sort((a, b) => b.t.length - a.t.length);
      return hits[0]!.i;
    }
  }

  return -1;
}

function findCorrectFromNakijk(opties: VraagOptie[], nakijk: NakijkItem | undefined): number {
  const primary = findCorrectOptionIndex(opties, nakijk?.modelantwoord ?? "");
  if (primary >= 0) return primary;
  for (const p of nakijk?.puntenverdeling ?? []) {
    const c = (p.criterium || "").trim();
    if (!/^(\*{0,2}\s*)?[A-Da-d]\b/.test(c) && !/antwoord/i.test(c)) continue;
    const idx = findCorrectOptionIndex(opties, c);
    if (idx >= 0) return idx;
  }
  const blob = normText(nakijk?.modelantwoord ?? "");
  if (blob.length >= 3) {
    const hits = opties
      .map((o, i) => ({ i, t: normText(o.tekst) }))
      .filter((x) => x.t.length >= 3 && blob.includes(x.t));
    if (hits.length >= 1) {
      hits.sort((a, b) => b.t.length - a.t.length);
      return hits[0]!.i;
    }
  }
  return -1;
}

type Slot = { allowed: string[]; fixed: string | null };

function hasLongRun(letters: string[], maxRun = 2): boolean {
  let run = 1;
  for (let i = 1; i < letters.length; i++) {
    run = letters[i] === letters[i - 1] ? run + 1 : 1;
    if (run > maxRun) return true;
  }
  return false;
}

/**
 * Verdeel sleutelletters zo gelijk mogelijk. Nooit meer dan 2 dezelfde op een rij,
 * tenzij vaste posities (numerieke reeks, anker-antwoord) dat afdwingen.
 */
export function planBalancedLetters(slots: Slot[]): string[] {
  if (slots.length === 0) return [];
  const alphabetSet = new Set<string>();
  for (const s of slots) for (const L of s.allowed) alphabetSet.add(L);
  const alphabet = [...alphabetSet].sort();
  if (alphabet.length === 0) return slots.map(() => "A");

  const used: Record<string, number> = {};
  for (const L of alphabet) used[L] = 0;

  const out: string[] = [];
  const mutable: boolean[] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    if (slot.fixed && (slot.allowed.length === 0 || slot.allowed.includes(slot.fixed))) {
      out.push(slot.fixed);
      used[slot.fixed] = (used[slot.fixed] ?? 0) + 1;
      mutable.push(false);
      continue;
    }
    const allowed = slot.allowed.length ? slot.allowed : alphabet;
    const blocked = (L: string) => i >= 2 && out[i - 1] === L && out[i - 2] === L;
    let pool = allowed.filter((L) => !blocked(L));
    if (pool.length === 0) pool = [...allowed];
    pool.sort((a, b) => {
      const da = used[a] ?? 0;
      const db = used[b] ?? 0;
      if (da !== db) return da - db;
      return Math.random() - 0.5;
    });
    const pick = pool[0]!;
    out.push(pick);
    used[pick] = (used[pick] ?? 0) + 1;
    mutable.push(true);
  }

  repairRuns(out, mutable, slots);
  rebalance(out, mutable, slots, alphabet);
  repairRuns(out, mutable, slots);
  return out;
}

function repairRuns(letters: string[], mutable: boolean[], slots: Slot[]): void {
  const n = letters.length;
  for (let guard = 0; guard < n * n; guard++) {
    let run = 1;
    let bad = -1;
    for (let i = 1; i < n; i++) {
      run = letters[i] === letters[i - 1] ? run + 1 : 1;
      if (run > 2) {
        bad = i;
        break;
      }
    }
    if (bad < 0) return;
    let swapped = false;
    for (let j = 0; j < n && !swapped; j++) {
      if (j === bad || !mutable[j] || !mutable[bad]) continue;
      const a = letters[bad]!;
      const b = letters[j]!;
      if (a === b) continue;
      if (!slots[bad]!.allowed.includes(b) || !slots[j]!.allowed.includes(a)) continue;
      letters[bad] = b;
      letters[j] = a;
      if (!hasLongRun(letters)) {
        swapped = true;
        break;
      }
      letters[bad] = a;
      letters[j] = b;
    }
    if (!swapped) return;
  }
}

function rebalance(letters: string[], mutable: boolean[], slots: Slot[], alphabet: string[]): void {
  const n = letters.length;
  for (let guard = 0; guard < n * n; guard++) {
    const counts: Record<string, number> = {};
    for (const L of alphabet) counts[L] = 0;
    for (const L of letters) if (counts[L] !== undefined) counts[L]++;
    const ranked = alphabet.map((L) => [L, counts[L] ?? 0] as const).sort((a, b) => a[1] - b[1]);
    const low = ranked[0];
    const high = ranked[ranked.length - 1];
    if (!low || !high || high[1] - low[1] <= 1) return;
    let swapped = false;
    for (let i = 0; i < n && !swapped; i++) {
      if (!mutable[i] || letters[i] !== high[0]) continue;
      for (let j = 0; j < n; j++) {
        if (!mutable[j] || letters[j] !== low[0]) continue;
        if (!slots[i]!.allowed.includes(low[0]) || !slots[j]!.allowed.includes(high[0])) continue;
        const a = letters[i]!;
        const b = letters[j]!;
        letters[i] = b;
        letters[j] = a;
        if (!hasLongRun(letters)) {
          swapped = true;
          break;
        }
        letters[i] = a;
        letters[j] = b;
      }
    }
    if (!swapped) return;
  }
}

/** Bijna gelijke verdeling, zonder drie dezelfde letters op een rij. */
export function balancedLetterTargets(n: number, alphabet: string[]): string[] {
  if (n <= 0 || alphabet.length === 0) return [];
  return planBalancedLetters(
    Array.from({ length: n }, () => ({ allowed: [...alphabet], fixed: null })),
  );
}

function nakijkVoor(nakijk: NakijkItem[], vraag: Vraag, index: number): NakijkItem | undefined {
  return nakijk.find((n) => n.nummer === vraag.nummer) ?? nakijk[index];
}

function isLetterRef(str: string, index: number, len: number): boolean {
  const before = str.slice(Math.max(0, index - 32), index);
  const after = str.slice(index + len, index + len + 32);
  if (/^\s*[.):\-–—]/.test(after)) return true;
  if (/^\s+is\s+(?:juist|correct|goed|fout|onjuist)\b/i.test(after)) return true;
  if (/^\s*[—–-]/.test(after)) return true;
  if (/^\s*(?:,|en)\s+[A-Da-d]\b/i.test(after)) return true;
  if (/\bniet\s+$/i.test(before)) return true;
  if (/\b(?:antwoord|sleutel|optie|keuze|letter)\s*(?:is|=|:)?\s*$/i.test(before)) return true;
  if (/\ben\s+$/i.test(before)) return true;
  return false;
}

/** Vervang alleen losse antwoordletters (niet "vitamine A"). Eén pass, dus A↔B wisselt goed. */
export function rewriteLetterRefs(text: string, map: Record<string, string>, aggressive = false): string {
  if (!text || Object.keys(map).length === 0) return text;
  return text.replace(/\b[A-Da-d]\b/g, (m, offset) => {
    if (!aggressive && !isLetterRef(text, offset, m.length)) return m;
    const next = map[m.toUpperCase()];
    return next ?? m;
  });
}

function letterMap(orig: VraagOptie[], placed: VraagOptie[]): Record<string, string> {
  const used = new Set<number>();
  const map: Record<string, string> = {};
  for (const o of orig) {
    const oldL = canonLetter(o.letter);
    const n = normText(o.tekst);
    const idx = placed.findIndex((p, i) => !used.has(i) && normText(p.tekst) === n);
    if (idx < 0 || !oldL) continue;
    used.add(idx);
    const newL = canonLetter(placed[idx]!.letter);
    if (newL) map[oldL] = newL;
  }
  return map;
}

function splitAnchors(opties: VraagOptie[]): { anchors: number[]; front: number[] } {
  const anchors: number[] = [];
  const front: number[] = [];
  opties.forEach((o, i) => (isAnchorOption(o.tekst) ? anchors : front).push(i));
  return { anchors, front };
}

type JobKind = "free" | "numeric" | "anchor";

function analyzeJob(opties: VraagOptie[], correctIdx: number): { kind: JobKind; allowed: string[]; fixed: string | null } {
  const letters = lettersForCount(opties.length);
  if (isNumericOptionSet(opties)) {
    const fixed = letters[correctIdx] ?? canonLetter(opties[correctIdx]?.letter ?? "") ?? "A";
    return { kind: "numeric", allowed: letters, fixed };
  }
  const { anchors, front } = splitAnchors(opties);
  if (anchors.includes(correctIdx)) {
    const landing = front.length + anchors.indexOf(correctIdx);
    const fixed = letters[landing] ?? "D";
    return { kind: "anchor", allowed: [fixed], fixed };
  }
  if (anchors.length > 0) {
    const allowed = letters.slice(0, Math.max(1, front.length));
    return { kind: "anchor", allowed, fixed: null };
  }
  return { kind: "free", allowed: letters, fixed: null };
}

function placeOptions(
  opties: VraagOptie[],
  correctIdx: number,
  targetLetter: string | null,
  kind: JobKind,
): { opties: VraagOptie[]; map: Record<string, string> } {
  const letters = lettersForCount(opties.length);
  if (kind === "numeric" || targetLetter === null) {
    const next = opties.map((o, i) => ({ letter: letters[i] ?? o.letter, tekst: o.tekst }));
    return { opties: next, map: letterMap(opties, next) };
  }

  const { anchors, front } = splitAnchors(opties);
  const texts: string[] = new Array(opties.length);
  anchors.forEach((idx, k) => {
    texts[front.length + k] = opties[idx]!.tekst;
  });

  if (anchors.includes(correctIdx)) {
    const shuffled = shuffle(front.map((i) => opties[i]!.tekst));
    shuffled.forEach((t, i) => {
      texts[i] = t;
    });
  } else {
    const frontLetters = letters.slice(0, front.length);
    let targetIdx = frontLetters.indexOf(targetLetter);
    if (targetIdx < 0) targetIdx = 0;
    const others = shuffle(front.filter((i) => i !== correctIdx).map((i) => opties[i]!.tekst));
    let oi = 0;
    for (let i = 0; i < front.length; i++) {
      texts[i] = i === targetIdx ? opties[correctIdx]!.tekst : others[oi++]!;
    }
  }

  let placed = texts.map((tekst, k) => ({ letter: letters[k] ?? String(k), tekst }));
  const map = letterMap(opties, placed);
  placed = placed.map((o) =>
    isAnchorOption(o.tekst) ? { ...o, tekst: rewriteLetterRefs(o.tekst, map, true) } : o,
  );
  return { opties: placed, map };
}

/**
 * Antwoordletters in nakijktekst (niet "vitamine A").
 * Gebruikt om te controleren dat een MC-rubriek alleen de sleutel noemt.
 */
export function antwoordLettersInTekst(text: string): string[] {
  const out: string[] = [];
  if (!text) return out;
  const re = /\b([A-Da-d])\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (isLetterRef(text, m.index, m[0].length)) out.push(m[1]!.toUpperCase());
  }
  return out;
}

/** Alle antwoordletters in een nakijkregel (model, criteria, niet-toekennen). */
export function antwoordLettersInNakijk(item: NakijkItem): string[] {
  const delen = [
    item.modelantwoord ?? "",
    ...(item.puntenverdeling ?? []).map((p) => p.criterium),
    ...(item.nietToekennen ?? []),
  ];
  return delen.flatMap((d) => antwoordLettersInTekst(d));
}

/**
 * MC-rubriek deterministisch uit de uiteindelijke sleutel.
 * Criterum en niet-toekennen komen niet uit LLM-tekst.
 */
export function zetMcRubriek(vraag: Vraag, nakijk: NakijkItem, key: string, correctTekst: string): void {
  const letter = canonLetter(key) || "A";
  const punten = Math.max(1, Math.round(Number(vraag.punten) || 1));
  vraag.punten = punten;
  const tekst = (correctTekst || "").trim();
  nakijk.modelantwoord = tekst ? `${letter}. ${tekst}` : letter;
  nakijk.puntenverdeling = [{ punt: punten, criterium: `Juiste keuze ${letter}` }];
  nakijk.nietToekennen = ["andere letters"];
}

/**
 * Husselt MC-opties en zet de sleutel zo gelijk mogelijk over A–D.
 * Nakijkmodel (modelantwoord, puntenverdeling, niet-toekennen) gaat mee.
 * Numerieke reeksen blijven staan. Ankeropties blijven achteraan.
 */
export function shuffleMcAnswers(
  vragen: Vraag[],
  nakijkmodel: NakijkItem[],
): { vragen: Vraag[]; nakijkmodel: NakijkItem[] } {
  const nextVragen: Vraag[] = vragen.map((q) => ({
    ...q,
    opties: q.opties?.map((o) => ({ ...o })),
  }));
  const nextNakijk: NakijkItem[] = nakijkmodel.map((n) => ({
    ...n,
    puntenverdeling: (n.puntenverdeling ?? []).map((p) => ({ ...p })),
    nietToekennen: n.nietToekennen ? [...n.nietToekennen] : undefined,
  }));

  type Job = {
    vraagIndex: number;
    correctIdx: number;
    kind: JobKind;
    allowed: string[];
    fixed: string | null;
  };
  const jobs: Job[] = [];
  nextVragen.forEach((q, i) => {
    const opties = q.opties;
    if (!opties || opties.length < 2) return;
    const nakijk = nakijkVoor(nextNakijk, q, i);
    const correctIdx = findCorrectFromNakijk(opties, nakijk);
    if (correctIdx < 0) return;
    const info = analyzeJob(opties, correctIdx);
    jobs.push({ vraagIndex: i, correctIdx, ...info });
  });

  const targets = planBalancedLetters(jobs.map((j) => ({ allowed: j.allowed, fixed: j.fixed })));

  jobs.forEach((job, ji) => {
    const q = nextVragen[job.vraagIndex]!;
    const opties = q.opties!;
    const target = targets[ji] ?? job.fixed ?? job.allowed[0] ?? "A";
    const placed = placeOptions(opties, job.correctIdx, target, job.kind);
    q.opties = placed.opties;
    const correctTekst =
      placed.opties.find((o) => canonLetter(o.letter) === canonLetter(target))?.tekst ??
      opties[job.correctIdx]!.tekst;
    const nakijk = nakijkVoor(nextNakijk, q, job.vraagIndex);
    if (!nakijk) return;
    const key =
      canonLetter(placed.opties.find((o) => normText(o.tekst) === normText(correctTekst))?.letter ?? "") ||
      canonLetter(target) ||
      "A";
    // Rubriek komt uit de sleutel ná het husselen, nooit uit de LLM-letter.
    zetMcRubriek(q, nakijk, key, correctTekst);
  });

  return { vragen: nextVragen, nakijkmodel: nextNakijk };
}

/** @deprecated Gebruik shuffleMcAnswers. Blijft als alias voor bestaande aanroepen. */
export function balanceMcAntwoorden(
  vragen: Vraag[],
  nakijkmodel: NakijkItem[],
): { vragen: Vraag[]; nakijkmodel: NakijkItem[] } {
  return shuffleMcAnswers(vragen, nakijkmodel);
}

/**
 * Enige choke point vóór weergave of export.
 * Elke generatie-, bijschaf-, extra-vragen- en samenvoegstroom roept deze functie aan;
 * die roept altijd shuffleMcAnswers aan.
 */
export function finalizeVragen(
  vragen: Vraag[],
  nakijkmodel: NakijkItem[],
  opts?: { skipOrder?: boolean },
): { vragen: Vraag[]; nakijkmodel: NakijkItem[] } {
  const geordend = opts?.skipOrder
    ? { vragen, nakijkmodel }
    : ordenVragenMcEerst(vragen, nakijkmodel);
  return shuffleMcAnswers(geordend.vragen, geordend.nakijkmodel);
}
