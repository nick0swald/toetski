#!/usr/bin/env node
/**
 * Eval met plaatjes (lokaal): dezelfde stappen als maakToets (src/lib/toets/maak-toets.ts) met plaatjes "met"/"auto",
 * maar in dit proces: stap 1 vragen, dan afwerken ∥ vroege figuren (plannen → maken → keuren), koppelen, extra
 * figuurronde bij "met", eindControle, Word-pakket. De figuurbank wordt NIET gebruikt (geen schrijfacties op gedeelde opslag).
 * Kosten: alle xAI-aanroepen (tekst, keuring, Imagine) via een fetch-teller; stopt als het plafond (--max-usd) bereikt is.
 *
 *   node scripts/eval/met-plaatjes.mjs <input.json> --naam <map> [--max-usd 1.0]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(ROOT, "src") } });
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const pad = args[0];
const naam = opt("naam", "plaatjes");
const maxUsd = Number(opt("max-usd", "1.0"));
const c = JSON.parse(readFileSync(pad, "utf8"));
const caseNaam = c.case ?? basename(pad, ".json");
const uit = join(ROOT, "eval-out", naam);
mkdirSync(uit, { recursive: true });

// ── Kostenteller over alle xAI-aanroepen ─────────────────────────────────────────────────────────
const teller = { usd: 0, perPad: {}, beelden: 0, aanroepen: 0 };
const BEELD_USD = 0.04; // grok-imagine-image-2.0, 1K (docs.x.ai/developers/pricing, okt 2026)
const echteFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (!u.includes("api.x.ai")) return echteFetch(url, init);
  if (teller.usd >= maxUsd) throw new Error(`kostenplafond $${maxUsd} bereikt (${teller.usd.toFixed(3)})`);
  const res = await echteFetch(url, init);
  teller.aanroepen++;
  const padNaam = u.replace(/^.*\/v1/, "");
  try {
    const body = await res.clone().json();
    let usd = 0;
    const t = body?.usage?.cost_in_usd_ticks;
    if (typeof t === "number" && t > 0) usd = t / 1e10;
    else if (padNaam.startsWith("/images")) { usd = BEELD_USD * (body?.data?.length ?? 1); }
    else if (body?.usage) usd = ((body.usage.prompt_tokens ?? 0) * 2 + (body.usage.completion_tokens ?? 0) * 6) / 1e6;
    if (padNaam.startsWith("/images")) teller.beelden += body?.data?.length ?? 1;
    teller.usd += usd;
    const k = (teller.perPad[padNaam] ??= { usd: 0, n: 0 });
    k.usd += usd; k.n++;
  } catch { /* stream/geen json */ }
  return res;
};

const G = await jiti.import(join(ROOT, "src/lib/toets/generate.ts"));
const { generateInputSchema } = await jiti.import(join(ROOT, "src/lib/toets/schema.ts"));
const { nieuweKosten, telOp } = await jiti.import(join(ROOT, "src/lib/toets/llm.ts"));
const { TIJD, rttiDoelVoor } = await jiti.import(join(ROOT, "src/lib/toets/config.ts"));
const { verwerkFiguren } = await jiti.import(join(ROOT, "src/lib/toets/figuren/verwerk.ts"));
const { koppelVroegeFiguren } = await jiti.import(join(ROOT, "src/lib/toets/figuren/vroeg.ts"));
const { zonderLegacyFiguren } = await jiti.import(join(ROOT, "src/lib/toets/figuren/bevriezing.ts"));
const { figuurDeadline, eersteRondeEinde, MAX_TOTAAL_MS } = await jiti.import(join(ROOT, "src/lib/toets/voortgang.ts"));
const { eindControle } = await jiti.import(join(ROOT, "src/lib/toets/eind-controle.ts"));
const { MAX_FIGUREN_PER_TOETS, MAX_SFEERPLATEN_PER_TOETS, parseFiguurSpec } = await jiti.import(join(ROOT, "src/lib/toets/figuren/spec.ts"));
const xai = await jiti.import(join(ROOT, "src/lib/toets/figuren/xai.server.ts"));
const { PLANNER_SYSTEM, plannerUser } = await jiti.import(join(ROOT, "src/lib/toets/figuren/prompts.ts"));
const { maakFiguurMetKeuring } = await jiti.import(join(ROOT, "src/lib/toets/figuren/pijplijn.ts"));
const png = await jiti.import(join(ROOT, "src/lib/toets/figuren/png.server.ts"));
const jpeg = await jiti.import(join(ROOT, "src/lib/toets/figuren/jpeg.server.ts"));
const { MET_DOEL_FIGUREN, MIN_MET_GEPLAATST } = await jiti.import(join(ROOT, "src/lib/toets/maak-toets.ts")).catch(() => ({ MET_DOEL_FIGUREN: 3, MIN_MET_GEPLAATST: 2 }));

