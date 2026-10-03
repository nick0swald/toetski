#!/usr/bin/env node
/**
 * Betaalde testronde "Grok vult de stap-0-spec" (alleen eval-harnas; niet in de app).
 *
 *   node scripts/eval/waakhond.mjs --timeout 1200 --stil 120 --max-usd <rest> -- \
 *     node scripts/eval/stap0-ronde.mjs genereer <case> --naam paid1-g1 --uit /workspace/toetski-paid1 --budget <rest> [--rechter 3]
 *   node scripts/eval/stap0-ronde.mjs droog <case> --uit /tmp/x        # zelfde stroom met de vaste fixtures, GEEN API
 *   node scripts/eval/stap0-ronde.mjs poort <map met <case>/resultaat.json> … [--baseline-dir /workspace/eval-r2/baseline-v3]
 *
 * Per case: 1 grok-4.5-aanroep met JSON-schema (structured output) → keuring (schema, rekencontrole, figuur-go/no-go,
 * lengte, weggevers, merken/schoolnamen, letterlijk overnemen) → hooguit 1 herstelaanroep → deterministische render
 * (leerling- en docentdeel, PDF + Word) → rubriek + rechter (N runs) → resultaat.json.
 *
 * Sleutel: ALLEEN TOETSKI_XAI_API_KEY (de waakhond zet XAI_API_KEY = TOETSKI_XAI_API_KEY voor het kind). Het script
 * weigert betaalde aanroepen als die twee niet gelijk zijn. Kosten: vóór elke aanroep een worst-case-schatting tegen
 * --budget (harde stop), na elke aanroep "run-kosten $x" (de waakhond breekt af boven --max-usd) en een regel in
 * eval-out/kosten.jsonl (per aanroep).
 */
import { appendFileSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
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
const S = (p) => jiti.import(join(ROOT, "src/lib/toets", p));

const PRIJS = { in: 2.0, uit: 6.0 }; // grok-4.5, USD per 1M tokens (worst case: geen cache)
const worstCase = (promptTekens, maxTokens) => ((promptTekens / 3) * PRIJS.in + maxTokens * PRIJS.uit) / 1e6;

let runKosten = 0;
function boekKosten(soort, usd, extra = {}) {
  runKosten += usd;
  console.log(`[kosten] ${soort} $${usd.toFixed(4)} · run-kosten $${runKosten.toFixed(4)}`);
  mkdirSync(join(ROOT, "eval-out"), { recursive: true });
  appendFileSync(join(ROOT, "eval-out", "kosten.jsonl"), JSON.stringify({ t: new Date().toISOString(), script: "stap0-ronde", soort, usd, runKosten, ...extra }) + "\n");
}
/** Worst case van aanroepen die nu lopen (parallelle herstel- en rechteraanroepen tellen samen mee). */
let gereserveerd = 0;
function budgetCheck(budget, schatting, wat) {
  if (runKosten + gereserveerd + schatting > budget) {
    console.error(`[budget] STOP vóór ${wat}: run-kosten ${runKosten.toFixed(4)} + lopend ${gereserveerd.toFixed(4)} + worst case ${schatting.toFixed(4)} > budget ${budget.toFixed(4)} (USD)`);
    return false;
  }
  gereserveerd += schatting;
  return true;
}
const vrijgeven = (schatting) => (gereserveerd = Math.max(0, gereserveerd - schatting));
/** Hartslag voor de waakhond zolang er een aanroep loopt (elke aanroep heeft zelf een timeout). */
function hartslag() {
  const f = process.env.WAAKHOND_HARTSLAG;
  if (!f) return () => {};
  const t = setInterval(() => {
    try {
      utimesSync(f, new Date(), new Date());
    } catch {
      /* geen hartslagbestand */
    }
  }, 10_000);
  return () => clearInterval(t);
}

function betaaldToegestaan() {
  const k = process.env.TOETSKI_XAI_API_KEY;
  if (!k) throw new Error("TOETSKI_XAI_API_KEY ontbreekt: geen betaalde aanroepen.");
  if (process.env.XAI_API_KEY !== k) throw new Error("XAI_API_KEY ≠ TOETSKI_XAI_API_KEY: start via scripts/eval/waakhond.mjs.");
}

async function caseInvoer(caseNaam) {
  const { kalibratie, isExamenNiveau } = await S("kalibratie.ts");
  const { rttiDoelVoor } = await S("config.ts");
  const c = leesJson(join(ROOT, "scripts", "eval", "inputs", `${caseNaam}.json`));
  const i = c.input;
  const kal = kalibratie(i.leerjaar, i.leerweg, i.duurMinuten, { examen: isExamenNiveau(`${i.titel ?? ""} ${i.extraEisen ?? ""}`), moeilijkheid: i.moeilijkheid ?? "normaal" });
  const inv = { titel: i.titel, leerweg: i.leerweg, leerjaar: i.leerjaar, duurMinuten: i.duurMinuten, bronmateriaal: i.bronmateriaal, antwoordenmateriaal: i.antwoordenmateriaal || undefined, rttiDoel: rttiDoelVoor(i.leerjaar, i.moeilijkheid), moeilijkheid: i.moeilijkheid };
  return { c, inv, kal };
}

/** Echte chat via llm.ts (rol "schrijven" = grok-4.5) met JSON-schema; terugval op json_object als het schema geweigerd wordt. */
async function maakChat(budget) {
  const { xaiChat, nieuweKosten, berichten } = await S("llm.ts");
  void berichten;
  return async (messages, schema, maxTokens) => {
    const tekens = messages.reduce((s, m) => s + m.content.length, 0) + JSON.stringify(schema.schema).length;
    const sch = worstCase(tekens, maxTokens);
    if (!budgetCheck(budget, sch, schema.naam)) throw new Error("budget");
    const k = nieuweKosten();
    const stop = hartslag();
    const t0 = Date.now();
    try {
      let raw;
      try {
        raw = await xaiChat("schrijven", messages, { maxTokens, timeoutMs: 420_000, kosten: k, jsonSchema: schema });
      } catch (e) {
        if (!/xAI API error 400/.test(String(e?.message))) throw e;
        console.log(`[chat] schema geweigerd (${String(e.message).slice(0, 160)}); terugval json_object`);
        const m2 = [...messages.slice(0, -1), { role: "user", content: `${messages.at(-1).content}\n\nAntwoord met één JSON-object volgens dit schema:\n${JSON.stringify(schema.schema)}` }];
        raw = await xaiChat("schrijven", m2, { maxTokens, timeoutMs: 420_000, kosten: k });
      }
      return raw;
    } finally {
      stop();
      vrijgeven(sch);
      boekKosten(schema.naam, k.usd, { ms: Date.now() - t0, tokensIn: k.tokensIn, tokensUit: k.tokensUit, redeneren: k.tokensRedeneren, mislukt: k.mislukt });
    }
  };
}

/** Droge chat: geeft de vraagstukken uit de vaste fixtures terug (test van de hele stroom zonder API). */
async function droogChat() {
  const { laadFixtures } = await S("stap0/laad.ts");
  const vs = laadFixtures().filter((f) => f.soort === "vraagstuk");
  return async (_m, schema) => JSON.stringify(schema.naam === "toets_spec" ? { titel: "Droog", vraagstukken: vs } : { vraagstuk: vs[0] });
}

/**
 * Figuren uit het leerlingdeel als PNG (data-URL) voor de rechter: elke deterministische figuur één keer (ongeveer
 * 150 dpi), met het eerste vraagnummer waar hij bij staat. AI-afbeeldingen (staan uit in stap 0) worden overgeslagen.
 */
async function rechterFiguren(res) {
  const { figuurSvg } = await S("stap0/figuren/index.ts");
  const { pngRender } = await S("stap0/node.server.ts");
  const gezien = new Set();
  const uit = [];
  for (const q of res.vragen) {
    const f = q.figuur;
    if (!f || f.type === "ai-afbeelding") continue;
    const svg = figuurSvg(f);
    if (gezien.has(svg)) continue;
    gezien.add(svg);
    const px = Math.max(400, Math.min(1600, Math.round(((f.breedteCm ?? 10) / 2.54) * 150)));
    const png = await pngRender(svg, px);
    uit.push({ nr: q.nr, url: `data:image/png;base64,${Buffer.from(png).toString("base64")}` });
  }
  return uit.slice(0, 16);
}
/** Budget dat de generatie/herstel-aanroepen vrijlaten voor de rechter (3 runs met figuren). */
const RECHTER_RESERVE = 0.22;
const BEELD_TOKENS = 1500; // ruime schatting per afbeelding (detail high)

async function rechter(toets, input, budget, figuren = []) {
  const R = await S("eval/rubric.ts");
  const { MODELLEN } = await S("config.ts");
  const tekst = R.rechterPrompt(toets, input) + (figuren.length ? `\n\nDe figuren uit het leerlingdeel zijn hieronder als afbeeldingen bijgevoegd (figuur bij vraag N). Een vraag met [figuur] heeft dus wél een figuur: beoordeel de figuur zelf (klopt hij bij de vraag, is hij leesbaar, zijn de gevraagde waarden af te lezen) en trek géén punten af voor 'ontbrekende figuren'.` : "");
  const content = figuren.length ? [{ type: "text", text: tekst }, ...figuren.flatMap((f) => [{ type: "text", text: `Figuur bij vraag ${f.nr}` }, { type: "image_url", image_url: { url: f.url, detail: "high" } }])] : tekst;
  const sch = worstCase(tekst.length + R.RECHTER_SYSTEM.length + figuren.length * BEELD_TOKENS * 3, 6000);
  if (!budgetCheck(budget, sch, "rechter")) return null;
  const stop = hartslag();
  try {
    const r = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.TOETSKI_XAI_API_KEY}` },
      signal: AbortSignal.timeout(170_000),
      body: JSON.stringify({ model: MODELLEN.controle, reasoning_effort: "low", temperature: 0, max_tokens: 6000, response_format: { type: "json_object" }, messages: [{ role: "system", content: R.RECHTER_SYSTEM }, { role: "user", content }] }),
    });
    const j = await r.json();
    const usd = (j.usage?.cost_in_usd_ticks ?? 0) / 1e10;
    boekKosten("rechter", usd, { tokensIn: j.usage?.prompt_tokens, tokensUit: j.usage?.completion_tokens, beelden: figuren.length, status: r.status });
    if (!r.ok) throw new Error(`rechter HTTP ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
    const o = R.parseRechter(j.choices?.[0]?.message?.content ?? "");
    if (o) {
      o.kostenUsd = usd;
      o.versie = `${o.versie ?? R.RECHTER_VERSIE}${figuren.length ? "+figuren" : ""}`;
    }
    return o ?? null;
  } finally {
    stop();
    vrijgeven(sch);
  }
}

