# Genereert src/lib/toets/cse-contexten.ts: echte CSE-contexten NaSk1 (2013–2026) voor het blok
# 'Examenvragen' in klas 4 / examenniveau (met bronvermelding 'naar: examen <jaar> tijdvak <n>').
# Alleen server-side gebruikt. Klas 1–3 krijgen deze teksten nooit.
import json, re, collections
D = json.load(open('/workspace/nask-examens/data_raw.json'))
V = json.load(open('/workspace/nask-examens/vragen_geclassificeerd.json'))
meta = {(x['exam'], x['nr']): x for x in V}

def schoon(s):
    s = s or ''
    s = re.sub(r'\.{4,}', ' ', s)
    s = re.sub(r'[A-Z]{2}-0173-a-\S+\s+\d+\s+lees verder\s*►+', ' ', s, flags=re.I)
    s = re.sub(r'lees verder\s*►+', ' ', s, flags=re.I)
    s = re.sub(r'\f', ' ', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()

def cv_tekst(cv):
    if not cv: return ''
    if cv.get('mc'): return f"sleutel {cv['mc']}"
    raw = cv.get('raw', '')
    raw = raw.split('\n\n\n')[0]
    raw = re.sub(r'Vraag\s+Antwoord\s+Scores', ' ', raw)
    return schoon(raw)[:420]

out = []
for e in D:
    if e['level'] not in ('BB', 'KB', 'GT'):
        continue
    per = collections.OrderedDict()
    for q in e['questions']:
        per.setdefault(q['context'], []).append(q)
    for titel, qs in per.items():
        lead = next((schoon(q['lead']) for q in qs if len(schoon(q['lead'])) > 30), '')
        vr = []
        doms = collections.Counter(); typen = []
        figs = 0
        for q in qs:
            m = meta.get((e['id'], q['nr']), {})
            f = bool(m.get('figs')) or bool(m.get('uwb')) or m.get('fmt') == 'tekenen'
            figs += f
            if m.get('dom'): doms[m['dom']] += 1
            if m.get('type'): typen.append(m['type'])
            lq = schoon(q['lead'])
            vr.append({'nr': q['nr'], 'p': q['points'], 'lead': lq if lq != lead else '', 'tekst': schoon(q['text'])[:700],
                       'vorm': m.get('fmt', ''), 'type': m.get('type', 'OVERIG'), 'figuur': f, 'cv': cv_tekst(q.get('cv'))})
        bruikbaar = [x for x in vr if not x['figuur']]
        if len(bruikbaar) < 2 or not lead:
            continue
        out.append({'id': f"{e['id']}:{titel}", 'leerweg': e['level'], 'jaar': e['year'], 'tijdvak': e['tijdvak'],
                    'titel': titel, 'intro': lead[:900], 'domeinen': [d for d, _ in doms.most_common(3) if d != 'overig'],
                    'typen': sorted(set(typen)), 'vragen': bruikbaar})
print(len(out), collections.Counter(c['leerweg'] for c in out))
js = json.dumps(out, ensure_ascii=False)
open('/workspace/toetski-work/base/src/lib/toets/cse-contexten.ts', 'w').write(
    "// GEGENEREERD door tools/bouw-cse-contexten.py uit de openbare CSE's NaSk1 vmbo 2013–2026.\n"
    "// Echte examencontexten, ALLEEN voor het blok 'Examenvragen' in klas 4 / examenniveau (met bronvermelding).\n"
    "// Nooit gebruiken voor klas 1–3.\n\n"
    "export interface CseVraag { nr: number; p: number; lead: string; tekst: string; vorm: string; type: string; figuur: boolean; cv: string }\n"
    "export interface CseContext { id: string; leerweg: \"BB\" | \"KB\" | \"GT\"; jaar: number; tijdvak: number; titel: string; intro: string; domeinen: string[]; typen: string[]; vragen: CseVraag[] }\n\n"
    f"export const CSE_CONTEXTEN: CseContext[] = {js};\n")
print(len(js))
