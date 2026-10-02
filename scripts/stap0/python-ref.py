"""Gouden referentie (alleen op de box): rendert elke fixture-figuur met matplotlib, met dezelfde parameters,
via de goedgekeurde prototypecode (makefigs.py, nen_symbols.py) uit /workspace/voorbeeldvragen.

    python3 scripts/stap0/python-ref.py [--bron /workspace/voorbeeldvragen]

Uitvoer: src/lib/toets/stap0/__ref__/<fixture>-<i>-<rol>.png (200 dpi). De snapshot-test vergelijkt de
TypeScript-render hiermee."""
import json, math, os, sys, glob
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
bron = sys.argv[sys.argv.index("--bron") + 1] if "--bron" in sys.argv else "/workspace/voorbeeldvragen"
sys.path.insert(0, bron)
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Polygon
from scipy.interpolate import PchipInterpolator
import makefigs as MF
import nen_symbols as S

OUT = os.path.join(ROOT, "src/lib/toets/stap0/__ref__")
os.makedirs(OUT, exist_ok=True)
RED = "#c0392b"

def save(fig, path, exact=False):
    fig.savefig(path, dpi=200, bbox_inches=None if exact else "tight", pad_inches=0.05); plt.close(fig)

def cylinder(ax, x0, level, f, obj=False, label=""):
    w = 1.6; scale = 8.0 / f["max"]; top = f["max"] * 1.1 * scale
    ax.add_patch(Rectangle((x0 - 0.35, -0.25), w + 0.7, 0.25, fc="0.6", ec="black"))
    ax.add_patch(Rectangle((x0, 0), w, level * scale, fc="#bcd9f2", ec="none"))
    ax.plot([x0, x0], [0, top], color="black", lw=1.5); ax.plot([x0 + w, x0 + w], [0, top], color="black", lw=1.5)
    ax.plot([x0, x0 + w], [0, 0], color="black", lw=1.5)
    ax.plot([x0, x0 + w], [level * scale] * 2, color="#1f5f99", lw=1.6)
    n = int(round(f["max"] / f["streep"])); g = f["getalElke"]
    for k in range(n + 1):
        ml = k * f["streep"]; y = ml * scale
        L = 0.45 if abs(ml / g - round(ml / g)) < 1e-9 else (0.32 if abs(ml / (g / 2) - round(ml / (g / 2))) < 1e-9 else 0.18)
        ax.plot([x0, x0 + L], [y, y], color="black", lw=0.7)
        if L == 0.45 and ml > 0: ax.text(x0 + 0.5, y, f"{ml:g}".replace(".", ","), va="center", fontsize=8)
    ax.text(x0 + 0.5, top + 0.2, "mL", ha="center", fontsize=9)
    if obj:
        yb = min(0.4, level * scale / 4)
        ax.plot([x0 + 1.3, x0 + 1.3], [yb + 1.0, top + 0.6], color="0.3", lw=1)
        ax.add_patch(Polygon([[x0 + 1.1, yb], [x0 + 1.5, yb], [x0 + 1.5, yb + 1], [x0 + 1.1, yb + 1]], fc="0.35", ec="black"))
    ax.text(x0 + w / 2, -0.75, label, ha="center", fontsize=11, fontweight="bold")

def maatcilinder(f, path):
    n = len(f["cilinders"]); top = 8.8
    fig, ax = plt.subplots(figsize=(1.2 + 2.2 * n, 5.0))
    for i, c in enumerate(f["cilinders"]):
        cylinder(ax, i * 3.2, c["niveau"], f, c.get("voorwerp", False), c.get("label", ""))
    ax.set_xlim(-0.6, (n - 1) * 3.2 + 2.8); ax.set_ylim(-1.1, top + 0.75); ax.set_aspect("equal"); ax.axis("off")
    save(fig, path)

