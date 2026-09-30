# Genereert src/lib/toets/kalibratie-data.ts uit kalibratie.json (v2), vraagtypen.json en Nova-structuur.
# Alleen statistiek, analystenbeschrijvingen en type-namen; GEEN voorbeeldpatroon, geen examen-/toetsteksten.
import json, re
K = json.load(open('/workspace/nask-examens/kalibratie.json'))
V = json.load(open('/workspace/nask-examens/vraagtypen.json'))['typen']
L = json.load(open('/workspace/oswald-nova/leerdoelen.json'))
nova_src = open('/workspace/oswald-nova/nova.ts').read()

def school(klas, lw):
    s = K['school'][klas][lw]
    g = s.get('gemeten') or {}
    pv = g.get('puntverdeling_pct') or {}
    b = s.get('berekening', {})
    c = s.get('context', {})
    return {
        'bron': s.get('bron', ''),
        'duur': s['duur_min'], 'vragen': s['vragen'], 'items': s['items'], 'punten': s['punten'],
        'minPerItem': s.get('minuten_per_item') or round(s['duur_min'] / s['items'], 2),
        'puntenPerItem': s.get('punten_per_item') or round(s['punten'] / s['items'], 2),
        'pct1p': s.get('pct_1p') or pv.get('1p') or 80,
        'vormPct': s.get('vraagvorm_items_pct', {}),
        'rekenMax': b.get('max_punten', 3),
        'rekenTemplate': b.get('template', ''),
        'formuleGegeven': b.get('formule_gegeven', False),
        'omrekenen': b.get('omrekenen', ''),
        'contextStijl': c.get('stijl', ''),
        'voornamen': c.get('voornamen', 2),
        'examencontextPct': c.get('examencontext_pct', 0),
        'afbeeldingen': s.get('afbeeldingen_per_toets', 3),
        'topTypen': (g.get('top_typen') or [])[:8],
        'examenvragenBlok': bool(s.get('examenvragen_blok')),
    }

SCHOOL = {f'{k}{lw}': school(f'klas{k}', lw) for k in (1, 2, 3, 4) for lw in ('BB', 'KB', 'GT')}

EXAMEN = {}
for lw in ('BB', 'KB', 'GT'):
    n = K['niveaus'][lw]
    e = n['examen']
    EXAMEN[lw] = {
        'duur': e['duur_min'], 'vragen': round(e['vragen_gem']), 'punten': round(e['punten_gem']),
        'puntenPerVraag': e['punten_per_vraag'], 'minPerItem': K['klas_kalibratie']['school_correctie']['minuten_per_item'][f'examen_{lw}'],
        'pct1p': e['puntverdeling_pct'].get('1p'),
        'vormPct': {k: round(v) for k, v in n['vraagvorm_aandeel_gemeten_vragen_pct'].items()},
        'rekenMax': n['berekening']['max_punten']['examen'],
        'introWoorden': n['context']['intro_woorden'], 'vragenPerContext': n['context']['vragen_per_context'],
        'categorieen': list(n['context']['categorieen_pct'].keys()),
    }

TYPEN = []
for t in V:
    TYPEN.append({'id': t['id'], 'naam': t['naam'], 'domein': t['domein'], 'freq': t['frequentie'],
                  'niveaus': t.get('niveaus', {}), 'punten': t.get('punten_typisch', 1)})
TYPEN += [
    {'id': 'O-LICHT', 'naam': 'Licht: schaduw, spiegeling, breking, lenzen en kleuren (onderbouw)', 'domein': 'licht', 'freq': 0, 'niveaus': {}, 'punten': 1, 'onderbouw': True},
    {'id': 'O-HEELAL', 'naam': 'Heelal: zon, maan, planeten, maanfasen, dag en nacht, seizoenen (onderbouw)', 'domein': 'heelal', 'freq': 0, 'niveaus': {}, 'punten': 1, 'onderbouw': True},
    {'id': 'O-WEER', 'naam': 'Water en weer: neerslag, luchtdruk, wind, waterkringloop, weerbericht (onderbouw)', 'domein': 'weer', 'freq': 0, 'niveaus': {}, 'punten': 1, 'onderbouw': True},
]

