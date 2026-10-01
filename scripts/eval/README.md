# Toetski offline eval-harnas

Vaste invoer + vaste rubriek, zodat elke wijziging aan prompts/modellen/pijplijn meetbaar is tegen een baseline.

## Cases (`inputs/`)
| case | wat |
|---|---|
| `krachten-gt3` | Krachten (H5) 3GT — de casus van de 13 reviewpunten |
| `geluid-gt4` | Geluid 4GT (H13), standaard-RTTI (zonder de oude RTTI-override) |
| `geluid-kb2` | Geluid 2KB |
| `stoffen-bb2` | Stoffen en materialen 2BB |
| `energie-geluid-gt4` | 4GT H11 Kracht en beweging + H13 Geluid (twee hoofdstukken; H11-lesstof = eigen samenvatting van de Nova-toetsmatrijs/uitwerkingen) |

Het runner-script voegt `rttiDoel = rttiDoelVoor(leerjaar)` toe (zoals het formulier), dus het RTTI-doel komt uit `src/lib/toets/config.ts`.

## Gebruik
```bash
# 1 generatie (kost API-tokens via de site; ~3 min, ~$0.15–0.30 met grok-4.5)
npm run eval -- genereer energie-geluid-gt4 --naam na-opschonen [--base https://<preview>.vercel.app]
# Scoren (offline; --rechter = 1 extra grok-4.5-aanroep met vaste prompt, temp 0)
npm run eval -- scoor eval-out/na-opschonen/energie-geluid-gt4.json --case energie-geluid-gt4 [--rechter] --baseline <baseline.scores.json>
# Alleen de go-live-poort
npm run eval -- poort nieuw.scores.json baseline.scores.json
```

## Rubriek (`src/lib/toets/eval/rubric.ts`)
13 criteria (de 13 Krachten-reviewpunten), elk 0–1, waar mogelijk door code gescoord; met `--rechter` wordt de
rechter-score (0–2 per punt) gemengd met de codescore voor de punten die code slecht ziet (2, 3, 4, 6, 7).
Cijfer = 1 + 9 × gemiddelde. Harde criteria (moeten 100 % zijn): één g, MC-structuur, alle paragrafen gedekt,
geen spookfiguren, nakijkmodel compleet, punten 85–120 %, geen schoolnamen, geen open sleutelfouten.

**Go-live-poort:** alle harde criteria OK én cijfer ≥ baseline (zelfde case, zelfde rubriekversie).
Verhoog `RUBRIEK_VERSIE` bij elke rubriekwijziging en scoor de baseline opnieuw.

`baselines/` bevat de vaste baseline-toets (productie 8079c92) die ook `rubric.test.ts` gebruikt.
