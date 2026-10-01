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
  const eerderInGroep = new Map<string, Set<string>>();
  return vragen.map((q0) => {
    const k = titelSleutel(q0.contextTitel);
    if (!k) return q0;
    // Zinnen die al in de situatie of een eerdere vraag van deze groep stonden niet herhalen in de stam
    // (r8: "Luuk ziet op de oscilloscoop dat een toon 440 trillingen…" opnieuw vóór een andere vraag).
    const al = eerderInGroep.get(k) ?? new Set<string>();
    const intro0 = intros.get(k);
    if (intro0) for (const z of zinDelen(intro0)) al.add(zinSleutel(z));
    const delen = zinDelen(q0.stam);
    const blijf = delen.filter((z, i) => i === delen.length - 1 || !al.has(zinSleutel(z)));
    const q = blijf.length < delen.length ? { ...q0, stam: blijf.join(" ") } : q0;
    for (const z of [...zinDelen(q0.context ?? ""), ...delen]) al.add(zinSleutel(z));
    eerderInGroep.set(k, al);
    const intro = intros.get(k);
    if (!gezien.has(k)) {
      gezien.add(k);
      return intro && !q.context?.trim() ? { ...q, context: intro } : q;
    }
    return intro && q.context?.trim() === intro ? { ...q, context: "" } : q;
  });
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
