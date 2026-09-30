import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { sha256Hex } from "./figuren/sha256.ts";
import { tekenCodeFiguur, tekstenInSvg } from "./figuren/svg.ts";
import { parseFiguurSpec, legacySpecs } from "./figuren/spec.ts";
import { beoordeelKeuring, KEURING_CHECKS, voorcheckNietTonen } from "./figuren/keuring.ts";
import { bevriesGoedgekeurd, bewaakFiguren, figuurIsGeldig, figuurNaarVerwijzing } from "./figuren/bevriezing.ts";
import { maakFiguurMetKeuring, type PijplijnDeps, type FiguurOpdracht } from "./figuren/pijplijn.ts";
import { verwerkFiguren, type VerwerkDeps } from "./figuren/verwerk.ts";
import { figuurKeuringPunten } from "./kwaliteit-check.ts";
import type { FiguurSpec, GegenereerdeToets, Vraag } from "./types.ts";

const alleGo = () => ({ besluit: "go", checks: Object.fromEntries(KEURING_CHECKS.map((k) => [k, true])), redenen: ["ok"] });
const noGo = (r = "labels onleesbaar") => ({ besluit: "no_go", checks: { leesbaar: false }, redenen: [r], feedback: "grotere labels" });

function spec(raw: unknown): FiguurSpec {
  const r = parseFiguurSpec(raw);
  assert.ok(r.spec, r.fout);
  return r.spec!;
}

const grafiekSpec = () =>
  spec({
    soort: "lijngrafiek",
    titel: "Afkoelen van thee",
    doel: "temperatuur aflezen",
    nietTonen: ["45"],
    data: {
      xLabel: "tijd",
      xEenheid: "min",
      yLabel: "temperatuur",
      yEenheid: "°C",
      reeksen: [{ punten: [{ x: 0, y: 80 }, { x: 5, y: 62.5 }, { x: 10, y: 50 }, { x: 15, y: 41 }] }],
    },
  });

const vraag = (nummer: number, extra: Partial<Vraag> = {}): Vraag => ({
  nummer,
  type: "open",
  rtti: "T1",
  domein: "Warmte",
  leerdoel: "grafiek aflezen",
  punten: 2,
  stam: "Lees in de grafiek af hoe warm de thee na 10 minuten is.",
  ...extra,
});

function goFiguur(id = "f1") {
  return bevriesGoedgekeurd({
    id,
    soort: "lijngrafiek",
    bron: "code",
    mime: "image/png",
    data: "iVBORw0KGgo=",
    breedte: 480,
    hoogte: 320,
    alt: "Lijngrafiek",
    spec: grafiekSpec(),
    pogingen: 1,
    keuring: { besluit: "go", redenen: ["ok"], model: "test", tijdstip: "2026-09-30T10:00:00.000Z" },
  });
}

function nepDeps(keuringen: unknown[], over: Partial<PijplijnDeps> = {}): PijplijnDeps & { keurAanroepen: number } {
  let t = 0;
  let i = 0;
  const d = {
    keurAanroepen: 0,
    tekenPng: async () => new Uint8Array([137, 80, 78, 71]),
    genereerBeeld: async () => ({ bytes: new Uint8Array([255, 216, 255]), mime: "image/jpeg" }),
    verkleinJpeg: (b: Uint8Array) => ({ bytes: b, breedte: 720, hoogte: 540 }),
    keur: async () => {
      d.keurAanroepen++;
      return keuringen[Math.min(i++, keuringen.length - 1)];
    },
    vraagJson: async () => ({}),
    nu: () => (t += 10),
    nieuwId: () => "fig-test",
    ...over,
  };
  return d;
}

const opdracht = (extra: Partial<FiguurOpdracht> = {}): FiguurOpdracht => ({
  vraag: vraag(3),
  nakijk: { nummer: 3, modelantwoord: "50 °C", puntenverdeling: [{ punt: 2, criterium: "50 °C" }] },
  spec: grafiekSpec(),
  legacy: false,
  verwijst: true,
  ...extra,
});

describe("sha256", () => {
  it("komt overeen met node:crypto", () => {
    for (const s of ["", "abc", "Figuur 1 — 62,5 °C", "x".repeat(1000)]) {
      assert.equal(sha256Hex(s), createHash("sha256").update(s).digest("hex"));
    }
  });
});