def chapters(name):
    m = re.search(r'const ' + name + r': NovaChapter\[\] = \[(.*?)\n\];', nova_src, re.S)
    body = m.group(1)
    out = []
    for ch in re.finditer(r'\{\s*n: (\d+),\s*title: "([^"]+)",\s*paragraphs: \[(.*?)\],\s*\}', body, re.S):
        pars = [{'n': int(a), 'titel': b} for a, b in re.findall(r'\{ n: (\d+), title: "([^"]+)" \}', ch.group(3))]
        out.append({'n': int(ch.group(1)), 'titel': ch.group(2), 'paragrafen': pars})
    return out

NOVA = {'kgt12': chapters('KGT12'), 'gt3': chapters('GT3'), 'gt4': chapters('GT4')}
for k, v in NOVA.items():
    assert len(v) >= 8, (k, len(v))

REGELS = {
    'correctie': K['correctieregels'],
    'templates': K['berekening_templates'],
    'context': K['contextregels'],
    'opdrachtwoorden': K['opdrachtwoorden'],
}

def js(x):
    return json.dumps(x, ensure_ascii=False, indent=1)

out = f'''// GEGENEREERD door tools/bouw-kalibratie-data.py uit kalibratie.json v2 (Nick's 67 NaSk-toetsen + CSE 2013–2026),
// vraagtypen.json (alleen id/naam/domein/frequentie) en de Nova-structuur. Alleen statistiek en patronen,
// geen vraag- of examenteksten. Niet met de hand aanpassen.

export interface SchoolProfielData {{
  bron: string; duur: number; vragen: number; items: number; punten: number;
  minPerItem: number; puntenPerItem: number; pct1p: number; vormPct: Record<string, number>;
  rekenMax: number; rekenTemplate: string; formuleGegeven: boolean | string; omrekenen: string;
  contextStijl: string; voornamen: number; examencontextPct: number; afbeeldingen: number;
  topTypen: string[]; examenvragenBlok: boolean;
}}
export interface ExamenProfielData {{
  duur: number; vragen: number; punten: number; puntenPerVraag: number; minPerItem: number; pct1p: number;
  vormPct: Record<string, number>; rekenMax: number; introWoorden: number[]; vragenPerContext: number[]; categorieen: string[];
}}
export interface VraagtypeData {{ id: string; naam: string; domein: string; freq: number; niveaus: Record<string, number>; punten: number; onderbouw?: boolean }}
export interface NovaHoofdstukData {{ n: number; titel: string; paragrafen: {{ n: number; titel: string }}[] }}

export const SCHOOL_PROFIELEN: Record<string, SchoolProfielData> = {js(SCHOOL)};

export const EXAMEN_PROFIELEN: Record<"BB" | "KB" | "GT", ExamenProfielData> = {js(EXAMEN)};

export const VRAAGTYPEN: VraagtypeData[] = {js(TYPEN)};

export const NOVA_HOOFDSTUKKEN: Record<"kgt12" | "gt3" | "gt4", NovaHoofdstukData[]> = {js(NOVA)};

export const NOVA_LEERDOELEN: Record<"kgt12" | "gt3" | "gt4", Record<string, string>> = {js(L)};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const KALIBRATIE_REGELS: any = {js(REGELS)};
'''
out = re.sub(r'\s*\(\\"dit zijn de formules die je moet gebruiken\\"\)', '', out)
assert 'formules die je moet' not in out
open('/workspace/toetski-work/base/src/lib/toets/kalibratie-data.ts', 'w').write(out)
print('ok', len(out), {k: len(v) for k, v in NOVA.items()}, len(TYPEN))
