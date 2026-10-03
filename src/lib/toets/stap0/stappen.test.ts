/** Stap-0-pilot: losse stappen, budgetregels, ondertekende toestand, allowlist en de client-keten (offline, nep-chat). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { laadFixtures } from "./laad.ts";
import { allesGoed, monitoring, nieuweStaat, STAP0_BUDGET, voerStapUit, type Stap0Staat, type StapChat } from "./stappen.ts";
import { keurGeneratie, type SpecInvoer } from "./grok-spec.ts";
import { controleer, gebruikerTag, logStap0, onderteken, pilotAntwoord, pilotGebruikers, stap0Modus, stap0Voor, stap0VangnetUsd, zonderEmail } from "./pilot.server.ts";
import { leesPilotCode, maakToetsStap0 } from "../maak-toets-stap0.ts";
import type { VraagstukSpec } from "./spec.ts";

const toon = () => structuredClone(laadFixtures().find((f) => f.id === "se42-toongenerator") as VraagstukSpec);
const W = ["alfa", "beta", "gamma", "delta"];
const kopie = (id: string): VraagstukSpec => {
  const v = toon();
  return { ...v, id, deelvragen: v.deelvragen.map((d, i) => ({ ...d, id: `${id}-${"abcd"[i]}`, begrip: `${id} ${W[i]}`, antwoordmodel: { ...d.antwoordmodel, regels: [`${id}${W[i]} uniek${id}${W[i]} zinnetje${id}${W[i]}`, ...d.antwoordmodel.regels.slice(1)] } })) };
};
const fout = (id: string) => {
  const v = kopie(id);
  v.deelvragen[1]!.berekeningen![2]!.waarde = 1300;
  return v;
};
const inv: SpecInvoer = { titel: "H13 Geluid", leerweg: "GT", leerjaar: 4, duurMinuten: 45, bronmateriaal: "13.2 Toonhoogte\nFrequentie.\n13.3 Trillingstijd\nOscilloscoop.", rttiDoel: { R: 15, T1: 45, T2: 34, I: 6 } };
const kal = { items: 8, punten: 12 };

/** Nep-chat: eerste generatie = `eerste`, gerichte aanroepen geven een goed vraagstuk met de gevraagde id. */
function nepChat(eerste: VraagstukSpec[], o: { usd?: number; herstelUsd?: number; teller?: { n: number } } = {}): StapChat {
  return async (m, schema) => {
    if (o.teller) o.teller.n++;
    if (schema.naam === "toets_spec") return { tekst: JSON.stringify({ titel: "x", vraagstukken: eerste }), usd: o.usd ?? 0.08 };
    const p = m.at(-1)!.content;
    const id = /zelfde id \("([a-z0-9-]+)"\)/.exec(p)?.[1] ?? /id "([a-z0-9-]+)"/.exec(p)?.[1] ?? "z";
    return { tekst: JSON.stringify({ vraagstuk: kopie(id) }), usd: o.herstelUsd ?? 0.03 };
  };
}
async function totKlaar(s0: Stap0Staat, chat: StapChat, opts: Parameters<typeof voerStapUit>[2] = {}) {
  let s = s0;
  const fasen: string[] = [];
  for (let i = 0; i < 30 && s.fase !== "klaar"; i++) {
    s = JSON.parse(JSON.stringify(await voerStapUit(s, chat, opts))) as Stap0Staat; // zoals over de lijn
    fasen.push(s.fase);
  }
  return { s, fasen };
}