describe("deterministische SVG", () => {
  it("lijngrafiek bevat exacte getallen met decimale komma en eenheden", () => {
    const g = tekenCodeFiguur(grafiekSpec());
    const t = tekstenInSvg(g.svg).join(" | ");
    assert.match(t, /tijd \(min\)/);
    assert.match(t, /temperatuur \(°C\)/);
    assert.ok(g.breedte > 100 && g.hoogte > 100);
    assert.equal(tekenCodeFiguur(grafiekSpec()).svg, g.svg, "zelfde spec → zelfde SVG");
  });
  it("staafdiagram toont de waarden", () => {
    const g = tekenCodeFiguur(
      spec({ soort: "staafdiagram", data: { yLabel: "massa", yEenheid: "g", staven: [{ label: "ijzer", waarde: 7.9 }, { label: "hout", waarde: 0.6 }] } }),
    );
    const t = tekstenInSvg(g.svg);
    assert.ok(t.includes("ijzer") && t.includes("hout"));
  });
  it("voorcheck vangt een verboden getal in beeld", () => {
    const s = grafiekSpec();
    assert.deepEqual(voorcheckNietTonen(s, ["tijd (min)", "40"]), []);
    assert.ok(voorcheckNietTonen(s, ["45"]).length > 0);
  });
  it("legacy grafiekveld wordt een spec", () => {
    const q = vraag(1, { grafiek: { soort: "lijn", titel: "t", xLabel: "t (s)", yLabel: "v (m/s)", punten: [{ x: 0, y: 0 }, { x: 2, y: 4 }] } as never });
    const specs = legacySpecs(q);
    assert.equal(specs.length, 1);
    assert.equal(specs[0]!.soort, "lijngrafiek");
  });
});

describe("keuring", () => {
  it("go alleen als alle checks expliciet true zijn", () => {
    assert.equal(beoordeelKeuring(alleGo()).besluit, "go");
    const bijna = alleGo();
    delete (bijna.checks as Record<string, boolean>).verklapt_antwoord_niet;
    const u = beoordeelKeuring(bijna);
    assert.equal(u.besluit, "no_go");
    assert.ok(u.redenen.some((r) => /verklapt/.test(r)));
    assert.equal(beoordeelKeuring(null).besluit, "no_go");
    assert.equal(beoordeelKeuring({ besluit: "GO" }).besluit, "no_go");
  });
});

describe("bevriezing", () => {
  it("zonder go geen figuur", () => {
    assert.throws(() => bevriesGoedgekeurd({ ...goFiguur(), keuring: { besluit: "no_go" } } as never));
  });
  it("bevroren figuur kan niet worden aangepast", () => {
    const f = goFiguur();
    assert.ok(Object.isFrozen(f) && Object.isFrozen(f.spec));
    assert.throws(() => {
      (f as { data: string }).data = "anders";
    });
    assert.equal(figuurIsGeldig(f), true);
  });
  it("gewijzigde kopie wordt geweigerd", () => {
    const f = goFiguur();
    assert.equal(figuurIsGeldig({ ...f, data: "AAAA" }), false);
    assert.equal(figuurIsGeldig({ ...f, keuring: { ...f.keuring, besluit: "no_go" } } as never), false);
  });
  it("bewaken zet een geknoeide figuur terug en koppelt via figuurId", () => {
    const f = goFiguur();
    const oud = [vraag(1, { figuur: f })];
    const geknoeid = bewaakFiguren(oud, [vraag(1, { figuur: { ...f, data: "AAAA" } })], { pijplijn: true });
    assert.equal(geknoeid.vragen[0]!.figuur, f);
    const viaId = bewaakFiguren(oud, [{ ...figuurNaarVerwijzing(oud[0]!), stam: "Nieuwe stam." }], { pijplijn: true });
    assert.equal(viaId.vragen[0]!.figuur, f);
    assert.equal(figuurNaarVerwijzing(oud[0]!).figuur, undefined);
    assert.equal(figuurNaarVerwijzing(oud[0]!).figuurId, f.id);
  });
});

describe("maakFiguurMetKeuring", () => {
  it("go bij de eerste poging → bevroren figuur", async () => {
    const u = await maakFiguurMetKeuring(opdracht(), nepDeps([alleGo()]));
    assert.equal(u.status, "go");
    if (u.status === "go") {
      assert.equal(u.pogingen, 1);
      assert.ok(figuurIsGeldig(u.figuur));
      assert.equal(u.figuur.mime, "image/png");
    }
  });
  it("no_go → feedbackronde → go bij poging 2", async () => {
    const d = nepDeps([noGo(), alleGo()]);
    const u = await maakFiguurMetKeuring(opdracht(), d);
    assert.equal(u.status, "go");
    assert.equal(u.pogingen, 2);
    assert.equal(d.keurAanroepen, 2);
  });
  it("3× no_go → gedropt, herschreven vraag zonder figuurverwijzing", async () => {
    const d = nepDeps([noGo(), noGo(), noGo()], {
      vraagJson: async (system: string) =>
        /afgekeurd/.test(system)
          ? { actie: "herschreven", vraag: { ...vraag(3), stam: "Thee koelt af van 80 °C naar 50 °C in 10 minuten. Hoeveel graden daalt de temperatuur?" }, nakijk: { nummer: 3, modelantwoord: "30 °C", puntenverdeling: [{ punt: 1, criterium: "80 − 50" }, { punt: 1, criterium: "30 °C" }] } }
          : {},
    });
    const u = await maakFiguurMetKeuring(opdracht({ legacy: true }), d);
    assert.equal(u.status, "gedropt");
    assert.equal(u.pogingen, 3);
    assert.equal(d.keurAanroepen, 3);
    if (u.status === "gedropt") {
      assert.equal(u.herschreven?.actie, "herschreven");
      assert.doesNotMatch(u.herschreven!.vraag.stam, /figuur|grafiek/i);
    }
  });
  it("AI-sfeerplaat wordt ook altijd gekeurd", async () => {
    const d = nepDeps([alleGo()]);
    const u = await maakFiguurMetKeuring(opdracht({ spec: spec({ soort: "sfeerplaat", data: { scene: "Een leerling verwarmt water op een brander." } }) }), d);
    assert.equal(u.status, "go");
    assert.equal(d.keurAanroepen, 1);
    if (u.status === "go") assert.equal(u.figuur.bron, "ai");
  });
  it("API-fouten en timeouts gooien nooit en plaatsen geen figuur", async () => {
    const d = nepDeps([alleGo()], {
      genereerBeeld: async () => {
        throw new Error("timeout");
      },
    });
    const u = await maakFiguurMetKeuring(opdracht({ spec: spec({ soort: "sfeerplaat", data: { scene: "Een brander." } }) }), d);
    assert.equal(u.status, "gedropt");
    const kapot = nepDeps([alleGo()], {
      keur: async () => {
        throw new Error("503");
      },
    });
    assert.equal((await maakFiguurMetKeuring(opdracht(), kapot)).status, "gedropt");
  });
  it("te weinig tijd → geen poging, gedropt", async () => {
    const u = await maakFiguurMetKeuring(opdracht(), nepDeps([alleGo()]), { budgetMs: 1_000 });
    assert.equal(u.status, "gedropt");
  });
});

