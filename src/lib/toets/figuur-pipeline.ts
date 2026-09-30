import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { nakijkSchema, vraagSchema } from "./schema";
import type { FiguurSpec, NakijkItem, Vraag } from "./types";
import type { FiguurUitkomst } from "./figuren/pijplijn";
import { MAX_FIGUREN_PER_TOETS, MAX_SFEERPLATEN_PER_TOETS, parseFiguurSpec } from "./figuren/spec";

/**
 * Serverfuncties van de beeldpijplijn. Elke figuur is een eigen aanroep (eigen Vercel-functie,
 * eigen 180 s-budget), zodat figuren parallel lopen en de toetsgeneratie zelf niet vertragen
 * of breken. Server-only modules worden dynamisch geladen (niet in de client-bundle).
 */

const planInput = z.object({
  vak: z.string().max(80).optional().default(""),
  vragen: z.array(vraagSchema).min(1).max(80),
  nakijkmodel: z.array(nakijkSchema).max(80).default([]),
  /** Vraagnummers die al een figuur (bestaand of goedgekeurd) hebben. */
  overslaan: z.array(z.coerce.number()).max(80).default([]),
  /** Aantal figuren dat al vastligt (telt mee voor het maximum). */
  alGepland: z.coerce.number().int().min(0).max(20).default(0),
  alSfeer: z.coerce.number().int().min(0).max(20).default(0),
});

export interface GeplandeFiguur {
  nummer: number;
  spec: FiguurSpec;
  verwijst: boolean;
  nieuweStam?: string;
}

export const planFiguren = createServerFn({ method: "POST" })
  .validator((input: unknown) => planInput.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; figuren: GeplandeFiguur[]; meldingen: string[] } | { ok: false; error: string }> => {
    try {
      const { vraagJson } = await import("./figuren/xai.server");
      const { PLANNER_SYSTEM, plannerUser } = await import("./figuren/prompts");
      const raw = (await vraagJson(
        PLANNER_SYSTEM,
        plannerUser({ vak: data.vak, vragen: data.vragen as Vraag[], nakijk: data.nakijkmodel as NakijkItem[], overslaan: data.overslaan }),
        { maxTokens: 5000, timeoutMs: 70_000 },
      )) as { figuren?: unknown[] };
      const meldingen: string[] = [];
      const figuren: GeplandeFiguur[] = [];
      const nummers = new Set(data.vragen.map((v) => v.nummer));
      let totaal = data.alGepland;
      let sfeer = data.alSfeer;
      for (const f of Array.isArray(raw?.figuren) ? raw.figuren : []) {
        const o = (f ?? {}) as Record<string, unknown>;
        const nummer = Number(o.nummer);
        if (!nummers.has(nummer) || data.overslaan.includes(nummer) || figuren.some((x) => x.nummer === nummer)) continue;
        const { spec, fout } = parseFiguurSpec(o.spec);
        if (!spec) {
          meldingen.push(`Vraag ${nummer}: figuurspec onbruikbaar (${fout}).`);
          continue;
        }
        if (totaal >= MAX_FIGUREN_PER_TOETS) break;
        if (spec.soort === "sfeerplaat" && sfeer >= MAX_SFEERPLATEN_PER_TOETS) continue;
        if (spec.soort === "sfeerplaat") sfeer++;
        totaal++;
        const nieuweStam = typeof o.nieuweStam === "string" && o.nieuweStam.trim().length > 5 ? o.nieuweStam.trim().slice(0, 1200) : undefined;
        figuren.push({ nummer, spec, verwijst: o.vraagVerwijstAlNaarFiguur === true, nieuweStam });
      }
      return { ok: true, figuren, meldingen };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "planner mislukt" };
    }
  });

const maakInput = z.object({
  vraag: vraagSchema,
  nakijk: nakijkSchema.optional(),
  spec: z.unknown(),
  legacy: z.boolean().default(false),
  verwijst: z.boolean().default(false),
  nieuweStam: z.string().max(1500).optional(),
});

export const maakFiguur = createServerFn({ method: "POST" })
  .validator((input: unknown) => maakInput.parse(input))
  .handler(async ({ data }): Promise<FiguurUitkomst> => {
    try {
      const { spec, fout } = parseFiguurSpec(data.spec);
      if (!spec) return { status: "gedropt", pogingen: 0, redenen: [`spec ongeldig: ${fout}`], log: [] };
      const [{ maakFiguurMetKeuring }, png, jpeg, xai] = await Promise.all([
        import("./figuren/pijplijn"),
        import("./figuren/png.server"),
        import("./figuren/jpeg.server"),
        import("./figuren/xai.server"),
      ]);
      return await maakFiguurMetKeuring(
        {
          vraag: data.vraag as Vraag,
          nakijk: data.nakijk as NakijkItem | undefined,
          spec,
          legacy: data.legacy,
          verwijst: data.verwijst,
          nieuweStam: data.nieuweStam,
        },
        {
          tekenPng: (svg, breedte) => png.svgNaarPng(svg, breedte),
          genereerBeeld: (prompt, timeoutMs) => xai.genereerBeeld(prompt, { timeoutMs }),
          verkleinJpeg: (bytes) => jpeg.verkleinJpeg(bytes),
          keur: (system, user, beeld, timeoutMs) => xai.keurMetVisie(system, user, beeld, { timeoutMs }),
          vraagJson: (system, user, timeoutMs) => xai.vraagJson(system, user, { timeoutMs, maxTokens: 3000 }),
          nu: () => Date.now(),
          nieuwId: () => crypto.randomUUID(),
        },
      );
    } catch (err) {
      return {
        status: "gedropt",
        pogingen: 0,
        redenen: [`serverfout: ${err instanceof Error ? err.message.slice(0, 160) : "onbekend"}`],
        log: [],
      };
    }
  });
