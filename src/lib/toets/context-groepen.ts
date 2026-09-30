import type { NakijkItem, Vraag } from "./types";

/**
 * Doorlopende contexten (examenstijl): vragen met dezelfde contextTitel horen bij elkaar.
 * De inleiding staat alleen in `context` van de eerste vraag van de groep.
 */

export type Volgorde = "mc-eerst" | "blokken" | "behoud";

const titelSleutel = (t?: string) => (t ?? "").trim().toLowerCase();

/** Gedeelde inleiding van de groep waar deze vraag bij hoort (voor controle en reparatie). */
export function groepIntro(vragen: Vraag[], q: Vraag): { titel: string; intro: string } | undefined {
  const k = titelSleutel(q.contextTitel);
  if (!k) return undefined;
  const eerste = vragen.find((x) => titelSleutel(x.contextTitel) === k && x.context?.trim());
  if (!eerste || eerste.nummer === q.nummer) return undefined;
  return { titel: q.contextTitel!.trim(), intro: eerste.context!.trim() };
}

/**
 * Groepen heel maken: de inleiding staat bij de eerste vraag van elke groep (ook als die eerste vraag is
 * verwijderd of vervangen), en niet nog eens bij de volgende vragen. `vorige` = de lijst vóór een wijziging.
 */
export function herstelGroepen(vragen: Vraag[], vorige: Vraag[] = []): Vraag[] {
  const intros = new Map<string, string>();
  for (const q of [...vorige, ...vragen]) {
    const k = titelSleutel(q.contextTitel);
    if (k && q.context?.trim() && !intros.has(k)) intros.set(k, q.context.trim());
  }
  const gezien = new Set<string>();
  const eerderInGroep = new Map<string, string[]>();
  return vragen.map((q0) => {
    const k = titelSleutel(q0.contextTitel);
    // Losse vraag: een zin uit de eigen context niet (bijna) letterlijk herhalen in de stam.
    if (!k) return q0.context?.trim() ? { ...q0, stam: zonderHerhaling([q0.context], q0.stam) } : q0;
    // Zinnen die al in de situatie of een eerdere vraag van deze groep stonden niet herhalen in de stam
    // (r8: "Luuk ziet op de oscilloscoop dat een toon 440 trillingen…" opnieuw vóór een andere vraag).
    const al = eerderInGroep.get(k) ?? [];
    const intro0 = intros.get(k);
    const eigen = q0.context?.trim() ? [q0.context] : [];
    const stam = zonderHerhaling([...(intro0 ? [intro0] : []), ...eigen, ...al], q0.stam);
    const q = stam !== q0.stam ? { ...q0, stam } : q0;
    eerderInGroep.set(k, [...al, ...zinDelen(q0.context ?? ""), ...zinDelen(q0.stam)]);
    const intro = intros.get(k);
    if (!gezien.has(k)) {
      gezien.add(k);
      return intro && !q.context?.trim() ? { ...q, context: intro } : q;
    }
    return intro && q.context?.trim() === intro ? { ...q, context: "" } : q;
  });
}

const HERHAAL_STOP = new Set(["de", "het", "een", "en", "in", "op", "met", "van", "zijn", "haar", "hij", "zij", "ze", "die", "dat", "dit", "deze"]);
function woordenVan(z: string): string[] {
  return zinSleutel(z).split(" ").filter((w) => w && !HERHAAL_STOP.has(w));
}

/** Zit (bijna) de hele zin al in een van de eerdere zinnen? (≥ 80 % van de woorden, minstens 3 woorden) */
export function isHerhaling(zin: string, eerder: string[]): boolean {
  const w = woordenVan(zin);
  if (w.length < 3) return false;
  return eerder.some((e) => {
    const set = new Set(woordenVan(e));
    return w.filter((x) => set.has(x)).length / w.length >= 0.8;
  });
}

/**
 * Situatiezinnen die (bijna) letterlijk al in de context stonden uit de stam halen; de laatste zin
 * (de vraag/opdracht) blijft altijd staan.
 */
export function zonderHerhaling(eerder: string[], stam: string): string {
  const zinnen = eerder.flatMap(zinDelen);
  const delen = zinDelen(stam);
  if (delen.length < 2) return stam;
  const blijf = delen.filter((z, i) => i === delen.length - 1 || /\?\s*$/.test(z) || !isHerhaling(z, zinnen));
  return blijf.length < delen.length ? blijf.join(" ") : stam;
}

function zinDelen(t: string): string[] {
  return (t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []).map((z) => z.trim()).filter(Boolean);
}

function zinSleutel(z: string): string {
  return z.toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, " ").trim();
}

export function heeftGroepen(vragen: Vraag[]): boolean {
  return vragen.some((q) => q.contextTitel?.trim());
}

const isJn = (q: Vraag) => q.type === "juist-onjuist";
const isMc = (q: Vraag) => q.type === "meerkeuze" || q.type === "juist-onjuist";

/**
 * Volgorde met groepen als één blok:
 * - mc-eerst: losse meerkeuze/juist-onjuist eerst, daarna de rest (groepen blijven heel);
 * - blokken (BB): losse juist/onjuist → losse meerkeuze → open vragen en contexten;
 * - behoud: alleen groepen aaneensluitend maken.
 * Nummers 1…n en het nakijkmodel lopen mee.
 */
export function ordenVragen(
  vragen: Vraag[],
  nakijkmodel: NakijkItem[],
  volgorde: Volgorde = "mc-eerst",
): { vragen: Vraag[]; nakijkmodel: NakijkItem[] } {
  if (vragen.length < 2) return { vragen, nakijkmodel };
  const units: Vraag[][] = [];
  const perTitel = new Map<string, Vraag[]>();
  for (const q of vragen) {
    const k = titelSleutel(q.contextTitel);
    if (!k) {
      units.push([q]);
      continue;
    }
    const u = perTitel.get(k);
    if (u) u.push(q);
    else {
      const nieuw = [q];
      perTitel.set(k, nieuw);
      units.push(nieuw);
    }
  }
  const los = (u: Vraag[]) => u.length === 1 && !u[0]!.contextTitel?.trim();
  let geordend: Vraag[][];
  if (volgorde === "behoud") geordend = units;
  else if (volgorde === "blokken")
    geordend = [
      ...units.filter((u) => los(u) && isJn(u[0]!)),
      ...units.filter((u) => los(u) && isMc(u[0]!) && !isJn(u[0]!)),
      ...units.filter((u) => !(los(u) && isMc(u[0]!))),
    ];
  else geordend = [...units.filter((u) => los(u) && isMc(u[0]!)), ...units.filter((u) => !(los(u) && isMc(u[0]!)))];
  const plat = herstelGroepen(geordend.flat(), vragen);
  const byOld = new Map(nakijkmodel.map((n) => [n.nummer, n]));
  return {
    vragen: plat.map((q, i) => ({ ...q, nummer: i + 1 })),
    nakijkmodel: plat.map((q, i) => {
      const old = byOld.get(q.nummer);
      return old ? { ...old, nummer: i + 1 } : { nummer: i + 1, modelantwoord: "", puntenverdeling: [], nietToekennen: [] };
    }),
  };
}

/** Titel tonen vóór deze vraag? (eerste vraag van een groep) */
export function startGroep(vragen: Vraag[], i: number): string | undefined {
  const q = vragen[i];
  const t = q?.contextTitel?.trim();
  if (!t) return undefined;
  return i === 0 || titelSleutel(vragen[i - 1]!.contextTitel) !== titelSleutel(t) ? t : undefined;
}