def osc(f, path):
    nx, ny = f["hokjesX"], f["hokjesY"]
    P = f["panelen"]
    if len(P) == 1:
        fig, ax = plt.subplots(figsize=(5.0, 4.4))
        MF.scope(ax, P[0]["amplitude"], nx / P[0]["trillingstijd"], None, nx, ny)
        if f.get("onderschrift"): ax.text(nx / 2, -ny / 2 - 0.7, f["onderschrift"], ha="center", va="top", fontsize=11)
        ax.set_ylim(-ny / 2 - 1.4, ny / 2)
    else:
        fig, axs = plt.subplots(2, 3, figsize=(8.2, 4.6))
        for ax, p in zip(axs.flat, P): MF.scope(ax, p["amplitude"], nx / p["trillingstijd"], p.get("label"), nx, ny)
        for ax in list(axs.flat)[len(P):]:
            ax.axis("off")
        if f.get("notitie"):
            ax = axs.flat[len(P)]
            ax.text(0.5, 0.5, f["notitie"], ha="center", va="center", fontsize=11, transform=ax.transAxes)
        fig.tight_layout()
    save(fig, path)

SYM = {"weerstand": S.resistor, "variabele-weerstand": S.variable_resistor, "lamp": S.lamp, "motor": S.motor,
       "spanningsmeter": lambda ax, a, b, l, side, color: S.meter(ax, a, b, "V", l, side, color),
       "stroommeter": lambda ax, a, b, l, side, color: S.meter(ax, a, b, "A", l, side, color),
       "cel": S.cell, "wisselbron": S.ac_source, "schakelaar": S.switch, "diode": S.diode, "led": S.led, "zekering": S.fuse}

def schema(f, path):
    lang = any("=" in (o.get("label") or "") for t in f["takken"] for o in t["onderdelen"])
    dubbel = any(len(t["onderdelen"]) > 1 for t in f["takken"])
    yt, yb, xb = (4 if dubbel else 3), 0, 0
    dx = 3.4 if lang else 2.3
    xs = [2.2 + i * dx for i in range(len(f["takken"]))]
    side = 1 if lang else -1
    xmax = xs[-1] + (2.1 if lang else 0.5) + (2.2 if f.get("vrijeRuimte") else 0)
    fig, ax = plt.subplots(figsize=((xmax + 1.4) * 0.56, (yt + 1) * 0.56))
    ax.set_xlim(-1.4, xmax); ax.set_ylim(-0.5, yt + 0.5); ax.set_aspect("equal"); ax.axis("off")
    ym = yt / 2
    SYM[f["bron"]["soort"]](ax, (xb, ym - 0.8), (xb, ym + 0.8), f["bron"].get("label"), side=1)
    S.wire(ax, (xb, ym + 0.8), (xb, yt), (xs[0], yt)); S.wire(ax, (xb, ym - 0.8), (xb, yb), (xs[0], yb))
    for i, t in enumerate(f["takken"]):
        x = xs[i]; col = RED if t.get("rood") else "black"
        if i > 0:
            S.wire(ax, (xs[i - 1], yt), (x, yt), color=col); S.wire(ax, (xs[i - 1], yb), (x, yb), color=col)
        n = len(t["onderdelen"])
        gr = [yt, yb] if n == 1 else ([yt, yb + 0.55 * (yt - yb), yb] if n == 2 else [yt, yb + 0.7 * (yt - yb), yb + 0.35 * (yt - yb), yb])
        for j, o in enumerate(t["onderdelen"]):
            c = RED if (o.get("rood") or t.get("rood")) else "black"
            SYM[o["soort"]](ax, (x, gr[j]), (x, gr[j + 1]), o.get("label"), side=side, color=c)
    for x in xs[:-1]:
        S.dot(ax, (x, yt)); S.dot(ax, (x, yb))
    save(fig, path)

def nl(v): return f"{v:g}".replace(".", ",")