const log = [];
const L = (...a) => { const s = a.join(" "); log.push(s); console.log(s); };

// Zelfde logica als planFiguren / maakFiguur (figuur-pipeline.ts), zonder figuurbank.
async function plan(data) {
  try {
    const raw = await xai.vraagJson(PLANNER_SYSTEM, plannerUser({ vak: data.vak, vragen: data.vragen, nakijk: data.nakijkmodel, overslaan: data.overslaan, minFiguren: data.minFiguren ?? 0, afgekeurd: data.afgekeurd ?? [] }), { maxTokens: 5000, timeoutMs: Math.max(5_000, Math.min(70_000, data.timeoutMs ?? 70_000)) });
    const meldingen = [], figuren = [];
    const nummers = new Set(data.vragen.map((v) => v.nummer));
    let totaal = data.alGepland ?? 0, sfeer = data.alSfeer ?? 0;
    for (const f of Array.isArray(raw?.figuren) ? raw.figuren : []) {
      const o = f ?? {}; const nummer = Number(o.nummer);
      if (!nummers.has(nummer) || data.overslaan.includes(nummer) || figuren.some((x) => x.nummer === nummer)) continue;
      const { spec, fout } = parseFiguurSpec(o.spec);
      if (!spec) { meldingen.push(`Vraag ${nummer}: figuurspec onbruikbaar (${fout}).`); continue; }
      if (totaal >= MAX_FIGUREN_PER_TOETS) break;
      if (spec.soort === "sfeerplaat" && sfeer >= MAX_SFEERPLATEN_PER_TOETS) continue;
      if (spec.soort === "sfeerplaat") sfeer++;
      totaal++;
      const nieuweStam = typeof o.nieuweStam === "string" && o.nieuweStam.trim().length > 5 ? o.nieuweStam.trim().slice(0, 1200) : undefined;
      figuren.push({ nummer, spec, verwijst: o.vraagVerwijstAlNaarFiguur === true, nieuweStam });
    }
    L(`[figuren] gepland: ${figuren.map((f) => `${f.nummer}:${f.spec.soort}`).join(", ") || "geen"}${meldingen.length ? ` · ${meldingen.join(" ")}` : ""}`);
    return { ok: true, figuren, meldingen };
  } catch (e) { L(`[figuren] planner mislukt: ${e?.message}`); return { ok: false, error: String(e?.message ?? e) }; }
}
async function maak(opdracht, budgetMs) {
  const { spec, fout } = parseFiguurSpec(opdracht.spec);
  if (!spec) return { status: "gedropt", pogingen: 0, redenen: [`spec ongeldig: ${fout}`], log: [] };
  const r = await maakFiguurMetKeuring({ ...opdracht, spec }, {
    tekenPng: (svg, b) => png.svgNaarPng(svg, b, 1.5),
    genereerBeeld: (p, t) => xai.genereerBeeld(p, { timeoutMs: t }),
    verkleinJpeg: (b) => jpeg.verkleinJpeg(b),
    keur: (s, u, beeld, t, o) => xai.keurMetVisie(s, u, beeld, { timeoutMs: t, reasoningEffort: o?.snel ? "low" : undefined }),
    vraagJson: (s, u, t) => xai.vraagJson(s, u, { timeoutMs: t, maxTokens: 3000 }),
    nu: () => Date.now(), nieuwId: () => crypto.randomUUID(), bank: undefined,
  }, { budgetMs: budgetMs == null ? undefined : Math.max(3_000, Math.min(165_000, Math.round(budgetMs))) }).catch((e) => ({ status: "gedropt", pogingen: 0, redenen: [`fout: ${e?.message}`], log: [] }));
  L(`[figuur] vraag ${opdracht.vraag.nummer} ${spec.soort}: ${r.status} na ${r.pogingen} poging(en)${r.status === "go" ? "" : ` — ${(r.redenen ?? []).join("; ").slice(0, 300)}`}${r.log?.length ? ` · log: ${r.log.map((l) => `${l.poging}:${l.besluit}${l.redenen?.length ? `(${l.redenen.join("; ").slice(0, 160)})` : ""}`).join(" | ")}` : ""}`);
  return r;
}
const deps = { plan, maak, nu: () => Date.now() };

