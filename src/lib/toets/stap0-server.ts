/**
 * Server-functies voor de stap-0-pilot (STAP0_RENDERER, per gebruiker). Elke stap is een eigen Vercel-aanroep
 * (maxDuration 180 s); de toestand gaat ondertekend heen en weer en wordt door de client na elke stap bewaard,
 * zodat een stap na een time-out vanaf de laatste toestand opnieuw kan. Niet in de pilot of geen NaSk → de client
 * gebruikt de huidige pijplijn (fallback).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateInputSchema } from "./schema";
import type { GegenereerdeToets, JsonWaarde } from "./types";

const json = (x: unknown): JsonWaarde => JSON.parse(JSON.stringify(x ?? null)) as JsonWaarde;

const MAX_STAAT_TEKENS = 1_500_000;

export const stap0Pilot = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ pilot: z.string().max(200).optional() }).parse(input))
  .handler(async ({ data }): Promise<{ aan: boolean }> => {
    // Alleen aan/uit: het label uit STAP0_USERS blijft op de server.
    const { pilotAntwoord } = await import("./stap0/pilot.server");
    return pilotAntwoord(data.pilot);
  });

const stapInput = z.object({
  pilot: z.string().max(200).optional(),
  input: generateInputSchema.optional(),
  staat: z.unknown().optional(),
  mac: z.string().max(200).optional(),
});

export type Stap0StapAntwoord =
  | { ok: true; staat: JsonWaarde; mac: string; status: { tekst: string; fase: string; usd: number; open: number; ronde?: number }; toets?: GegenereerdeToets }
  | { ok: false; error: string; fallback: boolean; nietGelukt?: boolean };

export const stap0Stap = createServerFn({ method: "POST" })
  .validator((input: unknown) => stapInput.parse(input))
  .handler(async ({ data }): Promise<Stap0StapAntwoord> => {
    const { stap0Voor, onderteken, controleer, productieChat, logStap0, stap0VangnetUsd, gebruikerTag, zonderEmail } = await import("./stap0/pilot.server");
    const S = await import("./stap0/stappen");
    const G = await import("./stap0/grok-spec");
    const wie = stap0Voor(data.pilot);
    if (!wie) return { ok: false, error: "Stap 0 staat niet aan voor deze gebruiker.", fallback: true };
    try {
      let staat: import("./stap0/stappen").Stap0Staat;
      if (data.input) {
        const { bereidVoor } = await import("./generate");
        if ((data.input.ronde ?? 1) > 1 || data.input.feedback?.trim()) return { ok: false, error: "Feedbackronde: huidige pijplijn.", fallback: true };
        const v = await bereidVoor(data.input);
        if (!v.k) return { ok: false, error: "Geen NaSk-toets: huidige pijplijn.", fallback: true };
        const inv = { titel: v.data.titel || "Toets", leerweg: v.data.leerweg, leerjaar: v.data.leerjaar, duurMinuten: v.data.duurMinuten, bronmateriaal: v.bron, antwoordenmateriaal: v.antwoorden || undefined, rttiDoel: v.data.rttiDoel, plaatjes: data.input.plaatjes, ...G.formEisen(v.data, data.input) };
        const kal = { items: v.data.aantalVragen, punten: v.data.doelPunten, vorm: v.k.vorm, pct1p: v.k.pct1p };
        staat = S.nieuweStaat(inv, kal, crypto.randomUUID());
        staat.kalVol = { ...v.k, items: kal.items, punten: kal.punten };
        staat.cijferNorm = data.input.cijferNorm;
        logStap0("stap", { id: staat.id, start: true, wie: gebruikerTag(wie.label), items: kal.items, punten: kal.punten });
      } else {
        if (!data.staat || !data.mac) return { ok: false, error: "Niet gelukt: de toestand ontbreekt. Probeer het opnieuw.", fallback: false, nietGelukt: true };
        if (JSON.stringify(data.staat).length > MAX_STAAT_TEKENS) return { ok: false, error: "Niet gelukt: de toestand is te groot. Probeer het opnieuw met minder lesstof.", fallback: false, nietGelukt: true };
        staat = data.staat as typeof staat;
        if (!controleer(staat, data.mac)) return { ok: false, error: "Niet gelukt: de opgeslagen toestand is ongeldig. Probeer het opnieuw.", fallback: false, nietGelukt: true };
      }
      if (staat.fase === "klaar" || staat.fase === "mislukt") return { ok: false, error: staat.nietGelukt ?? "Al klaar.", fallback: false };
      const vangnetUsd = stap0VangnetUsd();
      const na = await S.voerStapUit(staat, productieChat, { log: logStap0, ...(vangnetUsd ? { budget: { vangnetUsd } } : {}) });
      const r = na.gen ? G.keurGeneratie(na.gen, na.inv, na.kal) : null;
      const status = { tekst: na.laatsteFout ? "Eerste versie mislukte; nog één poging…" : S.statusTekst(na, r ? { fouten: r.fouten.length } : undefined), fase: na.fase, usd: na.kosten.usd, open: r?.fouten.length ?? 0, ronde: na.rondes };
      // Nooit onder de spec leveren: "mislukt" = geen toets, met de reden voor de docent; geen terugval (niet dubbel betalen).
      if (na.fase === "mislukt") return { ok: false, error: na.nietGelukt ?? "Niet gelukt: de toets haalde de eisen niet.", fallback: false, nietGelukt: true };
      let toets: GegenereerdeToets | undefined;
      if (na.fase === "klaar" && na.gen && r && na.kalVol && G.voldoetAanSpec(r, na.inv, na.kal)) {
        toets = G.alsGegenereerdeToets(r.res, na.inv, na.kalVol, {
          id: `stap0-${na.id.slice(0, 8)}`,
          bronmateriaal: na.inv.bronmateriaal,
          ...(na.cijferNorm ? { cijferNorm: na.cijferNorm } : {}),
          kosten: { usd: na.kosten.usd, tokensIn: 0, tokensCache: 0, tokensUit: 0, tokensRedeneren: 0, aanroepen: na.kosten.aanroepen, mislukt: na.kosten.mislukt, perRol: {}, duurVragenMs: na.tijden.specMs },
          stap0: { versie: 1, gen: json(na.gen), inv: json(na.inv), monitoring: json(S.monitoring(na, r)) as { [k: string]: JsonWaarde } },
        });
      }
      return { ok: true, staat: json(na), mac: onderteken(na), status, toets };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logStap0("stap", { fout: msg.slice(0, 200) });
      // Na de start kan er al betaald zijn: geen terugval naar de oude pijplijn.
      return { ok: false, error: `Niet gelukt: ${zonderEmail(msg).slice(0, 300)}`, fallback: false, nietGelukt: true };
    }
  });

const bestandInput = z.object({
  pilot: z.string().max(200).optional(),
  gen: z.unknown(),
  inv: z.unknown(),
  deel: z.enum(["leerling", "docent"]),
  formaat: z.enum(["pdf", "docx"]),
  splitsen: z.boolean().optional(),
});

export const stap0Bestand = createServerFn({ method: "POST" })
  .validator((input: unknown) => bestandInput.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; naam: string; mime: string; base64: string } | { ok: false; error: string }> => {
    const { stap0Voor, zonderEmail } = await import("./stap0/pilot.server");
    if (!stap0Voor(data.pilot)) return { ok: false, error: "Stap 0 staat niet aan voor deze gebruiker." };
    try {
      if (JSON.stringify(data.gen ?? null).length > MAX_STAAT_TEKENS) return { ok: false, error: "Toets te groot." };
      const { maakStap0Bestand } = await import("./stap0/bestanden.server");
      const b = await maakStap0Bestand(data.gen as never, data.inv as never, { deel: data.deel, formaat: data.formaat, splitsen: data.splitsen });
      return { ok: true, naam: b.naam, mime: b.mime, base64: Buffer.from(b.bytes).toString("base64") };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? zonderEmail(err.message).slice(0, 300) : "Export mislukt" };
    }
  });