describe("stap 0 in losse stappen (offline)", () => {
  it("spec → herstel → afronden → klaar; eerst schrappen, dan pas herstel; kosten en monitoring per toets", async () => {
    const teller = { n: 0 };
    const logs: [string, Record<string, unknown>][] = [];
    const { s, fasen } = await totKlaar(nieuweStaat(inv, kal, "t1"), nepChat([kopie("een"), fout("twee"), kopie("drie")], { teller }), { log: (k, d) => logs.push([k, d]) });
    assert.deepEqual(fasen, ["herstel", "afronden", "klaar"]);
    assert.equal(teller.n, 1, "afgekeurd vraagstuk geschrapt (lengte blijft ≥ 90 %), geen herstelaanroep");
    assert.deepEqual(s.gen!.vraagstukken.map((v) => v.id), ["een", "drie"]);
    assert.deepEqual(s.restFouten, []);
    assert.equal(s.kosten.usd, 0.08);
    const m = logs.find(([k]) => k === "klaar")![1];
    assert.equal(m.usd, 0.08);
    assert.deepEqual(m.restFouten, []);
    assert.equal(typeof m.totaalMs, "number");
    assert.ok(allesGoed(keurGeneratie(s.gen!, inv, kal), kal));
  });

  it("herstel tot alles goed is: hoogstens 4 parallel per stap, geen vaste limiet op het aantal aanroepen", async () => {
    const vijf = ["piet", "klaas", "roos", "sanne", "tim", "ursula"].map(fout);
    let bezig = 0;
    let max = 0;
    const basis = nepChat(vijf);
    const chat: StapChat = async (m, sc, o) => {
      bezig++;
      max = Math.max(max, bezig);
      await new Promise((r) => setTimeout(r, 3));
      bezig--;
      return basis(m, sc, o);
    };
    const { s } = await totKlaar(nieuweStaat(inv, { items: 24, punten: 36 }, "t2"), chat);
    assert.ok(max <= STAP0_BUDGET.parallel, String(max));
    assert.deepEqual(s.restFouten, []);
    assert.equal(s.kosten.gericht, 6);
    assert.ok(s.tijden.stapMs.length >= 4, "spec + 2 herstelstappen + afronden");
  });

  it("vangnet $1: geen nieuwe aanroep als hij niet meer past; alarm boven $0,50; afgekeurd wordt nooit geplaatst", async () => {
    const logs: string[] = [];
    // Herstel levert steeds weer een fout vraagstuk op en kost veel.
    const chat: StapChat = async (m, schema) =>
      schema.naam === "toets_spec" ? { tekst: JSON.stringify({ titel: "x", vraagstukken: [fout("a1"), fout("a2"), fout("a3"), fout("a4"), fout("a5"), fout("a6")] }), usd: 0.1 } : { tekst: JSON.stringify({ vraagstuk: fout("zz") }), usd: 0.06 };
    const { s } = await totKlaar(nieuweStaat(inv, { items: 24, punten: 36 }, "t3"), chat, { log: (k) => logs.push(k) });
    assert.ok(s.kosten.usd <= STAP0_BUDGET.vangnetUsd + 1e-9, String(s.kosten.usd));
    assert.ok(s.kosten.usd > 0.5);
    assert.equal(logs.filter((k) => k === "alarm").length, 1);
    assert.ok(s.stopReden === "vangnet" || (s.gen!.vraagstukken.length === 0));
    assert.deepEqual(keurGeneratie(s.gen!, inv, kal).fouten.filter((f) => /^\[a\d|^\[zz/.test(f)), [], "geen afgekeurd vraagstuk geplaatst");
  });

  it("tijd op → afronden met wat goed is", async () => {
    let t = 0;
    const chat = nepChat([kopie("een"), fout("twee")]);
    let s = nieuweStaat(inv, kal, "t4", 0);
    s = await voerStapUit(s, chat, { nu: () => t });
    t = STAP0_BUDGET.maxTotaalMs; // alle tijd op
    s = await voerStapUit(s, chat, { nu: () => t });
    assert.equal(s.fase, "afronden");
    assert.equal(s.stopReden, "tijd");
    s = await voerStapUit(s, chat, { nu: () => t });
    assert.equal(s.fase, "klaar");
    assert.deepEqual(s.gen!.vraagstukken.map((v) => v.id), ["een"]);
    assert.deepEqual(monitoring(s).stopReden, "tijd");
  });

  it("mislukte eerste generatie: toestand terug (nog een poging), na twee keer een fout; xAI-5xx telt niet", async () => {
    let n = 0;
    const chat: StapChat = async () => {
      n++;
      throw Object.assign(new Error("TimeoutError: aborted"), { usd: 0.02 });
    };
    const s1 = await voerStapUit(nieuweStaat(inv, kal, "t5"), chat);
    assert.equal(s1.fase, "spec");
    assert.match(s1.laatsteFout!, /Timeout/);
    assert.equal(s1.kosten.usd, 0.02);
    await assert.rejects(voerStapUit(s1, chat), /twee keer mislukt/);
    let m = 0;
    const chat5: StapChat = async (msg, sc, o) => (m++ === 0 ? Promise.reject(new Error("xAI API error 503: unavailable")) : nepChat([kopie("een"), kopie("twee")])(msg, sc, o));
    const s2 = await voerStapUit(nieuweStaat(inv, kal, "t6"), chat5);
    assert.equal(s2.fase, "herstel");
    assert.equal(s2.kosten.aanroepen, 1);
    assert.ok(n === 2);
  });
});

describe("stap-0-pilot: vlag per gebruiker en ondertekende toestand", () => {
  const code = "k".repeat(24);
  const env = { STAP0_RENDERER: "pilot", STAP0_USERS: `nick:${code}, kort:abc`, XAI_API_KEY: "x" };
  it("alleen gebruikers uit STAP0_USERS; standaard uit; 'aan' = iedereen", () => {
    assert.equal(stap0Modus({}), "uit");
    assert.equal(stap0Voor(code, {}), null);
    assert.deepEqual(stap0Voor(code, env), { label: "nick" });
    assert.equal(stap0Voor("x".repeat(24), env), null);
    assert.equal(stap0Voor(undefined, env), null);
    assert.deepEqual(pilotGebruikers(env).map((g) => g.label), ["nick"], "te korte code telt niet");
    assert.equal(stap0Voor(code, { ...env, STAP0_RENDERER: "uit" }), null);
    assert.deepEqual(stap0Voor(undefined, { STAP0_RENDERER: "aan" }), { label: "iedereen" });
  });
  it("privacy: het label (ook als het een e-mailadres is) gaat nooit naar de client of in een logregel", () => {
    const mail = "iemand@example.org";
    const e = { STAP0_RENDERER: "pilot", STAP0_USERS: `${mail}:${code}` };
    assert.deepEqual(pilotAntwoord(code, e), { aan: true });
    assert.deepEqual(pilotAntwoord("x".repeat(24), e), { aan: false });
    assert.ok(!JSON.stringify(pilotAntwoord(code, e)).includes("@"));
    const tag = gebruikerTag(mail);
    assert.match(tag, /^u-[0-9a-f]{8}$/);
    assert.ok(!tag.includes(mail.split("@")[0]!));
    assert.equal(zonderEmail(`fout bij ${mail}: x`), "fout bij [e-mail]: x");
    const regels: string[] = [];
    const oud = console.log;
    console.log = (x: string) => regels.push(x);
    try {
      logStap0("stap", { wie: mail, fout: `kapot voor ${mail}` });
    } finally {
      console.log = oud;
    }
    assert.equal(regels.length, 1);
    assert.ok(!regels[0]!.includes("@"), regels[0]);
  });
  it("STAP0_VANGNET_USD kan het vangnet alleen verlagen", () => {
    assert.equal(stap0VangnetUsd({}), undefined);
    assert.equal(stap0VangnetUsd({ STAP0_VANGNET_USD: "0.40" }), 0.4);
    assert.equal(stap0VangnetUsd({ STAP0_VANGNET_USD: "5" }), 1);
    assert.equal(stap0VangnetUsd({ STAP0_VANGNET_USD: "x" }), undefined);
  });
  it("HMAC: gewijzigde kosten of fase worden geweigerd", () => {
    const s = nieuweStaat(inv, kal, "t7");
    const mac = onderteken(s, env);
    assert.equal(controleer(JSON.parse(JSON.stringify(s)), mac, env), true);
    assert.equal(controleer({ ...s, kosten: { ...s.kosten, usd: -5 } }, mac, env), false);
    assert.equal(controleer(s, mac, { ...env, STAP0_STATE_SECRET: "ander" }), false);
  });
  it("pilotcode uit #pilot=… naar localStorage", () => {
    const m = new Map<string, string>();
    const o = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
    assert.equal(leesPilotCode({ hash: `#pilot=${code}`, pathname: "/", search: "" }, o), code);
    assert.equal(leesPilotCode({ hash: "", pathname: "/", search: "" }, o), code);
    leesPilotCode({ hash: "#pilot=uit", pathname: "/", search: "" }, o);
    assert.equal(o.getItem("toetski:pilot"), null);
  });
  it("client-keten: bewaart na elke stap, hervat na een mislukte stap, fallback bij weigering", async () => {
    const m = new Map<string, string>();
    const o = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
    const input = { titel: "x" } as never;
    const aanroepen: string[] = [];
    let haper = true;
    const stap = async (a: { data: { staat?: unknown } }) => {
      const n = (a.data.staat as { n?: number } | undefined)?.n ?? 0;
      aanroepen.push(String(n));
      if (n === 1 && haper) {
        haper = false;
        throw new Error("504");
      }
      if (n === 2) return { ok: true as const, staat: { n: 3 }, mac: "m", status: { tekst: "klaar", fase: "klaar", usd: 0.2, open: 0 }, toets: { id: "stap0-x" } as never };
      return { ok: true as const, staat: { n: n + 1 }, mac: "m", status: { tekst: "…", fase: "herstel", usd: 0.1, open: 1 } };
    };
    const fasen: string[] = [];
    const r = await maakToetsStap0(input, { pilot: "p", stap, opslag: o, onVoortgang: (v) => fasen.push(`${v.fase}:${v.ronde}`) });
    assert.equal(r.ok, true);
    assert.deepEqual(fasen, ["spec:0", "herstel:0", "herstel:0", "opslaan:0"], "wachtbalk krijgt elke stap");
    assert.deepEqual(aanroepen, ["0", "1", "1", "2"], "stap 1 opnieuw vanaf de bewaarde toestand");
    assert.equal(m.get("toetski:stap0-lopend"), undefined, "na afloop opgeruimd");
    const nee = await maakToetsStap0(input, { pilot: "p", stap: async () => ({ ok: false as const, error: "niet in pilot", fallback: true }), opslag: o });
    assert.deepEqual(nee, { ok: false, error: "niet in pilot", fallback: true });
  });
});