async function genereer(caseNaam, droog) {
  const budget = Number(opt("budget", droog ? 1e9 : NaN));
  if (!droog) {
    betaaldToegestaan();
    if (!Number.isFinite(budget) || budget <= 0) throw new Error("--budget <usd> verplicht");
  }
  const G = await S("stap0/grok-spec.ts");
  const R = await S("eval/rubric.ts");
  const { maakPdfs } = await S("stap0/export-pdf.ts");
  const { maakDocxs } = await S("stap0/export-docx.ts");
  const { pngRender, stap0Fonts } = await S("stap0/node.server.ts");
  const { c, inv, kal } = await caseInvoer(caseNaam);
  const naam = opt("naam", "stap0");
  const uit = join(resolve(opt("uit", join(ROOT, "eval-out"))), String(naam), caseNaam);
  mkdirSync(uit, { recursive: true });
  console.log(`${caseNaam}: doel ${kal.items} vragen / ${kal.punten} p · RTTI ${JSON.stringify(inv.rttiDoel)}`);
  const chat = droog ? await droogChat() : await maakChat(budget - RECHTER_RESERVE);
  const t0 = Date.now();
  let g;
  try {
    g = await G.genereerSpec(inv, kal, chat);
  } catch (e) {
    console.error(`generatie mislukt: ${e?.message ?? e}`);
    writeFileSync(join(uit, "resultaat.json"), JSON.stringify({ case: caseNaam, ok: false, fout: String(e?.message ?? e), kostenUsd: runKosten }, null, 1));
    process.exit(1);
  }
  const tGen = Date.now();
  writeFileSync(join(uit, "spec.json"), JSON.stringify(g.gen, null, 1));
  const rap = g.rapport;
  console.log(`keuring 1: ${g.eerste.fouten.length} fout(en)${g.hersteld ? ` → na herstel ${rap.fouten.length}` : ""}`);
  for (const f of rap.fouten.slice(0, 30)) console.log(`  - ${f}`);
  // Render (deterministisch; alleen geplaatste vragen).
  const tR = performance.now();
  const pdf = await maakPdfs(rap.toets, rap.res, stap0Fonts(), pngRender);
  const docx = await maakDocxs(rap.toets, rap.res, pngRender);
  const renderMs = Math.round(performance.now() - tR);
  writeFileSync(join(uit, "leerling.pdf"), pdf.leerling);
  writeFileSync(join(uit, "docent.pdf"), pdf.docent);
  writeFileSync(join(uit, "leerling.docx"), docx.leerling);
  writeFileSync(join(uit, "docent.docx"), docx.docent);
  const toets = G.alsGegenereerdeToets(rap.res, inv, kal);
  writeFileSync(join(uit, "toets.json"), JSON.stringify(toets, null, 1));
  writeFileSync(join(uit, "keuring.json"), JSON.stringify({ eerste: g.eerste.fouten, na: rap.fouten, feiten: rap.feiten, hersteld: g.hersteld, stappen: g.stappen, gerichteAanroepen: g.gerichteAanroepen, keuringen: rap.res.keuringen.map(({ figuren, ...k }) => ({ ...k, figuren: figuren.map(({ svg: _s, ...f }) => f) })) }, null, 1));
  // Rubriek + rechter.
  const n = droog ? 0 : Number(opt("rechter", 3));
  const input = { ...c.input };
  let oordeel = null;
  if (n > 0) {
    const figuren = await rechterFiguren(rap.res);
    console.log(`rechter: ${figuren.length} figuren als afbeelding`);
    const lijst = (await Promise.all(Array.from({ length: n }, () => rechter(toets, input, budget, figuren).catch((e) => (console.error(`rechter: ${e?.message}`), null))))).filter(Boolean);
    if (lijst.length) {
      const gem = (xs) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;
      const punten = {};
      for (const k of Object.keys(lijst[0].punten ?? {})) {
        const sc = lijst.map((o) => o.punten?.[k]?.score).filter((x) => typeof x === "number");
        punten[k] = { ...lijst[0].punten[k], score: sc.length ? gem(sc) : undefined, opmerkingen: lijst.map((o) => o.punten?.[k]?.opmerking).filter(Boolean) };
      }
      oordeel = { ...lijst[0], punten, cijfer: gem(lijst.map((o) => o.cijfer ?? 0)), cijfers: lijst.map((o) => o.cijfer), topProblemen: lijst.flatMap((o) => o.topProblemen ?? []), kostenUsd: lijst.reduce((s, o) => s + (o.kostenUsd ?? 0), 0), runs: lijst.length };
    }
  }
  const kaart = R.scoorToets(toets, input, oordeel ?? undefined);
  const f = rap.feiten;
  const weggeverRubriek = kaart.criteria.find((x) => x.id === "weggevers");
  const harde = {
    rekenen100: f.rekenFout === 0,
    figurenGo100: f.figurenGo === f.figuren,
    weggevers0: f.weggevers.length === 0 && !/verklappen/.test(weggeverRubriek?.detail ?? ""),
    lengte90_110: f.lengtePct >= 90 && f.lengtePct <= 110,
  };
  const resultaat = {
    case: caseNaam,
    ok: true,
    naam,
    rechter: oordeel?.cijfer ?? null,
    rechterCijfers: oordeel?.cijfers ?? [],
    rechterWeggevers: oordeel?.punten?.["2"]?.score ?? null,
    rubriek: kaart.cijfer,
    rubriekHardOk: kaart.hardOk,
    rubriekHardFout: kaart.hard.filter((h) => !h.ok).map((h) => `${h.id}: ${h.detail}`),
    harde,
    feiten: { ...f, geplaatsteVragen: rap.res.vragen.length, geplaatstePunten: rap.res.vragen.reduce((s, q) => s + q.punten, 0) },
    eersteKeuringFouten: g.eerste.fouten.length,
    restFouten: rap.fouten,
    hersteld: g.hersteld,
    stappen: g.stappen,
    gerichteAanroepen: g.gerichteAanroepen,
    topProblemen: oordeel?.topProblemen ?? [],
    kostenUsd: Math.round(runKosten * 10000) / 10000,
    tijden: { generatieMs: tGen - t0, renderMs },
    paden: { leerling: join(uit, "leerling.pdf"), docent: join(uit, "docent.pdf") },
  };
  writeFileSync(join(uit, "scores.json"), JSON.stringify({ ...kaart, rechter: oordeel, case: caseNaam }, null, 1));
  writeFileSync(join(uit, "resultaat.json"), JSON.stringify(resultaat, null, 1));
  console.log(`\n${caseNaam}: rechter ${resultaat.rechter} (${resultaat.rechterCijfers.join("/")}) · rubriek ${kaart.cijfer} · reken ${harde.rekenen100 ? "100 %" : "FOUT"} · figuren ${f.figurenGo}/${f.figuren} GO · weggevers ${f.weggevers.length} · lengte ${f.lengtePct} % · ${rap.res.vragen.length} vragen geplaatst · render ${renderMs} ms`);
  console.log(`→ ${uit}`);
  console.log(`run-kosten $${runKosten.toFixed(4)}`);
}