function toets(vragen: Vraag[]): GegenereerdeToets {
  return {
    id: "t1",
    createdAt: "2026-09-30T10:00:00.000Z",
    bronmateriaal: "Nova NaSk hoofdstuk warmte",
    extraEisen: "",
    ronde: 1,
    meta: { vak: "NaSk", titel: "Warmte" } as never,
    cijferNorm: {} as never,
    vragen,
    nakijkmodel: vragen.map((q) => ({ nummer: q.nummer, modelantwoord: "x", puntenverdeling: [{ punt: q.punten, criterium: "x" }] })),
    cesuur: {} as never,
    matrijs: {} as never,
    kwaliteit: { samenvatting: "R 20%.", punten: [] },
  };
}

describe("verwerkFiguren", () => {
  it("go plaatst figuur; gedropte legacy-grafiek wordt een tabel; rapport is berekend", async () => {
    const g = { soort: "lijn", titel: "t", xLabel: "t (s)", yLabel: "v (m/s)", punten: [{ x: 0, y: 0 }, { x: 2, y: 4 }] } as never;
    const t = toets([vraag(1, { grafiek: g }), vraag(2, { grafiek: g }), vraag(3)]);
    let n = 0;
    const deps: VerwerkDeps = {
      plan: async () => ({ ok: true, figuren: [] }),
      maak: async (o) => {
        n++;
        return o.vraag.nummer === 1
          ? maakFiguurMetKeuring(o, nepDeps([alleGo()]))
          : { status: "gedropt", pogingen: 3, redenen: ["getallen onleesbaar"], log: [] };
      },
    };
    const uit = await verwerkFiguren(t, deps);
    assert.equal(n, 2);
    assert.equal(uit.figuurPijplijn, 1);
    assert.ok(figuurIsGeldig(uit.vragen[0]!.figuur));
    assert.equal(uit.vragen[0]!.grafiek, undefined);
    assert.equal(uit.vragen[1]!.figuur, undefined);
    assert.equal(uit.vragen[1]!.grafiek, undefined);
    const items = uit.figuurRapport!.items;
    assert.equal(items.filter((i) => i.status === "go").length, 1);
    assert.equal(items.filter((i) => i.status === "gedropt").length, 1);
    const k = uit.kwaliteit.punten.find((p) => /go\/no-go/i.test(p.criterium));
    assert.ok(k, "keuringspunt aanwezig");
    assert.match(k!.toelichting, /1/);
  });
  it("planner- of functiefouten breken de toets nooit", async () => {
    const t = toets([vraag(1), vraag(2)]);
    const uit = await verwerkFiguren(t, {
      plan: async () => {
        throw new Error("netwerk");
      },
      maak: async () => {
        throw new Error("nooit");
      },
    });
    assert.equal(uit.vragen.length, 2);
    assert.equal(uit.figuurPijplijn, 1);
    assert.ok(uit.figuurRapport!.meldingen.some((m) => /planner/i.test(m)));
  });
});

describe("kwaliteit: figuurkeuring", () => {
  it("telt geplaatst, gedropt en pogingen uit het rapport", () => {
    const r = figuurKeuringPunten([vraag(1, { figuur: goFiguur() })], {
      versie: 1,
      items: [
        { nummer: 1, soort: "lijngrafiek", bron: "code", status: "go", pogingen: 2, redenen: [] },
        { nummer: 2, soort: "sfeerplaat", bron: "ai", status: "gedropt", pogingen: 3, redenen: ["stijl"], fallback: "herschreven" },
      ],
      meldingen: [],
    }, { nask: true });
    assert.match(r.samenvatting, /1 geplaatst \(go\), 1 gedropt, 5 keuringspogingen/);
  });
});
