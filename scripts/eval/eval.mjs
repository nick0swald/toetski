#!/usr/bin/env node
/**
 * Offline eval-harnas voor Toetski (zie scripts/eval/README.md).
 *
 *   node scripts/eval/eval.mjs genereer <case> [--naam N] [--base URL]     # 1 generatie via de site (kost API-tokens)
 *   node scripts/eval/eval.mjs genereer <case> --lokaal [--naam N]         # zelfde stappen lokaal (code van deze checkout, XAI_API_KEY)
 *   node scripts/eval/eval.mjs plan <case>                                 # alleen het bouwplan (1 goedkope aanroep)
 *   node scripts/eval/eval.mjs scoor <toets.json> --case <case> [--rechter] [--baseline scores.json]
 *   node scripts/eval/eval.mjs poort <scores-nieuw.json> <scores-baseline.json>
 *
 * "genereer" roept dezelfde server-functies aan als de app (stap 1 vragen → stap 2 afwerken; zonder
 * plaatjes), op productie of een preview (--base), en draait daarna lokaal de client-stap
 * (eindControle + zonderPlaatjes) en het Word-pakket. Uitvoer: eval-out/<naam>/<case>.{json,docx,meta.json}.
 * "scoor" is volledig offline (code-rubriek), behalve met --rechter (1 grok-4.5-aanroep, vaste prompt).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(ROOT, "src") } });
const args = process.argv.slice(2);
const opt = (naam, standaard) => {
  const i = args.indexOf(`--${naam}`);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true) : standaard;
};
const leesJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const caseInput = (naam) => leesJson(join(ROOT, "scripts", "eval", "inputs", `${naam}.json`));

/** TanStack Start server-fn-id = sha256("<bestand>--<export>_createServerFn_handler"). */
const fnId = (bestand, naam) => createHash("sha256").update(`${bestand}--${naam}_createServerFn_handler`).digest("hex");