def grafiek(f, path):
    if f.get("panelen"):
        P = f["panelen"]
        fig, axs = plt.subplots(1, len(P), figsize=(9.0, 2.4))
        for ax, p in zip(axs, P):
            xs, ys = zip(*p["punten"]); ax.plot(xs, ys, color="black", lw=2)
            ax.set_xlim(f["x"]["min"], f["x"]["max"]); ax.set_ylim(f["y"]["min"], f["y"]["max"])
            ax.set_xticks([]); ax.set_yticks([])
            ax.spines["top"].set_visible(False); ax.spines["right"].set_visible(False)
            ax.set_xlabel(f["x"]["label"]); ax.set_ylabel(f["y"]["label"]); ax.set_title(p["label"], fontweight="bold")
        fig.tight_layout(); save(fig, path); return
    fijn = bool(f["x"].get("fijn") or f["y"].get("fijn"))
    fig, ax = plt.subplots(figsize=(5.8, 4.4 if fijn else 3.6))
    X, Y = f["x"], f["y"]
    ax.set_xlim(X["min"], X["max"]); ax.set_ylim(Y["min"], Y["max"])
    xt = np.arange(X["min"], X["max"] + 1e-9, X["stap"]); yt = np.arange(Y["min"], Y["max"] + 1e-9, Y["stap"])
    ax.set_xticks(xt); ax.set_yticks(yt)
    ax.set_xticklabels([nl(v) for v in xt]); ax.set_yticklabels(["" if Y.get("zonderGetallen") else nl(v) for v in yt])
    if fijn:
        ax.set_xticks(np.arange(X["min"], X["max"] + 1e-9, X.get("fijn", X["stap"])), minor=True)
        ax.set_yticks(np.arange(Y["min"], Y["max"] + 1e-9, Y.get("fijn", Y["stap"])), minor=True)
        ax.grid(True, which="major", color="0.65", lw=0.7); ax.grid(True, which="minor", color="0.88", lw=0.5)
        ax.tick_params(which="minor", length=0)
    else:
        ax.grid(True, color="0.8", lw=0.6)
    ax.set_xlabel(X["label"]); ax.set_ylabel(Y["label"])
    for r in f["reeksen"]:
        xs, ys = zip(*r["punten"]); col = RED if r.get("rood") else "black"
        if r["vorm"] == "punten": ax.plot(xs, ys, "x", color=col, ms=8, mew=2)
        elif r["vorm"] == "vloeiend":
            xx = np.linspace(xs[0], xs[-1], 200); ax.plot(xx, PchipInterpolator(xs, ys)(xx), color=col, lw=1.8)
        else: ax.plot(xs, ys, color=col, lw=2)
    save(fig, path)

def mt(s):
    return s.replace("<sub>", "$_{\\mathrm{").replace("</sub>", "}}$").replace(" ≈", " ≈")