async function poort(mappen) {
  const dir = opt("baseline-dir", "/workspace/eval-r2/baseline-v3");
  const rs = mappen.map((m) => leesJson(join(m, "resultaat.json")));
  const perCase = new Map();
  for (const r of rs) perCase.set(r.case, [...(perCase.get(r.case) ?? []), r]);
  const regels = [];
  let gemNieuw = 0;
  let gemBasis = 0;
  let alleHard = true;
  for (const [c, lijst] of perCase) {
    const b = leesJson(join(dir, `${c}.scores.json`)).rechter?.cijfer;
    const rechter = lijst.reduce((s, r) => s + (r.rechter ?? 0), 0) / lijst.length;
    gemNieuw += rechter;
    gemBasis += b;
    const hard = lijst.every((r) => r.ok && Object.values(r.harde).every(Boolean));
    alleHard &&= hard;
    regels.push(`${c.padEnd(20)} rechter ${rechter.toFixed(2)} (baseline ${b}) · hard ${hard ? "OK" : "FAIL " + lijst.map((r) => Object.entries(r.harde ?? {}).filter(([, v]) => !v).map(([k]) => k).join(",")).join(" | ")} · $${lijst.reduce((s, r) => s + (r.kostenUsd ?? 0), 0).toFixed(3)}`);
  }
  const n = perCase.size;
  gemNieuw /= n;
  gemBasis /= n;
  const groen = n >= 5 && alleHard && gemNieuw >= 6.48 && gemNieuw >= gemBasis - 1e-9;
  console.log(regels.join("\n"));
  console.log(`Gemiddeld rechter ${gemNieuw.toFixed(2)} vs baseline ${gemBasis.toFixed(2)} (drempel 6,48) · harde checks ${alleHard ? "100 %" : "NIET 100 %"}`);
  console.log(`POORT ${groen ? "GROEN" : "ROOD"}`);
}

const [cmd, a1] = args;
if (cmd === "genereer" && a1) await genereer(a1, false);
else if (cmd === "droog" && a1) await genereer(a1, true);
else if (cmd === "poort") await poort(args.slice(1).filter((x) => !x.startsWith("--") && x !== opt("baseline-dir")));
else {
  console.log("Gebruik: genereer <case> --naam N --uit DIR --budget USD [--rechter 3] | droog <case> --uit DIR | poort <map/case> … [--baseline-dir D]");
  process.exit(2);
}