async function serverFn(base, id, data) {
  const { toJSONAsync, fromCrossJSON } = await import("seroval");
  const body = JSON.stringify(await toJSONAsync({ data }));
  const r = await fetch(`${base}/_serverFn/${id}`, {
    method: "POST",
    headers: { origin: base, referer: `${base}/`, "sec-fetch-site": "same-origin", "x-tsr-serverFn": "true", accept: "application/json", "content-type": "application/json" },
    body,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${txt.slice(0, 300)}`);
  const out = fromCrossJSON(JSON.parse(txt), { refs: new Map() });
  if (out?.error) throw new Error(String(out.error?.message ?? out.error));
  return out.result;
}

async function genereer(caseNaam) {
  const base = opt("base", process.env.EVAL_BASE ?? "https://www.toetski.nl");
  const naam = opt("naam", new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"));
  const uit = join(ROOT, "eval-out", naam);
  mkdirSync(uit, { recursive: true });
  const { rttiDoelVoor } = await jiti.import(join(ROOT, "src/lib/toets/config.ts"));
  const c = caseInput(caseNaam);
  // Zoals het formulier: RTTI-doel = standaarddoel voor de klas (geen handmatige override).
  const input = { ...c.input, rttiDoel: rttiDoelVoor(c.input.leerjaar, c.input.moeilijkheid) };
  const F = "src/lib/toets/generate.ts";
  const lokaal = opt("lokaal", false);
  const t0 = Date.now();
  let ruw, af;
  if (lokaal) {
    // Zelfde stappen als generateVragenRuw + afwerkToets, maar in dit proces (code van deze checkout).
    const G = await jiti.import(join(ROOT, F));
    const { generateInputSchema } = await jiti.import(join(ROOT, "src/lib/toets/schema.ts"));
    const { nieuweKosten } = await jiti.import(join(ROOT, "src/lib/toets/llm.ts"));
    const data = generateInputSchema.parse(input);
    const k1 = nieuweKosten();
    try {
      const r = await G._intern.genereerRuw(data, k1);
      ruw = { ok: true, ...r, kosten: k1, duurMs: Date.now() - t0 };
    } catch (e) {
      ruw = { ok: false, error: String(e?.message ?? e) };
    }
  } else {
    ruw = await serverFn(base, fnId(F, "generateVragenRuw"), input);
  }
  const tVragen = Date.now();
  console.log(`vragen ${((tVragen - t0) / 1000).toFixed(1)} s`, ruw?.ok ? "ok" : ruw?.error);
  if (!ruw?.ok) process.exit(1);
  const afInput = { ...input, bronmateriaal: "", bronUrl: undefined, antwoordenmateriaal: (input.antwoordenmateriaal ?? "").slice(0, 30000), stuurdocument: undefined };
  if (lokaal) {
    const G = await jiti.import(join(ROOT, F));
    const { generateInputSchema } = await jiti.import(join(ROOT, "src/lib/toets/schema.ts"));
    const { nieuweKosten } = await jiti.import(join(ROOT, "src/lib/toets/llm.ts"));
    const { TIJD } = await jiti.import(join(ROOT, "src/lib/toets/config.ts"));
    const k2 = nieuweKosten();
    const t = Date.now();
    const toets = await G._intern.rondAf(generateInputSchema.parse(afInput), ruw.bron, ruw.payload, TIJD.afwerkBudgetMs, k2);
    toets.kosten = { ...k2, duurAfwerkenMs: Date.now() - t };
    af = { ok: true, toets };
  } else {
    af = await serverFn(base, fnId(F, "afwerkToets"), { input: afInput, bron: ruw.bron, payload: ruw.payload, verstrekenMs: tVragen - t0 });
  }
  const tAf = Date.now();
  console.log(`afwerken ${((tAf - tVragen) / 1000).toFixed(1)} s`, af?.ok ? "ok" : af?.error);
  if (!af?.ok) process.exit(1);
  const { eindControle } = await jiti.import(join(ROOT, "src/lib/toets/eind-controle.ts"));
  const { zonderPlaatjes } = await jiti.import(join(ROOT, "src/lib/toets/figuren/vroeg.ts"));
  const { telOp } = await jiti.import(join(ROOT, "src/lib/toets/llm.ts"));
  let toets = af.toets;
  if (ruw.kosten || toets.kosten) toets = { ...toets, kosten: { ...telOp(ruw.kosten, toets.kosten), duurVragenMs: ruw.duurMs, duurAfwerkenMs: toets.kosten?.duurAfwerkenMs } };
  toets = eindControle(zonderPlaatjes(toets));
  toets.figuurRapport = { ...(toets.figuurRapport ?? { versie: 1, items: [], meldingen: [] }), tijden: { vragenMs: tVragen - t0, afwerkenMs: tAf - tVragen, totaalMs: tAf - t0 } };
  writeFileSync(join(uit, `${caseNaam}.json`), JSON.stringify(toets, null, 1));
  const { Packer } = await jiti.import("docx");
  const { pakketDocument } = await jiti.import(join(ROOT, "src/lib/toets/docx-export.ts"));
  writeFileSync(join(uit, `${caseNaam}.docx`), await Packer.toBuffer(await pakketDocument(toets)));
  if (ruw.payload?.bouwplan) writeFileSync(join(uit, `${caseNaam}.bouwplan.json`), JSON.stringify(ruw.payload.bouwplan, null, 1));
  const meta = { case: caseNaam, base: lokaal ? "lokaal" : base, naam, start: new Date(t0).toISOString(), tijden: toets.figuurRapport.tijden, kosten: toets.kosten ?? null, vragen: toets.vragen.length, punten: toets.vragen.reduce((s, q) => s + q.punten, 0) };
  writeFileSync(join(uit, `${caseNaam}.meta.json`), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify(meta, null, 1));
  console.log(`→ ${join(uit, caseNaam)}.{json,docx,meta.json}`);
}

async function planCmd(caseNaam) {
  const G = await jiti.import(join(ROOT, "src/lib/toets/generate.ts"));
  const B = await jiti.import(join(ROOT, "src/lib/toets/bouwplan.ts"));
  const { generateInputSchema } = await jiti.import(join(ROOT, "src/lib/toets/schema.ts"));
  const { nieuweKosten } = await jiti.import(join(ROOT, "src/lib/toets/llm.ts"));
  const { rttiDoelVoor } = await jiti.import(join(ROOT, "src/lib/toets/config.ts"));
  const c = caseInput(caseNaam);
  const v = await G.bereidVoor(generateInputSchema.parse({ ...c.input, rttiDoel: rttiDoelVoor(c.input.leerjaar, c.input.moeilijkheid) }));
  const quota = G.planQuotaVoor(v);
  if (!quota) throw new Error("geen plan-first voor deze invoer");
  console.log(JSON.stringify(quota));
  const kosten = nieuweKosten();
  const t0 = Date.now();
  const plan = await B.maakBouwplan({ system: v.system, voorvoegsel: v.basisPrompt, quota, rest: () => 120_000, kosten });
  const ms = Date.now() - t0;
  let uitPlan = plan;
  const check = await jiti.import(join(ROOT, "src/lib/toets/bouwplan-check.ts")).catch(() => null);
  if (check?.herstelBouwplan) {
    const h = check.herstelBouwplan(plan, quota);
    uitPlan = h.plan;
    console.log("Plancontrole:", JSON.stringify(h.issues.map((i) => `${i.code}: ${i.detail}`)));
    const t1 = Date.now();
    const k = await B.kritiseerBouwplan({ system: v.system, voorvoegsel: v.basisPrompt, plan: uitPlan, rest: () => 120_000, kosten });
    console.log(`Kritiek ${((Date.now() - t1) / 1000).toFixed(1)} s:`, k.vervangen);
    if (k.vervangen.length) uitPlan = check.herstelBouwplan(k.plan, quota).plan;
  }
  for (const it of uitPlan.items) console.log(B.planRegel(it));
  console.log("reserve:");
  for (const it of uitPlan.reserve) console.log(B.planRegel(it));
  console.log(`plan ${(ms / 1000).toFixed(1)} s · $${kosten.usd.toFixed(4)} · uit ${kosten.tokensUit} tok (redeneren ${kosten.tokensRedeneren})`);
  mkdirSync(join(ROOT, "eval-out"), { recursive: true });
  writeFileSync(join(ROOT, "eval-out", `plan-${caseNaam}.json`), JSON.stringify({ quota, plan, hersteld: uitPlan, ms, kosten }, null, 1));
}

async function rechter(toets, input) {
  const R = await jiti.import(join(ROOT, "src/lib/toets/eval/rubric.ts"));
  const { MODELLEN } = await jiti.import(join(ROOT, "src/lib/toets/config.ts"));
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY ontbreekt (nodig voor --rechter)");
  const r = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(170_000),
    body: JSON.stringify({ model: MODELLEN.controle, reasoning_effort: "low", temperature: 0, max_tokens: 6000, response_format: { type: "json_object" }, messages: [{ role: "system", content: R.RECHTER_SYSTEM }, { role: "user", content: R.rechterPrompt(toets, input) }] }),
  });
  const j = await r.json();
  const oordeel = R.parseRechter(j.choices?.[0]?.message?.content ?? "");
  if (oordeel) oordeel.kostenUsd = (j.usage?.cost_in_usd_ticks ?? 0) / 1e10;
  return oordeel;
}

async function scoor(pad) {
  const R = await jiti.import(join(ROOT, "src/lib/toets/eval/rubric.ts"));
  const toets = leesJson(pad);
  const c = caseInput(opt("case"));
  const input = { ...c.input };
  // --rechter [N]: N onafhankelijke rechter-aanroepen (standaard 3), gemiddeld — één oordeel schommelt ±0,75.
  const r = opt("rechter", false);
  const n = r === true ? 3 : Number(r) || 0;
  let oordeel;
  if (n > 0) {
    const lijst = (await Promise.all(Array.from({ length: n }, () => rechter(toets, input)))).filter(Boolean);
    if (lijst.length) {
      const gem = (xs) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;
      const punten = {};
      for (const k of Object.keys(lijst[0].punten ?? {})) {
        const sc = lijst.map((o) => o.punten?.[k]?.score).filter((x) => typeof x === "number");
        punten[k] = { ...lijst[0].punten[k], score: sc.length ? gem(sc) : undefined };
      }
      oordeel = { ...lijst[0], punten, cijfer: gem(lijst.map((o) => o.cijfer ?? 0)), cijfers: lijst.map((o) => o.cijfer), kostenUsd: gem(lijst.map((o) => o.kostenUsd ?? 0)) * lijst.length, runs: lijst.length };
    }
  }
  const kaart = R.scoorToets(toets, input, oordeel);
  const uitPad = typeof opt("uit") === "string" ? opt("uit") : pad.replace(/\.json$/, ".scores.json");
  writeFileSync(uitPad, JSON.stringify({ ...kaart, rechter: oordeel ?? null, bestand: pad, case: c.case }, null, 1));
  console.log(`\n${c.case} · rubriek ${kaart.rubriekVersie}${oordeel ? ` · rechter ${oordeel.versie}` : ""}`);
  for (const x of kaart.criteria) console.log(`${String(x.punt).padStart(2)} ${x.score.toFixed(2)} ${x.naam.padEnd(46)} ${x.bron.padEnd(12)} ${x.detail}`);
  console.log("Harde criteria:");
  for (const h of kaart.hard) console.log(`  ${h.ok ? "OK  " : "FAIL"} ${h.naam} (${h.detail})`);
  console.log(`Cijfer (rubriek) ${kaart.cijfer}${oordeel?.cijfer != null ? ` · rechter ${oordeel.cijfer}${oordeel.cijfers ? ` (${oordeel.cijfers.join("/")})` : ""}` : ""} · hard ${kaart.hardOk ? "100 %" : "NIET ok"}`);
  if (oordeel?.topProblemen?.length) console.log(`Rechter top-problemen:\n- ${oordeel.topProblemen.join("\n- ")}`);
  const basisPad = opt("baseline");
  if (typeof basisPad === "string") {
    const basis = leesJson(basisPad);
    const p = R.poort(kaart, basis, { nieuw: oordeel?.cijfer, baseline: basis.rechter?.cijfer });
    console.log(`\nPOORT: ${p.ok ? "GROEN" : "ROOD"}${p.redenen.length ? ` (${p.redenen.join("; ")})` : ""}`);
    for (const x of kaart.criteria) {
      const b = basis.criteria.find((y) => y.id === x.id);
      if (b && Math.abs(b.score - x.score) >= 0.01) console.log(`  ${String(x.punt).padStart(2)} ${x.naam}: ${b.score.toFixed(2)} → ${x.score.toFixed(2)}`);
    }
  }
  console.log(`→ ${uitPad}`);
}

async function poortCmd(nieuwPad, basisPad) {
  const R = await jiti.import(join(ROOT, "src/lib/toets/eval/rubric.ts"));
  const nieuw = leesJson(nieuwPad);
  const basis = leesJson(basisPad);
  const p = R.poort(nieuw, basis, { nieuw: nieuw.rechter?.cijfer, baseline: basis.rechter?.cijfer });
  console.log(p.ok ? "POORT GROEN" : `POORT ROOD: ${p.redenen.join("; ")}`);
  process.exit(p.ok ? 0 : 1);
}

/**
 * Poort over alle cases: `poort5 <case>=<nieuw.scores.json> … --baseline-dir <map>` (baseline-bestand per case:
 * <map>/<case>.scores.json). Groen als het gemiddelde rechtercijfer ≥ gemiddelde baseline en elke case hard 100 %.
 */
async function poort5Cmd(paren) {
  const R = await jiti.import(join(ROOT, "src/lib/toets/eval/rubric.ts"));
  const dir = opt("baseline-dir");
  if (typeof dir !== "string") throw new Error("--baseline-dir ontbreekt");
  const cases = paren.map((p) => {
    const [naam, pad] = p.split("=");
    const n = leesJson(pad);
    const b = leesJson(join(dir, `${naam}.scores.json`));
    return { case: naam, pad, hardOk: n.hardOk, hardFout: n.hard.filter((h) => !h.ok).map((h) => h.id), rechter: n.rechter?.cijfer, baselineRechter: b.rechter?.cijfer };
  });
  for (const c of cases) console.log(`${c.case.padEnd(20)} rechter ${String(c.rechter).padEnd(5)} baseline ${String(c.baselineRechter).padEnd(5)} hard ${c.hardOk ? "OK" : "FAIL"}  ${c.pad}`);
  const p = R.poortGemiddeld(cases);
  console.log(`Gemiddeld: ${p.gemiddeld} vs baseline ${p.baseline}`);
  console.log(p.ok ? "POORT GROEN" : `POORT ROOD: ${p.redenen.join("; ")}`);
  process.exit(p.ok ? 0 : 1);
}

const [cmd, a1, a2] = args;
if (cmd === "genereer" && a1) await genereer(a1);
else if (cmd === "scoor" && a1) await scoor(a1);
else if (cmd === "plan" && a1) await planCmd(a1);
else if (cmd === "poort" && a1 && a2) await poortCmd(a1, a2);
else if (cmd === "poort5" && a1) await poort5Cmd(args.slice(1).filter((x) => x.includes("=") && !x.startsWith("--")));
else {
  console.log("Gebruik: genereer <case> [--naam N] [--base URL] | scoor <toets.json> --case <case> [--rechter] [--baseline scores.json] | poort <nieuw> <baseline> (per case, indicatief) | poort5 <case>=<scores.json> … --baseline-dir <map> (go-live-poort)");
  process.exit(2);
}