def krachten(f, path):
    fig, ax = MF.cm_fig(f["breedteCm"], f["hoogteCm"])
    px, py = f["punt"]
    if f["voorwerp"] == "bloempot":
        o = lambda x, y: (px + x - 3.5, py + y - 4.9)
        ax.plot(*zip(o(1, 8.6), o(6, 8.6)), color="black", lw=3); ax.plot(*zip(o(3.5, 8.6), o(3.5, 8.0)), color="black", lw=1.5)
        for s in (-1, 1): ax.plot(*zip(o(3.5, 8.0), o(3.5 + s * 1.3, 6.1)), color="0.3", lw=1)
        ax.add_patch(Polygon([o(2, 6.1), o(5, 6.1), o(4.5, 3.7), o(2.5, 3.7)], fc="#c8875a", ec="black", lw=1.5))
        ax.plot(*zip(o(2.4, 6.1), o(3.0, 7.0), o(3.5, 6.5), o(4.0, 7.2), o(4.6, 6.1)), color="#3a7d2c", lw=2)
    elif f["voorwerp"] == "boomstam":
        ax.add_patch(Rectangle((px - 1, py - 0.4), 1.0, 0.8, fc="#8b5a2b", ec="black"))
    elif f["voorwerp"] == "krat":
        ax.add_patch(Rectangle((px - 2, py - 1.2), 4.0, 2.4, fc="#e8c27a", ec="black", lw=1.5))
        for dx in (-0.67, 0.67): ax.plot([px + dx] * 2, [py - 1.2, py + 1.2], color="black", lw=0.8)
    ax.plot([px], [py], "ko", ms=5, zorder=5)
    if f.get("puntLabel"):
        if f["voorwerp"] == "boomstam": ax.text(px - 0.45, py + 0.65, f["puntLabel"], fontsize=11, fontweight="bold")
        else: ax.text(px + 0.25, py + 0.05, f["puntLabel"], fontsize=12, fontweight="bold")
    def end(n, h): L = n / f["schaalN"]; return (px + L * math.cos(math.radians(h)), py + L * math.sin(math.radians(h)))
    for p in f["pijlen"]:
        tx, ty = end(p["grootteN"], p["hoek"]); col = RED if p.get("rood") else "black"
        MF.arrow(ax, px, py, tx, ty, color=col, lw=2.4 if p.get("rood") else 2.2)
        if p.get("label"):
            h = p["hoek"] % 360; lab = mt(p["label"]); n = lab.count("\n") + 1
            if abs(h - 270) < 20: ax.text(px + 0.25, ty + 0.6 + 0.2 * (n - 1), lab, fontsize=11, color=col, va="center")
            elif abs(h - 90) < 20: ax.text(px + 0.25, ty - 0.6, lab, fontsize=11, color=col, va="center")
            elif h <= 20 or h >= 340: ax.text(tx + 0.1, py - 0.45, lab, fontsize=10, color=col, va="center")
            else: ax.text(tx - 0.15, ty + 0.05, lab, fontsize=10, color=col, ha="right")
    if f.get("resultante"):
        a = end(f["pijlen"][0]["grootteN"], f["pijlen"][0]["hoek"]); b = end(f["pijlen"][1]["grootteN"], f["pijlen"][1]["hoek"])
        r = (a[0] + b[0] - px, a[1] + b[1] - py)
        ax.plot([a[0], r[0]], [a[1], r[1]], "k--", lw=1); ax.plot([b[0], r[0]], [b[1], r[1]], "k--", lw=1)
        MF.arrow(ax, px, py, r[0], r[1], color=RED, lw=2.4)
        if f["resultante"].get("label"):
            ax.text(r[0] + 0.2, r[1] - 0.2, mt(f["resultante"]["label"]), fontsize=10, color=RED, va="center")
    save(fig, path, exact=True)

R = {"maatcilinder": maatcilinder, "oscilloscoop": osc, "schakelschema": schema, "grafiek": grafiek, "krachten": krachten}

def figuren(fx):
    """Zelfde volgorde als pijplijn.ts: per (deel)vraag eerst de leerlingfiguur, dan de antwoordfiguur."""
    items = []
    if fx.get("soort") == "vraagstuk":
        for i, d in enumerate(fx["deelvragen"]):
            fig = d.get("figuur") or (fx.get("figuur") if i == 0 else None)
            if fig: items.append((fig, "leerling"))
            if d["antwoordmodel"].get("figuur"): items.append((d["antwoordmodel"]["figuur"], "antwoord"))
    else:
        if fx.get("figuur"): items.append((fx["figuur"], "leerling"))
        if fx["antwoordmodel"].get("figuur"): items.append((fx["antwoordmodel"]["figuur"], "antwoord"))
    return items

n = 0
for p in sorted(glob.glob(os.path.join(ROOT, "src/lib/toets/stap0/fixtures/*.json"))):
    fx = json.load(open(p, encoding="utf-8"))
    for i, (f, rol) in enumerate(figuren(fx)):
        R[f["type"]](f, os.path.join(OUT, f'{fx["id"]}-{i}-{rol}.png')); n += 1
print(f"{n} referentiefiguren in {OUT}")