const modus = c.input.plaatjes === "auto" ? "auto" : "met";
const verplicht = modus === "met";
const input = { ...c.input, metPlaatjes: true, plaatjes: modus, rttiDoel: rttiDoelVoor(c.input.leerjaar, c.input.moeilijkheid) };
const data = generateInputSchema.parse(input);
const t0 = Date.now();
const k1 = nieuweKosten();
const r = await G._intern.genereerRuw(data, k1);
const tVragen = Date.now();
L(`vragen ${((tVragen - t0) / 1000).toFixed(1)} s · ${r.payload.vragen.length} ruwe vragen · planroute ${r.payload.bouwplan ? (r.payload.bouwplan.route ?? "plan-first") : "oude route"} · $${teller.usd.toFixed(3)}`);

const deadline = verplicht ? Math.min(figuurDeadline(t0, tVragen), eersteRondeEinde(t0, tVragen)) : figuurDeadline(t0, tVragen);
const vragenRuw = G.ruweVragen(r.payload);
const uniek = new Set(vragenRuw.map((q) => q.nummer)).size === vragenRuw.length;
const voorlopig = {
  id: "voorlopig", createdAt: new Date().toISOString(), bronmateriaal: r.bron, extraEisen: data.extraEisen ?? "", ronde: 1, cijferNorm: data.cijferNorm,
  meta: { ...r.payload.meta, vak: data.vak?.trim() || r.payload.meta.vak || "NaSk" },
  vragen: vragenRuw, nakijkmodel: r.payload.nakijkmodel,
  cesuur: { nTerm: 1, cesuurPunten: 0, toelichting: "", formule: "" }, matrijs: { cellen: {} }, kwaliteit: { samenvatting: "", punten: [] },
};
const vroegP = uniek ? verwerkFiguren(voorlopig, deps, { deadline, ...(verplicht ? { minFiguren: MET_DOEL_FIGUREN } : {}) }).catch((e) => { L(`[figuren] vroeg mislukt: ${e?.message}`); return null; }) : Promise.resolve(null);
const afInput = { ...input, bronmateriaal: "", bronUrl: undefined, antwoordenmateriaal: (input.antwoordenmateriaal ?? "").slice(0, 30000), stuurdocument: undefined };
const k2 = nieuweKosten();
const tA = Date.now();
let toets = await G._intern.rondAf(generateInputSchema.parse(afInput), r.bron, r.payload, TIJD.afwerkBudgetMs, k2);
const tAf = Date.now();
L(`afwerken ${((tAf - tA) / 1000).toFixed(1)} s · $${teller.usd.toFixed(3)}`);
toets.kosten = { ...telOp(k1, k2), duurVragenMs: tVragen - t0, duurAfwerkenMs: tAf - tA };
try {
  const vroeg = await vroegP;
  toets = await koppelVroegeFiguren(toets, vroeg ? { ruw: vragenRuw, resultaat: vroeg } : null, deps, { deadline });
} catch (e) {
  L(`[figuren] koppelen mislukt: ${e?.message}`);
  toets = { ...toets, vragen: toets.vragen.map(zonderLegacyFiguren), figuurPijplijn: 1, figuurRapport: { versie: 1, items: [], meldingen: [String(e?.message)] } };
}
if (verplicht) {
  const harde = t0 + MAX_TOTAAL_MS;
  for (let ronde = 0; ronde < 2; ronde++) {
    const geplaatst = toets.vragen.filter((q) => q.figuur).length;
    if (geplaatst >= MIN_MET_GEPLAATST || harde - Date.now() < 22_000) break;
    const afgekeurd = [...new Set((toets.figuurRapport?.items ?? []).filter((i) => i.status === "gedropt").map((i) => i.nummer))];
    L(`[figuren] extra ronde ${ronde + 1}: ${geplaatst} geplaatst, afgekeurd ${afgekeurd.join(",")}`);
    try { toets = await verwerkFiguren(toets, deps, { deadline: harde, minFiguren: MET_DOEL_FIGUREN - geplaatst, afgekeurd }); } catch { break; }
    if (toets.vragen.filter((q) => q.figuur).length === geplaatst && harde - Date.now() < 30_000) break;
  }
}
toets = eindControle(toets);
const t2 = Date.now();
toets.figuurRapport = { ...(toets.figuurRapport ?? { versie: 1, items: [], meldingen: [] }), tijden: { vragenMs: tVragen - t0, afwerkenMs: tAf - tA, figurenMs: t2 - tVragen, totaalMs: t2 - t0 } };
writeFileSync(join(uit, `${caseNaam}.json`), JSON.stringify(toets, null, 1));
const { Packer } = await jiti.import("docx");
const { pakketDocument } = await jiti.import(join(ROOT, "src/lib/toets/docx-export.ts"));
writeFileSync(join(uit, `${caseNaam}.docx`), await Packer.toBuffer(await pakketDocument(toets)));
// Geplaatste figuren los bewaren voor de eigen go/no-go-controle (bytes ongewijzigd).
for (const q of toets.vragen.filter((q) => q.figuur)) writeFileSync(join(uit, `${caseNaam}.fig-v${q.nummer}.${q.figuur.mime === "image/png" ? "png" : "jpg"}`), Buffer.from(q.figuur.data, "base64"));
const meta = {
  case: caseNaam, naam, modus, planRoute: r.payload.bouwplan ? (r.payload.bouwplan.route ?? "plan-first") : "oude route",
  tijden: toets.figuurRapport.tijden, vragen: toets.vragen.length, punten: toets.vragen.reduce((s, q) => s + q.punten, 0),
  figuren: toets.vragen.filter((q) => q.figuur).map((q) => ({ nummer: q.nummer, soort: q.figuur.soort, bron: q.figuur.bron, pogingen: q.figuur.pogingen, keuring: q.figuur.keuring })),
  figuurRapport: { items: toets.figuurRapport.items, meldingen: toets.figuurRapport.meldingen },
  tekenvak: toets.vragen.filter((q) => q.tekenvak).map((q) => q.nummer),
  kostenTeller: teller, kostenToetsUsd: toets.kosten?.usd,
};
writeFileSync(join(uit, `${caseNaam}.meta.json`), JSON.stringify(meta, null, 1));
writeFileSync(join(uit, `${caseNaam}.log`), log.join("\n"));
L(`klaar ${((t2 - t0) / 1000).toFixed(0)} s · ${meta.vragen} vragen/${meta.punten} p · ${meta.figuren.length} figuren · totaal $${teller.usd.toFixed(3)} (${teller.beelden} Imagine-beelden)`);
L(`→ ${join(uit, caseNaam)}.{json,docx,meta.json}`);
